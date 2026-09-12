function normalizeTags(value) {
  const values = Array.isArray(value) ? value : String(value || '').split(',');
  const seen = new Set();
  const tags = [];

  for (const raw of values) {
    const tag = String(raw).trim();
    if (!tag) continue;
    const key = tag.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
  }

  return tags;
}

function parseTagFilters(value) {
  const values = Array.isArray(value) ? value.flatMap((item) => String(item).split(',')) : value;
  return normalizeTags(values);
}

function normalizeTagDirective(content) {
  return String(content).replace(/\{x_tags:\s*([^}]*)\}/i, (_directive, value) => {
    const tags = normalizeTags(value);
    return tags.length ? `{x_tags: ${tags.join(',')}}` : '';
  });
}

module.exports = { normalizeTags, parseTagFilters, normalizeTagDirective };
