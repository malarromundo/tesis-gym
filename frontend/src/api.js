import axios from 'axios';
import {serverOrigin,mobileBuild} from './connection';
import {verifyServer} from './server-check';
export const api=axios.create({baseURL:import.meta.env.VITE_API_URL||'',timeout:15000});
api.interceptors.request.use(async config=>{config.baseURL=serverOrigin();if(mobileBuild&&!config.baseURL){const error=new Error('Configurá el servidor HTTPS de tu gimnasio antes de ingresar.');error.localConfig=true;throw error;}if(config.baseURL){try{await verifyServer(config.baseURL);}catch(error){error.localConfig=true;throw error;}}const token=localStorage.getItem('rt-token');if(token && !config.url.startsWith('/public/'))config.headers.Authorization=`Bearer ${token}`;return config;});
api.interceptors.response.use(r=>{if(r.status!==204&&r.config.responseType!=='blob'&&!String(r.headers['content-type']).includes('application/json'))throw new Error('El servidor devolvió una página web en lugar de la API de RutinaTrack. Revisá la dirección del servidor.');return r;},error=>{
  if(error.response?.status===401 && !error.config?.url?.includes('/auth/login'))window.dispatchEvent(new Event('rt-unauthorized'));
  error.message=error.response?.data?.error||(error.localConfig?error.message:'No se pudo conectar con el servidor. Comprobá tu conexión e intentá nuevamente.');return Promise.reject(error);
});
export const get=async url=>(await api.get(url)).data;
export async function all(url){let rows=[],offset=0;while(true){const page=await get(`${url}${url.includes('?')?'&':'?'}limit=100&offset=${offset}`);rows.push(...page);if(page.length<100)return rows;offset+=100;}}
export async function csv(type,athlete=''){const response=await api.get(`/api/reports/export?type=${type}${athlete?`&athlete_id=${athlete}`:''}`,{responseType:'blob'});const url=URL.createObjectURL(response.data);const a=document.createElement('a');a.href=url;a.download=`rutinatrack-${type}.csv`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
