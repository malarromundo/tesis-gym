export const appBase=import.meta.env.BASE_URL.replace(/\/$/,'');
export const mobileBuild=import.meta.env.MODE==='mobile';
export function serverOrigin(){return localStorage.getItem('rt-server')||import.meta.env.VITE_API_URL||(appBase?window.location.origin+appBase:'');}
export function normalizeServer(value){
  const raw=value.trim();
  if(!raw&&!mobileBuild)return '';
  let url;try{url=new URL(raw);}catch{throw new Error('Ingresá la dirección HTTPS del servidor de tu gimnasio.');}
  if(url.protocol!=='https:'||url.username||url.password||!/^\/(?:rutinatrack\/?)?$/.test(url.pathname)||url.search||url.hash)throw new Error('Usá HTTPS, con /rutinatrack si corresponde, sin /api, usuario, contraseña ni parámetros.');
  if(['localhost','127.0.0.1','[::1]'].includes(url.hostname)||/^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(url.hostname))throw new Error('Para acceso remoto necesitás un servidor público, no una dirección de red local.');
  return url.origin+url.pathname.replace(/\/$/,'');
}
export function saveServer(value){
  const normalized=normalizeServer(value);
  if(normalized)localStorage.setItem('rt-server',normalized);else localStorage.removeItem('rt-server');
  localStorage.removeItem('rt-token');
}
