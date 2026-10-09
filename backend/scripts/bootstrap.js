import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {openDatabase} from '../src/db.js';
import {createUser} from '../src/common.js';
import {EXERCISES} from './catalog.js';
const directory=process.env.DATA_DIR||path.resolve('data');
const db=await openDatabase(directory);
try{
  if(!db.one('SELECT count(*) AS n FROM users').n){
    const email=process.env.ADMIN_EMAIL||'admin@rutinatrack.local';
    const password=crypto.randomBytes(18).toString('base64url');
    const file=path.join(directory,'admin-inicial.txt');
    fs.writeFileSync(file,`Email: ${email}\nContraseña: ${password}\nCambie la contraseña al ingresar y elimine este archivo.\n`,{mode:0o600});
    createUser(db,{name:'Administrador',email,password},'ADMIN');
    console.log('Administrador inicial creado. Consulte el archivo admin-inicial.txt dentro del volumen de datos.');
  }
  if(!db.one('SELECT count(*) AS n FROM exercises').n)db.transaction(()=>{for(const [name,group,description] of EXERCISES)db.run('INSERT INTO exercises(name,muscle_group,description) VALUES(?,?,?)',[name,group,description]);});
}finally{db.close();}
await import('../src/server.js');
