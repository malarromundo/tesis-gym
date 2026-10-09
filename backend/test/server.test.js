import {test} from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createApp} from '../src/app.js';
import {createUser} from '../src/common.js';

test('servidor compartido: clientes concurrentes, permisos y orígenes móviles',async t=>{
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'rutinatrack-connections-'));
  const {app,db}=await createApp({dataDir:directory});
  const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));db.close();fs.rmSync(directory,{recursive:true,force:true});});
  const base=`http://127.0.0.1:${server.address().port}`;
  async function request(method,url,body,token){const r=await fetch(base+url,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body)});assert.ok(r.ok,`${url}: ${r.status}`);return r.json();}
  const password='Concurrent123!';
  createUser(db,{name:'Admin',email:'admin@parallel.test',password},'ADMIN');
  createUser(db,{name:'Atleta',email:'athlete@parallel.test',password},'ATHLETE');
  const admin=(await request('POST','/api/auth/login',{email:'admin@parallel.test',password})).token;
  const athlete=(await request('POST','/api/auth/login',{email:'athlete@parallel.test',password})).token;
  const exercise=await request('POST','/api/exercises',{name:'Ejercicio concurrencia',muscle_group:'Piernas',description:'Descripción de prueba.'},admin);
  const sessions=await Promise.all(Array.from({length:10},async()=>{
    const session=await request('POST','/api/sessions',{},athlete);
    await request('POST',`/api/sessions/${session.id}/sets`,{exercise_id:exercise.id,set_number:1,reps:10,weight:20},athlete);
    await request('POST',`/api/sessions/${session.id}/complete`,{},athlete);return session.id;
  }));
  assert.equal(new Set(sessions).size,10);
  const progress=await request('GET','/api/reports/progress',undefined,athlete);
  assert.equal(progress.completed_sessions,10);assert.equal(progress.weekly_volume.reduce((sum,r)=>sum+r.volume_kg_reps,0),2000);
  assert.equal((await request('GET','/api/server',undefined,admin)).status,'ONLINE');
  assert.equal((await fetch(base+'/api/server',{headers:{Authorization:`Bearer ${athlete}`}})).status,403);
  for(const origin of ['https://localhost','capacitor://localhost','http://localhost:3131']){
    const r=await fetch(base+'/api/auth/login',{method:'OPTIONS',headers:{Origin:origin,'Access-Control-Request-Method':'POST','Access-Control-Request-Headers':'Content-Type'}});
    assert.equal(r.status,204);assert.equal(r.headers.get('Access-Control-Allow-Origin'),origin);
  }
  const denied=await fetch(base+'/api/auth/login',{method:'OPTIONS',headers:{Origin:'https://unknown.example'}});assert.equal(denied.status,403);
});
