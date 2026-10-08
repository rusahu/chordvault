const test=require('node:test');
const assert=require('node:assert/strict');
const Database=require('better-sqlite3');
const { queryList }=require('../lib/pagination');
test('count bindings are independent of row projection bindings',()=>{
  const db=new Database(':memory:');
  try {
    db.exec('CREATE TABLE items (id INTEGER, owner INTEGER); INSERT INTO items VALUES (1,7),(2,7),(3,8)');
    assert.deepEqual(queryList(db,{sql:'SELECT id, ? AS marker FROM items WHERE owner = ? ORDER BY id',params:['selected',7],countSql:'SELECT COUNT(*) AS count FROM items WHERE owner = ?',countParams:[7],page:2,limit:1,resultKey:'songs'}),{songs:[{id:2,marker:'selected'}],total:2,page:2,limit:1,totalPages:2});
  } finally { db.close(); }
});
