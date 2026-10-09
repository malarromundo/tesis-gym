export function checkHealthPayload(payload,contentType=''){
  if(!contentType.toLowerCase().includes('application/json')||!payload||payload.application!=='RutinaTrack'||payload.status!=='ok'){
    throw new Error('La dirección no responde como un servidor RutinaTrack. Puede estar apuntando a otra aplicación o a una configuración anterior. Verificá el dominio con el administrador.');
  }
}
export async function verifyServer(base){
  let response;
  try{response=await fetch(`${base.replace(/\/$/,'')}/api/health`,{credentials:'omit',signal:AbortSignal.timeout(12000),cache:'no-store',redirect:'error'});}
  catch{throw new Error('No se pudo verificar el servidor RutinaTrack. Revisá la dirección HTTPS, el certificado y la configuración de acceso remoto (CORS). No se enviaron credenciales.');}
  const type=response.headers.get('content-type')||'';
  let payload=null;if(type.includes('application/json'))try{payload=await response.json();}catch{}
  checkHealthPayload(response.ok?payload:null,type);
}
