const test = require('node:test');
const assert = require('node:assert/strict');
const { db, user, serve } = require('./helpers/app');
const { setSetting } = require('../lib/db');
const { createAuthRouter } = require('../routes/auth');
const { createSongsRouter } = require('../routes/songs');
const { createSetlistsRouter } = require('../routes/setlists');
const { createAdminRouter } = require('../routes/admin');
const { createSettingsRouter } = require('../routes/settings');
const admin = user('validation-admin','admin');
setSetting('allow_registration','1');
const content = '{title: 恩典 Grace}\n{x_language: zh}\n[C]恩典';
const id = Number(db.prepare("INSERT INTO songs (user_id,title,content,visibility) VALUES (?, 'Grace', ?, 'private')").run(admin.id,content).lastInsertRowid);
const sl = Number(db.prepare("INSERT INTO setlists (user_id,name) VALUES (?, 'Service')").run(admin.id).lastInsertRowid);
const entry = Number(db.prepare('INSERT INTO setlist_songs (setlist_id,song_id,position) VALUES (?,?,0)').run(sl,id).lastInsertRowid);
test.after(()=>db.close());
const mount = app => {
  app.use('/api/auth',createAuthRouter());
  for(const factory of [createSongsRouter,createSetlistsRouter,createAdminRouter,createSettingsRouter]) app.use('/api',factory());
};

test('malformed write fields return 400 without changing songs', async t => {
  t.mock.method(console,'error',()=>{});
  const request = await serve(t,mount);
  const cases = [
    ['/auth/login',{username:123,password:'secret'}],
    ['/auth/login',{username:'validation-admin',password:{}}],
    ['/auth/register',{username:[],password:'secret'}],
    ['/auth/redeem-invite',{code:{},username:'valid',password:'secret'}],
    ['/admin/users',{username:{},password:'secret'}],
    ['/songs',{content:123}],
    [`/songs/${id}`,{content:{}},'PUT'],
    [`/songs/${id}`,{format_detected:[]},'PUT'],
    [`/songs/${id}/version`,{content:{}}],
    [`/songs/${id}/correction`,{content:[]}],
    ['/setlists',{name:{}}],
    ['/setlists',{name:'Service',event_date:'2026-02-31'}],
    [`/setlists/${sl}/entries/${entry}`,{content_override:{}},'PUT'],
    [`/setlists/${sl}/reorder`,{entry_ids:[`${entry}garbage`]},'PUT'],
    ['/ocr/gemini/refine',{image:{},message:'fix',history:[]}],
    ['/ocr/gemini/refine',{image:'data:image/png;base64,YQ==',message:{},history:[]}],
    ['/ocr/gemini/refine',{image:'data:image/png;base64,YQ==',message:'fix',history:[null]}],
  ];
  const before = db.prepare('SELECT * FROM songs WHERE id=?').get(id);
  for(const [path,body,method='POST'] of cases) {
    const response=await request('/api'+path,{...admin,method,body});
    assert.equal(response.status,400,`${path}: ${JSON.stringify(body)}`);
  }
  assert.deepEqual(db.prepare('SELECT * FROM songs WHERE id=?').get(id),before);
});

test('invalid list query types and pagination are rejected', async t => {
  t.mock.method(console,'error',()=>{});
  const request=await serve(t,mount);
  for(const route of ['/songs','/songs/public','/setlists','/setlists/public']) {
    for(const query of ['q=a&q=b','page=garbage','limit=0']) assert.equal((await request('/api'+route+'?'+query,admin)).status,400);
  }
});

test('mixed bulk import reports indexed errors while importing valid rows',async t=>{
  t.mock.method(console,'error',()=>{});
  const request=await serve(t,mount);
  const response=await request('/api/songs/import',{...admin,method:'POST',body:{songs:[null,[],{content:7},{content:content+' imported'}]}});
  assert.equal(response.status,200);
  const result=await response.json();
  assert.equal(result.imported,1);
  assert.deepEqual(result.errors.map(e=>e.index),[0,1,2]);
});

test('missing and null language preferences clear the setting, wrong types fail',async t=>{
  t.mock.method(console,'error',()=>{});
  const request=await serve(t,mount);
  for(const body of [{languages:['en','zh']},{},{languages:null}]) {
    assert.equal((await request('/api/settings/languages',{...admin,method:'PUT',body})).status,200);
  }
  assert.deepEqual(await (await request('/api/settings/languages',admin)).json(),{languages:[]});
  assert.equal((await request('/api/settings/languages',{...admin,method:'PUT',body:{languages:false}})).status,400);
});

test('valid Chinese content, null updates, entry resets and leap-day dates still work',async t=>{
  const request=await serve(t,mount);
  for(const body of [{},{content:null}]) assert.equal((await request(`/api/songs/${id}`,{...admin,method:'PUT',body})).status,200);
  assert.equal(db.prepare('SELECT content FROM songs WHERE id=?').get(id).content,content);
  assert.equal((await request('/api/setlists',{...admin,method:'POST',body:{name:'Leap',event_date:'2024-02-29'}})).status,200);
  assert.equal((await request(`/api/setlists/${sl}/entries/${entry}`,{...admin,method:'PUT',body:{content_override:null,target_key:null}})).status,200);
});
