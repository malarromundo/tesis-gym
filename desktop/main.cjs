const {app,BrowserWindow,dialog,Tray,Menu}=require('electron');
const path=require('node:path');
const fs=require('node:fs');
const crypto=require('node:crypto');
const {pathToFileURL}=require('node:url');
let server,database,window,tray,quitting=false;
if(!app.requestSingleInstanceLock()){app.quit();}else{
app.on('second-instance',()=>{if(window){if(window.isMinimized())window.restore();window.focus();}});
app.whenReady().then(async()=>{
  const base=path.join(__dirname,'..');
  const {createApp}=await import(pathToFileURL(path.join(base,'backend/src/app.js')).href);
  const {createUser}=await import(pathToFileURL(path.join(base,'backend/src/common.js')).href);
  const {EXERCISES}=await import(pathToFileURL(path.join(base,'backend/scripts/catalog.js')).href);
  const dataDir=path.join(app.getPath('userData'),'data');
  const service=await createApp({dataDir,publicDir:path.join(base,'backend/public'),serverMode:'desktop'});database=service.db;
  let credentials;
  if(!database.one('SELECT count(*) AS n FROM users').n){
    const password=crypto.randomBytes(18).toString('base64url');
    credentials=`Email: admin@rutinatrack.local\nContraseña: ${password}`;
    const file=path.join(dataDir,'admin-inicial.txt');fs.writeFileSync(file,credentials+'\nCambie la contraseña en Tu cuenta.\n',{mode:0o600});
    createUser(database,{name:'Administrador',email:'admin@rutinatrack.local',password},'ADMIN');
  }
  if(!database.one('SELECT count(*) AS n FROM exercises').n)database.transaction(()=>{for(const [name,group,description] of EXERCISES)database.run('INSERT INTO exercises(name,muscle_group,description) VALUES(?,?,?)',[name,group,description]);});
  server=await new Promise((resolve,reject)=>{const s=service.app.listen(Number(process.env.PORT||3131),'0.0.0.0',()=>resolve(s));s.once('error',reject);});
  const origin=`http://localhost:${server.address().port}`;
  window=new BrowserWindow({width:1420,height:940,minWidth:390,minHeight:620,backgroundColor:'#101214',autoHideMenuBar:true,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true}});
  window.webContents.setWindowOpenHandler(()=>({action:'deny'}));
  window.webContents.on('will-navigate',(event,url)=>{if(new URL(url).origin!==origin)event.preventDefault();});
  tray=new Tray(await app.getFileIcon(process.execPath));
  tray.setToolTip('RutinaTrack · Servidor activo');
  tray.setContextMenu(Menu.buildFromTemplate([{label:'Abrir RutinaTrack',click:()=>{window.show();window.focus();}},{type:'separator'},{label:'Salir y apagar servidor',click:()=>{quitting=true;app.quit();}}]));
  tray.on('double-click',()=>{window.show();window.focus();});
  window.on('close',event=>{if(!quitting){event.preventDefault();window.hide();}});
  await window.loadURL(origin);
  if(credentials)await dialog.showMessageBox(window,{type:'info',title:'Primer ingreso a RutinaTrack',message:'Se creó tu administrador inicial',detail:credentials+`\n\nGuardado también en ${path.join(dataDir,'admin-inicial.txt')}\nCambiá la contraseña en Tu cuenta.`});
}).catch(error=>{dialog.showErrorBox('No se pudo iniciar RutinaTrack',error.message);app.quit();});
app.on('window-all-closed',()=>app.quit());
app.on('before-quit',()=>{quitting=true;server?.close();database?.close();});
}
