import {spawnSync} from 'node:child_process';
import path from 'node:path';
const root=path.resolve(import.meta.dirname,'..');
const result=spawnSync(process.execPath,[path.join(root,'frontend/node_modules/vite/bin/vite.js'),'build','--configLoader','native','--base','/rutinatrack/','--outDir','dist-server'],{cwd:path.join(root,'frontend'),stdio:'inherit'});
process.exitCode=result.status??1;
