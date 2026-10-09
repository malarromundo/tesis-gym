import {verifyServer} from './server-check';
import {useState} from 'react';
import {serverOrigin,saveServer,mobileBuild,normalizeServer} from './connection';
import {Field,ErrorMessage} from './ui';
export function ServerSettings(){
  const [value,setValue]=useState(serverOrigin()),[error,setError]=useState(''),[busy,setBusy]=useState(false);
  return <details className="server-settings" open={mobileBuild&&!serverOrigin()?true:undefined}><summary>{serverOrigin()?'Dirección del servidor':mobileBuild?'Conectar con tu gimnasio':'Conectar a un servidor remoto'}</summary><p>{mobileBuild?'Ingresá la dirección pública que te comparta tu gimnasio. Podrás usar la app desde cualquier red.':'Podés usar esta instalación local o conectarte al servidor central de tu gimnasio.'}</p><form onSubmit={async e=>{e.preventDefault();setBusy(true);setError('');try{const address=normalizeServer(value);if(address)await verifyServer(address);saveServer(value);window.location.reload();}catch(e){setError(e.message);}finally{setBusy(false);}}}><Field label="Dirección del servidor HTTPS" type="url" placeholder="https://rutinas.tu-gimnasio.com" value={value} onChange={e=>setValue(e.target.value)} required={mobileBuild}/><ErrorMessage text={error}/><button className="secondary full" disabled={busy}>{busy?'Verificando…':'Verificar y guardar'}</button>{!mobileBuild&&<small>Dejá la dirección vacía para usar la base de esta instalación.</small>}</form></details>;
}
