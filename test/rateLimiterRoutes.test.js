const test=require('node:test');
const assert=require('node:assert/strict');
const { db,user,serve }=require('./helpers/app');
const { createApiRateLimiter }=require('../lib/rateLimiter');
const { createAuthRouter }=require('../routes/auth');
const { createSongsRouter }=require('../routes/songs');
const account=user('production-reader');
const other=user('production-other');
const disabled=user('production-disabled');
db.prepare('UPDATE users SET disabled=1 WHERE id=?').run(disabled.id);
const root=Number(db.prepare("INSERT INTO songs (user_id,title,content,visibility) VALUES (?, 'Root', '[C]Grace', 'public')").run(account.id).lastInsertRowid);
const privateId=Number(db.prepare("INSERT INTO songs (user_id,title,content,visibility,parent_id) VALUES (?, 'Secret', '[C]Secret', 'private', ?)").run(account.id,root).lastInsertRowid);
test.after(()=>db.close());
const mount=app=>{
  app.use('/api',createApiRateLimiter());
  app.use('/api/auth',createAuthRouter());
  app.use('/api',createSongsRouter());
};

test('production ordering preserves endpoint auth and private visibility',async t=>{
  process.env.NODE_ENV='production';
  const request=await serve(t,mount);
  assert.equal((await request('/api/songs/export')).status,401);
  assert.equal((await request('/api/songs/export',disabled)).status,403);
  assert.equal((await request(`/api/songs/${privateId}`,other)).status,404);
  assert.equal((await request(`/api/songs/${privateId}`,account)).status,200);
  const response=await request('/api/auth/login',{method:'POST',body:{username:{},password:7}});
  assert.equal(response.status,400);
  const exported=await request('/api/songs/export',account);
  assert.equal(exported.status,200);
  assert.match(exported.headers.get('content-type'),/zip/);
  assert.ok((await exported.arrayBuffer()).byteLength>0);
});

test('quota classification leaves public version counts identical in development and production',async t=>{
  const results=[];
  for(const environment of ['development','production']) {
    process.env.NODE_ENV=environment;
    const request=await serve(t,mount);
    const publicSongs=await (await request('/api/songs/public',account)).json();
    assert.equal(publicSongs.some(song=>song.id===privateId),false);
    assert.equal(publicSongs.find(song=>song.id===root).version_count,1);
    results.push(publicSongs);
    assert.equal((await (await request(`/api/songs/${root}`,account)).json()).version_count,2);
  }
  assert.deepEqual(results[0],results[1]);
});
