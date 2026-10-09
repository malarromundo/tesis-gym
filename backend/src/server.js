import { createApp } from './app.js';

const port=Number(process.env.PORT||3001);
const host=process.env.HOST||'127.0.0.1';
const {app,db}=await createApp();
const server=app.listen(port,host,()=>console.log(`RutinaTrack API: http://${host}:${port}\nBase de datos: ${db.file}`));
server.on('error',error=>{console.error(error);db.close();process.exitCode=1;});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>{db.close();process.exit(0);}));
