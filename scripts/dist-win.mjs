import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
const root=path.resolve(import.meta.dirname,'..');
const cache=path.join(os.tmpdir(),'rutinatrack-build-cache');
const env={...process.env,electron_config_cache:path.join(cache,'electron'),ELECTRON_BUILDER_CACHE:path.join(cache,'builder')};
delete env.ELECTRON_SKIP_BINARY_DOWNLOAD;
function run(args){const result=spawnSync(process.execPath,args,{cwd:root,env,stdio:'inherit'});if(result.status!==0)process.exit(result.status||1);}
run(['scripts/build.mjs']);
if(!fs.existsSync(path.join(root,'node_modules/electron/dist/electron.exe')))run(['node_modules/electron/install.js']);
run(['node_modules/electron-builder/cli.js','--win','nsis','--x64','--config.electronDist=node_modules/electron/dist']);
const installer=path.join(root,'release','RutinaTrack-Setup-1.0.0.exe');
const bytes=fs.readFileSync(installer);const pe=bytes.readUInt32LE(60);
if(bytes.toString('ascii',0,2)!=='MZ'||bytes.readUInt32LE(pe)!==0x4550)throw new Error('El instalador no es un ejecutable PE válido.');
console.log(`Instalador Windows validado: ${installer} (${bytes.length} bytes)`);
