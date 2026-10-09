import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const result=spawnSync(process.execPath,[path.join(root,'frontend/node_modules/vite/bin/vite.js'),'build','--configLoader','native'],{cwd:path.join(root,'frontend'),stdio:'inherit'});
if(result.status!==0)process.exit(result.status||1);
const target=path.join(root,'backend/public');fs.mkdirSync(target,{recursive:true});
fs.cpSync(path.join(root,'frontend/dist'),target,{recursive:true});
console.log('Frontend copiado a backend/public.');
