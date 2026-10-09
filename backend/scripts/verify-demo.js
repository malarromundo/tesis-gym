import assert from 'node:assert/strict';
import {ACCOUNTS} from './seed.js';
const base=process.env.API_URL||'http://127.0.0.1:3002';
async function get(route,token){const r=await fetch(base+route,{headers:token?{Authorization:`Bearer ${token}`}:{}});assert.equal(r.status,200);return r.json();}
const sessions=[];
for(const account of ACCOUNTS){
  const response=await fetch(base+'/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:account.email,password:account.password})});
  assert.equal(response.status,200);sessions.push(await response.json());
}
const [admin,trainer,lucia,diego]=sessions;
assert.equal((await get('/api/exercises?limit=100',lucia.token)).length,44);
assert.equal((await get('/api/users',admin.token)).length,4);
assert.equal((await get('/api/users/athletes',trainer.token)).length,2);
assert.equal((await get('/api/routines',diego.token)).length,1);
const history=await get('/api/sessions?status=COMPLETED',lucia.token);assert.equal(history.length,27);
const progress=await get('/api/reports/progress',lucia.token);
assert.equal(progress.body_weight.length,18);
assert.equal(progress.weekly_volume.filter(w=>w.volume_kg_reps>0).length,9);
const progression={};
for(const name of ['Sentadilla','Press de banca','Remo con barra']){
  const entries=progress.max_weight.filter(e=>e.name===name);assert.equal(entries.length,27);
  for(let i=1;i<entries.length;i++)assert.ok(entries[i].max_weight_kg>=entries[i-1].max_weight_kg);
  assert.ok(entries.at(-1).max_weight_kg>entries[0].max_weight_kg);
  progression[name]=`${entries[0].max_weight_kg} → ${entries.at(-1).max_weight_kg} kg`;
}
assert.equal((await get('/api/reports/admin',admin.token)).users_by_role.reduce((s,r)=>s+r.total,0),4);
assert.equal((await get('/public/share/'+lucia.user.share_token)).routines.length,1);
console.log(JSON.stringify({login:'4 roles/cuentas verificados',exercises:44,users:4,completed_sessions:history.length,body_weight_logs:18,progression,history_from:history.at(-1).date,history_to:history[0].date},null,2));
