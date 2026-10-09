import path from 'node:path';
import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
import bcrypt from 'bcryptjs';
import {openDatabase} from '../src/db.js';
import {token} from '../src/common.js';
import {EXERCISES} from './catalog.js';

export const ACCOUNTS = [
  {name:'Administrador Demo',email:'admin@demo.local',role:'ADMIN',password:'Admin123!'},
  {name:'Martín Entrenador',email:'entrenador@demo.local',role:'TRAINER',password:'Entrena123!'},
  {name:'Lucía Atleta',email:'lucia@demo.local',role:'ATHLETE',password:'Lucia123!'},
  {name:'Diego Atleta',email:'diego@demo.local',role:'ATHLETE',password:'Diego123!'},
];

export async function seed(directory, now = new Date()) {
  // Refuse any nonempty database: never overwrite real data or duplicate demos.
  const db=await openDatabase(directory);
  try {
    if(db.one('SELECT count(*) AS n FROM users').n || db.one('SELECT count(*) AS n FROM exercises').n)
      throw new Error('La base ya tiene datos. El seed requiere una carpeta nueva; no se borró ningún registro. Detenga su servidor antes de cargar datos.');
    const hashes=ACCOUNTS.map(a=>bcrypt.hashSync(a.password,12));
    // Nine complete weeks, ending last Sunday. No future sessions.
    const monday=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),now.getUTCDate()));
    monday.setUTCDate(monday.getUTCDate()-(monday.getUTCDay()+6)%7-63);
    const at=(offset,hour=18)=>{const d=new Date(monday);d.setUTCDate(d.getUTCDate()+offset);d.setUTCHours(hour,0,0,0);return d.toISOString();};
    db.transaction(()=>{
      const users=ACCOUNTS.map((a,i)=>db.run('INSERT INTO users(name,email,password_hash,role,trainer_id,share_token,created_at) VALUES(?,?,?,?,?,?,?)',[a.name,a.email,hashes[i],a.role,i>=2?2:null,token(),at(-1)]));
      const exercises=new Map(EXERCISES.map(([name,group,description])=>[name,db.run('INSERT INTO exercises(name,muscle_group,description) VALUES(?,?,?)',[name,group,description])]));
      const makeRoutine=(name,athlete,items)=>{
        const routine=db.run('INSERT INTO routines(name,description,created_by_id,assigned_to_id,created_at) VALUES(?,?,?,?,?)',[name,'Rutina de demostración para practicar el registro de series.',users[1],athlete,at(-1)]);
        const entries=items.map(([name,reps,weight],index)=>({exercise:exercises.get(name),reps,weight,id:db.run('INSERT INTO routine_exercises(routine_id,exercise_id,order_index,target_sets,target_reps,target_weight) VALUES(?,?,?,?,?,?)',[routine,exercises.get(name),index,3,reps,weight])}));
        return {routine,entries};
      };
      const lucia=makeRoutine('Fuerza general · Lucía',users[2],[['Sentadilla',10,50],['Press de banca',10,35],['Remo con barra',10,40],['Abdominales',15,0]]);
      makeRoutine('Inicio de fuerza · Diego',users[3],[['Prensa de piernas',12,60],['Press con mancuernas',10,12],['Jalón al pecho',12,30],['Curl martillo',12,8]]);
      for(let week=0;week<9;week++){
        for(const weekday of [0,2,4]){
          const offset=week*7+weekday;
          const session=db.run("INSERT INTO workout_sessions(user_id,routine_id,date,status,notes,completed_at) VALUES(?,?,?,'COMPLETED',?,?)",[users[2],lucia.routine,at(offset),'Historial sintético de demostración',at(offset,19)]);
          lucia.entries.forEach((e,index)=>{
            const weight=index===0?30+week*2.5:index===1?25+Math.floor(week/2)*2.5:index===2?30+Math.floor(week/2)*2.5:0;
            for(let set=1;set<=3;set++){
              const completed=new Date(at(offset));completed.setUTCMinutes(index*10+set*2);
              db.run('INSERT INTO session_sets(session_id,exercise_id,routine_exercise_id,set_number,reps,weight,rpe,completed_at) VALUES(?,?,?,?,?,?,?,?)',[session,e.exercise,e.id,set,e.reps,weight,6.5+(set-1)*0.5,completed.toISOString()]);
            }
          });
        }
        for(const weekday of [0,3])db.run('INSERT INTO body_weight_logs(user_id,date,weight_kg) VALUES(?,?,?)',[users[2],at(week*7+weekday).slice(0,10),Math.round((72-week*0.15+(weekday===3?0.1:0))*10)/10]);
      }
    });
    return Object.fromEntries(['users','exercises','routines','routine_exercises','workout_sessions','session_sets','body_weight_logs'].map(table=>[table,db.one(`SELECT count(*) AS n FROM ${table}`).n]));
  } finally {db.close();}
}

if(process.argv[1] && import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
  if(process.env.NODE_ENV==='production')throw new Error('El seed de demostración no está habilitado en producción.');
  const directory=process.env.SEED_DATA_DIR||path.resolve('data-demo');
  const counts=await seed(directory);
  console.log('Seed completado:',directory);console.table(counts);
  console.table(ACCOUNTS.map(({role,email,password})=>({rol:role,email,contraseña:password})));
  fs.writeFileSync(path.join(directory,'accesos-demo.txt'),ACCOUNTS.map(a=>`${a.role}: ${a.email} / ${a.password}`).join('\n')+'\n');
}


