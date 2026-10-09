// Run against a local server initialized with npm run init-admin.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';

const directory=process.env.DATA_DIR||path.resolve('data');
const base=process.env.API_URL||'http://127.0.0.1:3001';
const initial=fs.readFileSync(path.join(directory,'admin-inicial.txt'),'utf8');
const email=initial.match(/Email: (.+)/)[1].trim();
const password=initial.match(/Contraseña: (.+)/)[1].trim();
async function request(method,url,body,token,status=200){
  const response=await fetch(base+url,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body)});
  const data=await response.json();assert.equal(response.status,status,JSON.stringify(data));return data;
}
assert.equal((await request('GET','/api/health')).status,'ok');
const admin=await request('POST','/api/auth/login',{email,password});
const athleteEmail=`prueba.${Date.now()}@rutinatrack.local`;
const athletePassword=crypto.randomBytes(12).toString('base64url');
const athlete=await request('POST','/api/auth/register',{name:'Atleta de prueba API',email:athleteEmail,password:athletePassword},undefined,201);
const login=await request('POST','/api/auth/login',{email:athleteEmail,password:athletePassword});
const exercise=await request('POST','/api/exercises',{name:`Sentadilla de prueba ${Date.now()}`,muscle_group:'Piernas',description:'De pie, coloque los pies al ancho de hombros y mantenga el abdomen firme. Flexione caderas y rodillas de forma controlada y vuelva a extenderlas, manteniendo los talones apoyados.'},admin.token,201);
const session=await request('POST','/api/sessions',{},login.token,201);
for(const [set_number,reps,weight] of [[1,10,40],[2,8,45]])await request('POST',`/api/sessions/${session.id}/sets`,{exercise_id:exercise.id,set_number,reps,weight},login.token,201);
await request('POST',`/api/sessions/${session.id}/complete`,{},login.token);
const progress=await request('GET','/api/reports/progress',undefined,login.token);
assert.equal(progress.weekly_volume.reduce((total,row)=>total+row.volume_kg_reps,0),760);
const history=await request('GET','/api/sessions?status=COMPLETED',undefined,login.token);assert.equal(history[0].id,session.id);
fs.writeFileSync(path.join(directory,'atleta-prueba.txt'),`Email: ${athleteEmail}\nContraseña: ${athletePassword}\n`,{mode:0o600});
console.log(JSON.stringify({health:'ok',registered_athlete:athlete.id,login:'ok',created_exercise:exercise.id,completed_session:session.id,sets:2,volume_kg_reps:760,history:'ok'},null,2));
