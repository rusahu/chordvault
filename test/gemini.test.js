const test = require('node:test');
const assert = require('node:assert/strict');
const { parseDataUrl, stripFences, callGemini } = require('../lib/gemini');

test('parseDataUrl splits a png data URL', () => {
  assert.deepEqual(parseDataUrl('data:image/png;base64,AAAA'), {
    mimeType: 'image/png',
    base64: 'AAAA',
  });
});

test('parseDataUrl recognises pdf', () => {
  assert.deepEqual(parseDataUrl('data:application/pdf;base64,BBBB'), {
    mimeType: 'application/pdf',
    base64: 'BBBB',
  });
});

test('parseDataUrl passes bare base64 through as jpeg', () => {
  assert.deepEqual(parseDataUrl('CCCC'), { mimeType: 'image/jpeg', base64: 'CCCC' });
});

test('parseDataUrl ignores an unsupported data URL type', () => {
  const input = 'data:text/html;base64,DDDD';
  assert.deepEqual(parseDataUrl(input), { mimeType: 'image/jpeg', base64: input });
});

test('stripFences removes a labelled fence and its closer', () => {
  assert.equal(stripFences('```chordpro\n[G]hi\n```'), '[G]hi');
});

test('stripFences removes an unlabelled fence', () => {
  assert.equal(stripFences('```\n[G]hi\n```'), '[G]hi');
});

test('stripFences leaves unfenced text alone', () => {
  assert.equal(stripFences('[G]hi'), '[G]hi');
});

// --- callGemini -------------------------------------------------------------

function stubFetch(impl) {
  const original = globalThis.fetch;
  globalThis.fetch = impl;
  return () => {
    globalThis.fetch = original;
  };
}

function okResponse(body) {
  return { ok: true, status: 200, json: async () => body };
}

const CANDIDATE = {
  candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'hello' }] } }],
};
const ARGS = { apiKey: 'k', model: 'gemini-3.6-flash', contents: [{ parts: [{ text: 'p' }] }] };

test('callGemini returns the response text', async () => {
  const restore = stubFetch(async () => okResponse(CANDIDATE));
  try {
    assert.equal(await callGemini(ARGS), 'hello');
  } finally {
    restore();
  }
});

test('callGemini targets the resolved model', async () => {
  let seen;
  const restore = stubFetch(async (url) => {
    seen = url;
    return okResponse(CANDIDATE);
  });
  try {
    await callGemini(ARGS);
  } finally {
    restore();
  }
  assert.equal(
    seen,
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent',
  );
});

test('callGemini sends a response schema only when one is given', async () => {
  const bodies = [];
  const restore = stubFetch(async (_url, opts) => {
    bodies.push(JSON.parse(opts.body));
    return okResponse(CANDIDATE);
  });
  try {
    await callGemini(ARGS);
    await callGemini({ ...ARGS, schema: { type: 'OBJECT' } });
  } finally {
    restore();
  }
  assert.equal(bodies[0].generationConfig, undefined);
  assert.equal(bodies[1].generationConfig.response_mime_type, 'application/json');
  assert.deepEqual(bodies[1].generationConfig.response_schema, { type: 'OBJECT' });
});

test('callGemini surfaces the API error message on a non-OK response', async () => {
  const restore = stubFetch(async () => ({
    ok: false,
    status: 429,
    json: async () => ({ error: { message: 'quota exhausted' } }),
  }));
  try {
    await assert.rejects(callGemini(ARGS), (e) => {
      assert.equal(e.message, 'quota exhausted');
      assert.equal(e.status, 502);
      assert.equal(e.code, 'GEMINI_HTTP');
      return true;
    });
  } finally {
    restore();
  }
});

test('callGemini falls back to a status message when the envelope is unparseable', async () => {
  const restore = stubFetch(async () => ({
    ok: false,
    status: 500,
    json: async () => {
      throw new Error('not json');
    },
  }));
  try {
    await assert.rejects(callGemini(ARGS), (e) => {
      assert.equal(e.message, 'Gemini API error (500)');
      return true;
    });
  } finally {
    restore();
  }
});

test('callGemini reports a blocked prompt', async () => {
  const restore = stubFetch(async () => okResponse({ promptFeedback: { blockReason: 'SAFETY' } }));
  try {
    await assert.rejects(callGemini(ARGS), (e) => {
      assert.equal(e.message, 'Gemini blocked the request: SAFETY');
      assert.equal(e.code, 'GEMINI_BLOCKED');
      return true;
    });
  } finally {
    restore();
  }
});

test('callGemini rejects a bad finishReason using subject and hint', async () => {
  const restore = stubFetch(async () =>
    okResponse({ candidates: [{ finishReason: 'RECITATION' }] }),
  );
  try {
    await assert.rejects(
      callGemini({ ...ARGS, subject: 'image', retryHint: 'Try a clearer photo.' }),
      (e) => {
        assert.equal(
          e.message,
          'Gemini could not process the image (RECITATION). Try a clearer photo.',
        );
        assert.equal(e.code, 'GEMINI_FINISH');
        return true;
      },
    );
  } finally {
    restore();
  }
});

test('callGemini omits a trailing space when no hint is given', async () => {
  const restore = stubFetch(async () => okResponse({ candidates: [{ finishReason: 'SAFETY' }] }));
  try {
    await assert.rejects(callGemini(ARGS), (e) => {
      assert.equal(e.message, 'Gemini could not process the request (SAFETY).');
      return true;
    });
  } finally {
    restore();
  }
});

test('callGemini accepts MAX_TOKENS as a success', async () => {
  const restore = stubFetch(async () =>
    okResponse({
      candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [{ text: 'partial' }] } }],
    }),
  );
  try {
    assert.equal(await callGemini(ARGS), 'partial');
  } finally {
    restore();
  }
});

test('callGemini rejects an empty text part', async () => {
  const restore = stubFetch(async () =>
    okResponse({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: '' }] } }] }),
  );
  try {
    await assert.rejects(callGemini({ ...ARGS, retryHint: 'Try again.' }), (e) => {
      assert.equal(e.message, 'Gemini returned no text. Try again.');
      assert.equal(e.code, 'GEMINI_EMPTY');
      return true;
    });
  } finally {
    restore();
  }
});

test('callGemini wraps a network failure', async () => {
  const restore = stubFetch(async () => {
    throw new TypeError('fetch failed');
  });
  try {
    await assert.rejects(callGemini(ARGS), (e) => {
      assert.equal(e.message, 'Gemini error: fetch failed');
      assert.equal(e.code, 'GEMINI_NETWORK');
      return true;
    });
  } finally {
    restore();
  }
});
