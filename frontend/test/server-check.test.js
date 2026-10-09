import {test} from 'node:test';
import assert from 'node:assert/strict';
import {checkHealthPayload,verifyServer} from '../src/server-check.js';
test('acepta únicamente una API RutinaTrack identificada',()=>{
  assert.doesNotThrow(()=>checkHealthPayload({status:'ok',application:'RutinaTrack',api_version:1},'application/json; charset=utf-8'));
  assert.throws(()=>checkHealthPayload('<html>Incomex Argentina</html>','text/html'),/no responde/);
  assert.throws(()=>checkHealthPayload({status:'ok'},'application/json'),/no responde/);
  assert.throws(()=>checkHealthPayload(null,'application/json'),/no responde/);
});
test('verificación de servidor no envía cookies ni credenciales',async t=>{
  const original=globalThis.fetch; t.after(()=>{globalThis.fetch=original;});
  globalThis.fetch=async (url,options)=>{
    assert.equal(url,'https://gym.example/api/health');assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');assert.equal(options.headers,undefined);
    return new Response(JSON.stringify({status:'ok',application:'RutinaTrack'}),{headers:{'content-type':'application/json'}});
  };
  await verifyServer('https://gym.example');
});
