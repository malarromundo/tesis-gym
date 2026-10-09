import path from 'node:path';
import fs from 'node:fs';
process.env.DATA_DIR=process.env.SEED_DATA_DIR||path.resolve('data-demo');
process.env.PORT=process.env.PORT||'3002';
if(!fs.existsSync(path.join(process.env.DATA_DIR,'rutinatrack.sqlite')))throw new Error('Ejecute npm run seed primero.');
await import('../src/server.js');
