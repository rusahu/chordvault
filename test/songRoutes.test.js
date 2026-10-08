const test = require('node:test');
const assert = require('node:assert/strict');
const { db, user, serve } = require('./helpers/app');
const { createSongsRouter } = require('../routes/songs');
const { createSetlistsRouter } = require('../routes/setlists');
const limiters = require('../lib/rateLimiter');
const owner = user('song-owner');
const other = user('song-other');
const admin = user('song-admin', 'admin');
const siteOwner = user('site-owner', 'owner');
test.after(() => db.close());
const content = '{title: Grace}\n{x_language: en}\n[C]Grace';
function song(visibility = 'public', status = 'active', parent = null, author = owner.id) {
  return Number(db.prepare('INSERT INTO songs (user_id,title,content,visibility,status,parent_id) VALUES (?,?,?,?,?,?)').run(author, 'Grace', content, visibility, status, parent).lastInsertRowid);
}
const mount = app => {
  app.use('/api', createSongsRouter(limiters));
  app.use('/api', createSetlistsRouter());
};

test('updates require ownership or admin rights and rejected writes leave songs unchanged', async t => {
  const request = await serve(t, mount);
  for (const visibility of ['public', 'private']) {
    const id = song(visibility);
    for (const [actor, status] of [[{},401], [other,404], [owner,200], [admin,200], [siteOwner,200]]) {
      const before = db.prepare('SELECT * FROM songs WHERE id = ?').get(id);
      const response = await request(`/api/songs/${id}`, { ...actor, method:'PUT', body:{content:content+' updated'} });
      assert.equal(response.status, status);
      if (status !== 200) assert.deepEqual(db.prepare('SELECT * FROM songs WHERE id = ?').get(id), before);
    }
  }
});

test('song reads retain public/private and pending correction boundaries', async t => {
  const request = await serve(t, mount);
  const root = song();
  const privateId = song('private');
  const pending = song('public','pending',root, other.id);
  for (const [actor, privateStatus, pendingStatus] of [[{},404,404],[owner,200,200],[other,404,200],[admin,200,200],[siteOwner,200,200]]) {
    assert.equal((await request(`/api/songs/${root}`,actor)).status,200);
    assert.equal((await request(`/api/songs/${privateId}`,actor)).status,privateStatus);
    assert.equal((await request(`/api/songs/${pending}`,actor)).status,pendingStatus);
  }
  const response = await request(`/api/songs/${root}/version`,{...other,method:'POST',body:{content}});
  assert.equal(response.status,200);
});

test('both setlist entry responses mask private song contents and overrides', async t => {
  const request = await serve(t, mount);
  const id = song('private');
  const setlist = Number(db.prepare("INSERT INTO setlists (user_id,name,visibility) VALUES (?, 'Service', 'public')").run(other.id).lastInsertRowid);
  db.prepare("INSERT INTO setlist_songs (setlist_id,song_id,position,content_override) VALUES (?,?,0,'secret override')").run(setlist,id);
  for (const [actor, visible] of [[{},false],[other,false],[owner,true],[admin,true],[siteOwner,true]]) {
    const data = await (await request(`/api/setlists/public/${setlist}`,actor)).json();
    assert.equal(data.entries[0].content,visible?content:'');
    assert.equal(data.entries[0].content_override,visible?'secret override':null);
    assert.equal('song_user_id' in data.entries[0],false);
  }
  const data = await (await request(`/api/setlists/${setlist}`,other)).json();
  assert.equal(data.entries[0].title,'[Private Song]');
  assert.equal(data.entries[0].content_override,null);
});
