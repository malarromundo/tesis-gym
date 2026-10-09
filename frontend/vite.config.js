import {defineConfig,loadEnv} from 'vite';
import react from '@vitejs/plugin-react';
export default defineConfig(({mode})=>{
  const env=loadEnv(mode,process.cwd(),'');
  if(mode==='mobile' && env.VITE_API_URL && !/^https:\/\//.test(env.VITE_API_URL))throw new Error('El backend móvil remoto debe usar HTTPS. Puede omitirse para configurarlo desde el login.');
  return {plugins:[react()],build:{outDir:mode==='mobile'?'dist-mobile':'dist'},server:{port:5173,strictPort:true,proxy:{'/api':'http://127.0.0.1:3002','/public':'http://127.0.0.1:3002'}}};
});
