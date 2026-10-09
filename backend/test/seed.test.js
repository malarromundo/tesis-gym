import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {seed} from '../scripts/seed.js';
import {openDatabase} from '../src/db.js';
test('seed completo, progresivo y sin sobrescritura',async()=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'rutinatrack-seed-'));
  try{
    const counts=await seed(directory,new Date('2026-09-25T12:00:00Z'));
    assert.deepEqual(counts,{users:4,exercises:44,routines:2,routine_exercises:8,workout_sessions:27,session_sets:324,body_weight_logs:18});
    await assert.rejects(seed(directory),/ya tiene datos/);
    const db=await openDatabase(directory);
    try{
      assert.equal(db.one('SELECT count(*) AS n FROM session_sets WHERE reps>20').n,0);
      assert.equal(db.one("SELECT count(*) AS n FROM workout_sessions WHERE date>'2026-09-25'").n,0);
      assert.deepEqual(db.all('PRAGMA foreign_key_check'),[]);
      assert.equal(db.one('SELECT count(*) AS n FROM users WHERE trainer_id=2').n,2);
      assert.equal(db.one('SELECT count(*) AS n FROM exercises WHERE image_url IS NOT NULL').n,0);
      assert.equal(db.one('SELECT count(*) AS n FROM workout_sessions').n,27);
    }finally{db.close();}
  }finally{fs.rmSync(directory,{recursive:true,force:true});}
});
