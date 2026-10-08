process.env.DB_PATH=':memory:';
const test=require('node:test');
const assert=require('node:assert/strict');
const { db }=require('../lib/db');
const Song=require('../lib/models/song');
const Setlist=require('../lib/models/setlist');
const owner=Number(db.prepare("INSERT INTO users (username,password_hash) VALUES ('paging','x')").run().lastInsertRowid);
const other=Number(db.prepare("INSERT INTO users (username,password_hash) VALUES ('other','x')").run().lastInsertRowid);
const insertSong=db.prepare('INSERT INTO songs (user_id,title,artist,content,language,visibility,updated_at) VALUES (?,?,?,?,?,?,?)');
for(let i=0;i<105;i++) {
  insertSong.run(owner,`Grace ${i}`,'Writer','[C]恩典 Amazing grace','en','public',`2026-01-01 00:${String(Math.floor(i/60)).padStart(2,'0')}:${String(i%60).padStart(2,'0')}`);
  db.prepare('INSERT INTO setlists (user_id,name,visibility,event_date,updated_at) VALUES (?,?,?,?,?)').run(owner,`Service ${i}`,'public',i%2?'2026-01-01':null,`2026-01-01 00:00:${String(i).padStart(3,'0')}`);
}
insertSong.run(owner,'Private','Writer','[C]Secret','zh','private','2026-01-02');
insertSong.run(other,'Hidden','Writer','[C]Secret','zh','private','2026-01-03');
db.prepare("INSERT INTO setlists (user_id,name,visibility) VALUES (?, 'Private service', 'private')").run(other);
test.after(()=>db.close());

for(const [name,list,key,count,unpaged] of [
  ['own songs',o=>Song.listForUser(owner,o),'songs',106,106],
  ['user public songs',o=>Song.listByUser(owner,o),'songs',105,105],
  ['public songs',o=>Song.listPublic(o),'songs',105,100],
  ['own setlists',o=>Setlist.listForUser(owner,o),'setlists',105,105],
  ['public setlists',o=>Setlist.listPublic(o),'setlists',105,100],
]) test(`${name} preserves rows, order, pagination and unpaginated caps`,()=>{
  const all=list({});
  assert.ok(Array.isArray(all));
  assert.equal(all.length,unpaged);
  for(const page of [1,2,999]) {
    const result=list({page,limit:3});
    assert.deepEqual(result,{[key]:all.slice((page-1)*3,page*3),total:count,page,limit:3,totalPages:Math.ceil(count/3)});
  }
});

test('filtered empty results and language/date filters retain their metadata',()=>{
  for(const list of [o=>Song.listForUser(owner,o),o=>Song.listPublic(o)]) {
    assert.deepEqual(list({q:'doesnotexist',page:1,limit:2}),{songs:[],total:0,page:1,limit:2,totalPages:0});
  }
  const chinese=Song.listForUser(owner,{language:'zh',page:1,limit:2});
  assert.equal(chinese.total,1);
  assert.equal(chinese.songs[0].title,'Private');
  const dated=Setlist.listPublic({dateFrom:'2026-01-01',dateTo:'2026-01-01',page:1,limit:200});
  assert.equal(dated.total,52);
});
