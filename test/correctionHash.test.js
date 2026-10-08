process.env.DB_PATH=':memory:';
const test=require('node:test');
const assert=require('node:assert/strict');
const { db }=require('../lib/db');
const Song=require('../lib/models/song');
const { computeSongHash }=require('../lib/songHash');
const owner=Number(db.prepare("INSERT INTO users (username,password_hash) VALUES ('correction-owner','x')").run().lastInsertRowid);
const meta={title:'Grace',artist:'',key:'C',youtube_url:null,bpm:null,tags:null,language:'en'};
test.after(()=>db.close());
function fixture(suffix) {
  const old=`[C]Old ${suffix}`,updated=`[G]New ${suffix}`;
  const id=Number(Song.create(owner,meta,old,'public',null).lastInsertRowid);
  const correction=Number(Song.createCorrection(owner,id,meta,updated).lastInsertRowid);
  return {id,correction,old,updated};
}
test('approval updates hash and deduplication atomically without changing metadata',()=>{
  const f=fixture('approve');
  Song.approveCorrection(f.correction,f.id,f.updated);
  const row=Song.findById(f.id);
  assert.equal(row.content_hash,computeSongHash(f.updated));
  assert.equal(row.content,f.updated);
  assert.equal(row.key,'C');
  assert.equal(Song.findById(f.correction),undefined);
  const result=Song.importSongs(owner,[{...meta,index:0,content:f.updated,visibility:'public'},{...meta,index:1,content:f.old,visibility:'public'}]);
  assert.equal(result.imported,1);
  assert.deepEqual(result.skipped,[{index:0,reason:'already_exists'}]);
});
test('a failed correction deletion rolls content and hash back',()=>{
  const f=fixture('rollback');
  const before=Song.findById(f.id);
  db.exec(`CREATE TRIGGER fail_delete BEFORE DELETE ON songs WHEN OLD.id = ${f.correction} BEGIN SELECT RAISE(ABORT,'fixture failure'); END`);
  try {
    assert.throws(()=>Song.approveCorrection(f.correction,f.id,f.updated));
    assert.deepEqual(Song.findById(f.id),before);
    assert.ok(Song.findById(f.correction));
  } finally {db.exec('DROP TRIGGER fail_delete');}
});
