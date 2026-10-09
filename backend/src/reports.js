import express from 'express';
import { day, id, fail } from './common.js';

export function mountReports(app,{db,auth,roles,athleteAccess}) {
  const router=express.Router(); router.use(auth);
  const range=query=>{
    const to=day(query.to||new Date().toISOString().slice(0,10));
    const from=day(query.from||new Date(Date.parse(to)-83*86400000).toISOString().slice(0,10));
    if(from>to)fail(400,'from debe ser anterior o igual a to');
    if(Date.parse(to)-Date.parse(from)>3660*86400000)fail(400,'El rango máximo del reporte es de 3660 días');
    return {from,to};
  };
  const progress=req=>{
    const athlete=athleteAccess(req.user,req.query.athlete_id??req.user.id);
    const {from,to}=range(req.query);
    const args=[athlete.id,from,to];
    const weekly_volume=db.all(`SELECT date(s.date, '-' || ((CAST(strftime('%w',s.date) AS INTEGER)+6)%7) || ' days') AS week,
      sum(ss.weight*ss.reps) AS volume_kg_reps
      FROM workout_sessions s JOIN session_sets ss ON ss.session_id=s.id
      WHERE s.user_id=? AND s.status='COMPLETED' AND s.date>=? AND s.date<date(?,'+1 day') GROUP BY week ORDER BY week`,args);
    // Include empty weeks so charts do not conceal gaps in training.
    const volumeMap=new Map(weekly_volume.map(row=>[row.week,row.volume_kg_reps]));
    const cursor=new Date(from+'T00:00:00Z');cursor.setUTCDate(cursor.getUTCDate()-(cursor.getUTCDay()+6)%7);
    const weeks=[];
    while(cursor.toISOString().slice(0,10)<=to){const week=cursor.toISOString().slice(0,10);weeks.push({week,volume_kg_reps:volumeMap.get(week)||0});cursor.setUTCDate(cursor.getUTCDate()+7);}
    const exercise=req.query.exercise_id==null?null:id(req.query.exercise_id);
    const max_weight=db.all(`SELECT ss.exercise_id,e.name,date(s.date) AS date,max(ss.weight) AS max_weight_kg
      FROM session_sets ss JOIN workout_sessions s ON s.id=ss.session_id JOIN exercises e ON e.id=ss.exercise_id
      WHERE s.user_id=? AND s.status='COMPLETED' AND s.date>=? AND s.date<date(?,'+1 day') ${exercise?'AND ss.exercise_id=?':''}
      GROUP BY ss.exercise_id,date(s.date) ORDER BY date,ss.exercise_id`,[...args,...(exercise?[exercise]:[])]);
    const body_weight=db.all('SELECT date,weight_kg FROM body_weight_logs WHERE user_id=? AND date>=? AND date<=? ORDER BY date',args);
    const summary=db.one(`SELECT count(*) AS completed_sessions FROM workout_sessions WHERE user_id=? AND status='COMPLETED' AND date>=? AND date<date(?,'+1 day')`,args);
    return {athlete_id:athlete.id,from,to,...summary,weekly_volume:weeks,max_weight,body_weight};
  };
  const trainer=req=>{
    if(!['TRAINER','ADMIN'].includes(req.user.role))fail(403,'Reporte exclusivo para entrenadores y administradores');
    const rows=db.all(`SELECT u.id,u.name,u.active,
      count(s.id) AS completed_sessions,last_session.last_completed_at,
      COALESCE((SELECT sum(ss.weight*ss.reps) FROM session_sets ss JOIN workout_sessions ws ON ws.id=ss.session_id
        WHERE ws.user_id=u.id AND ws.status='COMPLETED' AND ws.date>=strftime('%Y-%m-%dT%H:%M:%fZ','now','-30 days')),0) AS volume_kg_reps
      FROM users u LEFT JOIN workout_sessions s ON s.user_id=u.id AND s.status='COMPLETED' AND s.date>=strftime('%Y-%m-%dT%H:%M:%fZ','now','-30 days')
      LEFT JOIN (SELECT user_id,max(completed_at) AS last_completed_at FROM workout_sessions WHERE status='COMPLETED' GROUP BY user_id) last_session ON last_session.user_id=u.id
      WHERE u.role='ATHLETE' ${req.user.role==='TRAINER'?'AND u.trainer_id=?':''} GROUP BY u.id ORDER BY u.name`,req.user.role==='TRAINER'?[req.user.id]:[]);
    return {period_days:30,athletes:rows.map(row=>({...row,activity_status:row.completed_sessions?'ACTIVE':'NO_ACTIVITY'}))};
  };
  const admin=req=>{
    if(req.user.role!=='ADMIN')fail(403,'Reporte exclusivo para administradores');
    const {from,to}=range(req.query);
    const rolesCount=db.all('SELECT role,count(*) AS total,sum(active) AS active FROM users GROUP BY role');
    const daily=db.all(`SELECT date(date) AS date,count(*) AS sessions FROM workout_sessions WHERE status='COMPLETED' AND date>=? AND date<date(?,'+1 day') GROUP BY date(date) ORDER BY date`,[from,to]);
    const counts=new Map(daily.map(r=>[r.date,r.sessions]));const sessions_per_day=[];
    const cursor=new Date(from+'T00:00:00Z');while(cursor.toISOString().slice(0,10)<=to){const date=cursor.toISOString().slice(0,10);sessions_per_day.push({date,sessions:counts.get(date)||0});cursor.setUTCDate(cursor.getUTCDate()+1);}
    return {from,to,users_by_role:['ADMIN','TRAINER','ATHLETE'].map(role=>rolesCount.find(r=>r.role===role)||{role,total:0,active:0}),sessions_per_day,
      most_active_athletes:db.all(`SELECT u.id,u.name,count(s.id) AS completed_sessions FROM users u JOIN workout_sessions s ON s.user_id=u.id
        WHERE u.role='ATHLETE' AND s.status='COMPLETED' AND s.date>=? AND s.date<date(?,'+1 day') GROUP BY u.id ORDER BY completed_sessions DESC,u.id LIMIT 10`,[from,to])};
  };
  router.get('/progress',(req,res)=>res.json(progress(req)));
  router.get('/trainer',roles('TRAINER','ADMIN'),(req,res)=>res.json(trainer(req)));
  router.get('/admin',roles('ADMIN'),(req,res)=>res.json(admin(req)));
  router.get('/export',(req,res)=>{
    const type=req.query.type;
    if(!['progress','trainer','admin'].includes(type))fail(400,'type debe ser progress, trainer o admin');
    const report=({progress,trainer,admin}[type])(req);
    const rows=[['section','record','field','value']];
    for(const [section,value] of Object.entries(report)){
      if(Array.isArray(value))value.forEach((record,index)=>Object.entries(record).forEach(([field,cell])=>rows.push([section,index+1,field,cell])));
      else rows.push(['metadata','',section,value]);
    }
    const cell=value=>{let s=value==null?'':String(value);if(/^[\s]*[=+\-@]/.test(s))s="'"+s;return '"'+s.replaceAll('"','""')+'"';};
    res.set({'Content-Type':'text/csv; charset=utf-8','Content-Disposition':`attachment; filename="rutinatrack-${type}.csv"`});
    res.send('\uFEFF'+rows.map(row=>row.map(cell).join(',')).join('\r\n'));
  });
  app.use('/api/reports',router);
}
