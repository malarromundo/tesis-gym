import path from 'node:path';
import crypto from 'node:crypto';
import fs from 'node:fs';
import { openDatabase } from '../src/db.js';
import { createUser } from '../src/common.js';

const directory=process.env.DATA_DIR||path.resolve('data');
const db=await openDatabase(directory);
try {
  if(db.one('SELECT count(*) AS n FROM users').n)throw new Error('La inicialización solo se permite con una base sin usuarios.');
  const password=crypto.randomBytes(18).toString('base64url');
  const email=process.env.ADMIN_EMAIL||'admin@rutinatrack.local';
  const credentials=path.join(directory,'admin-inicial.txt');
  fs.writeFileSync(credentials,`RutinaTrack — administrador inicial\nEmail: ${email}\nContraseña: ${password}\nCambie esta contraseña después del primer ingreso y elimine este archivo.\n`,{flag:'wx',mode:0o600});
  try {createUser(db,{name:'Administrador',email,password},'ADMIN');}
  catch(error){fs.unlinkSync(credentials);throw error;}
  console.log(`Administrador creado. Credenciales guardadas en ${credentials}\nConsulte ese archivo local y cambie la contraseña al ingresar.`);
} finally {db.close();}
