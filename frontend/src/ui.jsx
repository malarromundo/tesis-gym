import {useEffect,useState} from 'react';
import {ArrowUpRight,LoaderCircle,AlertCircle} from 'lucide-react';
export const fmt=n=>new Intl.NumberFormat('es-AR',{maximumFractionDigits:1}).format(n||0);
export const date=d=>d?new Date(d.length===10?d+'T12:00:00':d).toLocaleDateString('es-AR',{day:'2-digit',month:'short'}):'Sin actividad';
export function useLoad(fn,deps=[]){const [data,setData]=useState(null),[error,setError]=useState(''),[version,setVersion]=useState(0);useEffect(()=>{let live=true;setError('');setData(null);Promise.resolve().then(fn).then(d=>live&&setData(d)).catch(e=>live&&setError(e.message));return()=>{live=false;};},[...deps,version]);return {data,error,reload:()=>setVersion(v=>v+1)};}
export function State({data,error,children}){if(error)return <ErrorMessage text={error}/>;if(data===null)return <div className="loading"><LoaderCircle className="spin"/> Cargando tus datos…</div>;return children;}
export const ErrorMessage=({text})=>text?<div className="error" role="alert"><AlertCircle size={18}/>{text}</div>:null;
export function Title({eyebrow='TU ENTRENAMIENTO, EN FOCO',title,subtitle,action}){return <header className="page-title"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1>{subtitle&&<p>{subtitle}</p>}</div>{action}</header>;}
export function Stat({label,value,unit,note}){return <div className="stat"><span>{label}</span><div className="stat-value">{value}<small>{unit}</small></div><p>{note||'Últimas 12 semanas'}<ArrowUpRight size={15}/></p></div>;}
export const Empty=({children})=><div className="empty">{children||'Todavía no hay datos. Tu próximo entrenamiento empieza acá.'}</div>;
export function Chart({rows=[],value,label='date',unit='',bars=false,title}){
  if(!rows.length)return <Empty>Registrá tus primeros datos para ver la evolución.</Empty>;
  const values=rows.map(r=>Number(r[value])||0),max=Math.max(...values,1),min=bars?0:Math.min(...values)*0.9,range=max-min||1;
  const x=i=>48+(i/(rows.length-1||1))*590,y=v=>170-(v-min)/range*140;
  return <div className="chart"><svg viewBox="0 0 680 205" role="img" aria-label={title||`Evolución en ${unit}`}>
    {[0,0.5,1].map(t=><g key={t}><line x1="48" x2="650" y1={170-t*140} y2={170-t*140} stroke="var(--line)" strokeDasharray="3 5"/><text x="0" y={174-t*140}>{fmt(min+t*range)}</text></g>)}
    {bars?rows.map((r,i)=><rect key={i} x={48+i*590/rows.length} width={Math.max(2,590/rows.length-5)} y={y(r[value])} height={Math.max(0,170-y(r[value]))} rx="2" fill="var(--cool)"><title>{date(r[label])}: {fmt(r[value])} {unit}</title></rect>):<><path d={`M ${x(0)} 170 ${values.map((v,i)=>`L ${x(i)} ${y(v)}`).join(' ')} L ${x(values.length-1)} 170 Z`} fill="var(--cool)" opacity=".08"/><polyline points={values.map((v,i)=>`${x(i)},${y(v)}`).join(' ')} fill="none" stroke="var(--cool)" strokeWidth="2.5"/>{values.map((v,i)=><circle key={i} cx={x(i)} cy={y(v)} r="3" fill="var(--cool)"><title>{date(rows[i][label])}: {fmt(v)} {unit}</title></circle>)}</>}
    <text x="48" y="199">{date(rows[0][label])}</text><text x="645" y="199" textAnchor="end">{date(rows.at(-1)[label])}</text>
  </svg><div className="chart-caption"><span><i/> {unit}</span><span>{rows.length} registros</span></div></div>;
}
export function Field({label,children,...props}){return <label className="field"><span>{label}</span>{children||<input {...props}/>}</label>;}
export function Panel({title,aside,children,className=''}){return <section className={`panel ${className}`}><div className="section-heading"><h2>{title}</h2>{aside}</div>{children}</section>;}
