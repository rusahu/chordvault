const test=require('node:test');
const assert=require('node:assert/strict');
const Database=require('better-sqlite3');
const { handleDbError }=require('../lib/errors');
for(const code of ['SQLITE_CONSTRAINT_UNIQUE','SQLITE_CONSTRAINT_PRIMARYKEY','SQLITE_CONSTRAINT_ROWID']) test(`${code} uses code rather than message wording`,()=>{
  const error=handleDbError(Object.assign(new Error('changed wording'),{code}),{uniqueMessage:'Username already taken'});
  assert.equal(error.status,400);
  assert.equal(error.code,'DUPLICATE');
  assert.equal(error.message,'Username already taken');
});
for(const code of ['SQLITE_CONSTRAINT_NOTNULL','SQLITE_CONSTRAINT_CHECK','SQLITE_CONSTRAINT_FOREIGNKEY','SQLITE_CONSTRAINT',undefined]) test(`${code} is not a duplicate despite UNIQUE in its message`,t=>{
  t.mock.method(console,'error',()=>{});
  const error=handleDbError(Object.assign(new Error('UNIQUE appears incidentally'),{code}));
  assert.equal(error.status,500);
  assert.equal(error.code,'DB_ERROR');
  assert.equal(error.message,'Server error');
});
test('real SQLite unique and primary-key failures retain the duplicate response',()=>{
  const db=new Database(':memory:');
  try {
    db.exec("CREATE TABLE samples (id INTEGER PRIMARY KEY,name TEXT UNIQUE); INSERT INTO samples VALUES (1,'same')");
    for(const sql of ["INSERT INTO samples VALUES (2,'same')","INSERT INTO samples VALUES (1,'different')"])
      assert.throws(()=>db.exec(sql),err=>{
        const error=handleDbError(err);
        assert.equal(error.status,400);
        assert.equal(error.message,'A record with that value already exists');
        return true;
      });
  } finally {db.close();}
});
