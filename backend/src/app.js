import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { openDatabase } from './db.js';
import { createUser, safeUser, token, fail, str, num, id, day, password } from './common.js';
import { mountReports } from './reports.js';

export async function createApp({ dataDir = process.env.DATA_DIR || path.resolve('data'), secret, publicDir = process.env.PUBLIC_DIR || path.resolve('public'), serverMode = 'standalone' } = {}) {
  const db = await openDatabase(dataDir);
  if (!secret) {
    const secretPath = path.join(dataDir, 'jwt-secret');
    if (!fs.existsSync(secretPath)) fs.writeFileSync(secretPath, token(), { mode: 0o600, flag: 'wx' });
    secret = fs.readFileSync(secretPath, 'utf8').trim();
  }
  const app = express();
  app.disable('x-powered-by');
  const allowedOrigins = new Set(['https://localhost','capacitor://localhost','http://localhost:3131',...(process.env.CORS_ORIGINS||'').split(',').filter(Boolean)]);
  app.use((req,res,next)=>{
    const origin=req.headers.origin;
    if(origin && allowedOrigins.has(origin))res.set({'Access-Control-Allow-Origin':origin,'Vary':'Origin','Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Allow-Methods':'GET, POST, PUT, PATCH, DELETE, OPTIONS'});
    if(req.method==='OPTIONS')return res.sendStatus(allowedOrigins.has(origin)?204:403);
    next();
  });
  app.use((_req, res, next) => {
    res.set({ 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Cache-Control': 'no-store' }); next();
  });
  app.use(express.json({ limit: '100kb' }));
  app.use((req, _res, next) => {
    if (['POST','PATCH','PUT'].includes(req.method)) {
      if (req.body === undefined) req.body = {};
      if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) fail(400,'El cuerpo debe ser un objeto JSON');
    }
    next();
  });
  const roles = (...allowed) => (req, _res, next) => { if (!allowed.includes(req.user.role)) fail(403, 'No tiene permisos para esta acción'); next(); };
  const auth = (req, _res, next) => {
    const header = req.headers.authorization || '';
    let payload;
    try { payload = jwt.verify(header.startsWith('Bearer ') ? header.slice(7) : '', secret, { algorithms: ['HS256'], issuer: 'rutinatrack', audience: 'rutinatrack' }); }
    catch { fail(401, 'Sesión inválida o vencida'); }
    const user = db.one('SELECT * FROM users WHERE id=?', [payload.sub]);
    if (!user || !user.active) fail(401, 'Usuario inactivo o inexistente');
    req.user = user; next();
  };
  const requireUser = userId => { const user = db.one('SELECT * FROM users WHERE id=?', [id(userId)]); if (!user) fail(404, 'Usuario no encontrado'); return user; };
  const athleteAccess = (viewer, userId) => {
    const user = requireUser(userId);
    if (user.role !== 'ATHLETE') fail(404, 'Atleta no encontrado');
    if (viewer.role !== 'ADMIN' && viewer.id !== user.id && !(viewer.role === 'TRAINER' && user.trainer_id === viewer.id)) fail(404, 'Atleta no encontrado');
    return user;
  };
  const assignment = (viewer, userId) => {
    const athlete = athleteAccess(viewer, userId);
    if (!athlete.active) fail(400, 'El atleta está desactivado');
    return athlete.id;
  };
  const trainerId = value => {
    if (value == null) return null;
    const trainer = requireUser(value);
    if (trainer.role !== 'TRAINER' || !trainer.active) fail(400, 'trainer_id debe indicar un entrenador activo');
    return trainer.id;
  };
  const routineAccess = (viewer, routineId, edit = false) => {
    const r = db.one('SELECT * FROM routines WHERE id=?', [id(routineId)]);
    if (!r) fail(404, 'Rutina no encontrada');
    if (viewer.role === 'ADMIN') return r;
    if (viewer.role === 'ATHLETE' && (r.created_by_id === viewer.id || (!edit && r.assigned_to_id === viewer.id))) return r;
    if (viewer.role === 'TRAINER' && (!edit || r.created_by_id === viewer.id)) {
      athleteAccess(viewer, r.assigned_to_id); return r;
    }
    fail(404, 'Rutina no encontrada');
  };
  const routineDetail = routine => ({ ...routine, active: !!routine.active, exercises: db.all(`SELECT re.*, e.name, e.muscle_group, e.description, e.image_url
    FROM routine_exercises re JOIN exercises e ON e.id=re.exercise_id WHERE re.routine_id=? ORDER BY re.order_index`, [routine.id]) });
  const sessionAccess = (viewer, sessionId, edit = false) => {
    const s = db.one('SELECT * FROM workout_sessions WHERE id=?', [id(sessionId)]);
    if (!s) fail(404, 'Sesión no encontrada');
    athleteAccess(viewer, s.user_id);
    if (edit && (viewer.role !== 'ATHLETE' || viewer.id !== s.user_id)) fail(403, 'Solo el atleta puede registrar su entrenamiento');
    if (edit && s.status !== 'IN_PROGRESS') fail(409, 'La sesión ya está completada');
    return s;
  };
  const exerciseExists = value => { const exerciseId = id(value); if (!db.one('SELECT id FROM exercises WHERE id=?', [exerciseId])) fail(400, 'Ejercicio inexistente'); return exerciseId; };
  const pagination = req => ({ limit: req.query.limit === undefined ? 50 : num(Number(req.query.limit), 'limit', 1, 100, true), offset: req.query.offset === undefined ? 0 : num(Number(req.query.offset), 'offset', 0, 1000000, true) });
  const dateFilters = (query, column, clauses, params) => {
    if (query.from) { clauses.push(`${column} >= ?`); params.push(day(query.from)); }
    if (query.to) { clauses.push(`${column} < date(?, '+1 day')`); params.push(day(query.to)); }
    if (query.from && query.to && query.from > query.to) fail(400, 'from debe ser anterior o igual a to');
  };
  // A bounded, in-memory rate limiter; no timers are left running when embedded.
  const attempts = new Map();
  app.use('/api/auth', (req, res, next) => {
    if (!['/login', '/register'].includes(req.path)) return next();
    const now = Date.now();
    for (const [key, entry] of attempts) if (entry.until <= now) attempts.delete(key);
    const key = req.ip;
    if (!attempts.has(key) && attempts.size >= 10000) return res.status(429).json({ error: 'Intente nuevamente más tarde' });
    const entry = attempts.get(key) || { count: 0, until: now + 15 * 60 * 1000 };
    attempts.set(key, entry); entry.count++;
    if (entry.count > 30) { res.set('Retry-After', String(Math.ceil((entry.until-now)/1000))); return res.status(429).json({ error: 'Demasiados intentos; espere 15 minutos' }); }
    next();
  });
  app.get('/api/health', (_req, res) => res.json({ status: 'ok', application: 'RutinaTrack', api_version: 1 }));
  const authRouter = express.Router();
  authRouter.post('/register', (req,res) => {
    if (req.body.role !== undefined && req.body.role !== 'ATHLETE') fail(400, 'El registro público solo permite el rol ATHLETE');
    if (req.body.trainer_id != null) fail(400, 'Solo un administrador puede asignar entrenador');
    res.status(201).json(createUser(db, req.body));
  });
  authRouter.post('/login', (req,res) => {
    const email = str(req.body.email, 'email', 254).toLowerCase();
    const pass = password(req.body.password);
    const user = db.one('SELECT * FROM users WHERE email=?', [email]);
    if (!user || !user.active || !bcrypt.compareSync(pass, user.password_hash)) fail(401, 'Email o contraseña incorrectos');
    res.json({ token: jwt.sign({ role: user.role }, secret, { subject: String(user.id), expiresIn: '8h', algorithm: 'HS256', issuer: 'rutinatrack', audience: 'rutinatrack' }), user: safeUser(user) });
  });
  authRouter.get('/me', auth, (req,res) => res.json(safeUser(req.user)));
  authRouter.patch('/password', auth, (req,res) => {
    if (!bcrypt.compareSync(password(req.body.current_password), req.user.password_hash)) fail(400, 'La contraseña actual es incorrecta');
    const hash = bcrypt.hashSync(password(req.body.new_password),12);
    db.transaction(() => db.run('UPDATE users SET password_hash=? WHERE id=?',[hash,req.user.id])); res.sendStatus(204);
  });
  app.use('/api/auth', authRouter);

  const users = express.Router(); users.use(auth);
  users.get('/', roles('ADMIN'), (req,res) => {
    const p = pagination(req); const clauses = ['1=1']; const args = [];
    if (req.query.role) { if (!['ADMIN','TRAINER','ATHLETE'].includes(req.query.role)) fail(400,'Rol inválido'); clauses.push('role=?'); args.push(req.query.role); }
    res.json(db.all(`SELECT * FROM users WHERE ${clauses.join(' AND ')} ORDER BY id LIMIT ? OFFSET ?`, [...args,p.limit,p.offset]).map(safeUser));
  });
  users.get('/athletes', roles('TRAINER','ADMIN'), (req,res) => {
    const p = pagination(req); res.json(db.all(`SELECT * FROM users WHERE role='ATHLETE' ${req.user.role==='TRAINER'?'AND trainer_id=?':''} ORDER BY name LIMIT ? OFFSET ?`, [...(req.user.role==='TRAINER'?[req.user.id]:[]),p.limit,p.offset]).map(safeUser));
  });
  users.post('/', roles('ADMIN'), (req,res) => {
    const role = req.body.role;
    if (!['ADMIN','TRAINER','ATHLETE'].includes(role)) fail(400, 'Rol inválido');
    if (role !== 'ATHLETE' && req.body.trainer_id != null) fail(400,'Solo un atleta puede tener entrenador');
    res.status(201).json(createUser(db,req.body,role,trainerId(req.body.trainer_id)));
  });
  users.post('/me/share-token/rotate', (req,res) => {
    const value = token(); db.transaction(() => db.run('UPDATE users SET share_token=? WHERE id=?',[value,req.user.id])); res.json({share_token:value});
  });
  users.get('/:id', (req,res) => {
    const user = requireUser(req.params.id);
    if (user.id !== req.user.id && req.user.role !== 'ADMIN') athleteAccess(req.user,user.id);
    res.json(safeUser(user));
  });
  users.patch('/:id', roles('ADMIN'), (req,res) => {
    const user = requireUser(req.params.id);
    if (req.body.role !== undefined && req.body.role !== user.role) fail(400,'No se permite cambiar roles de cuentas existentes');
    const name = req.body.name === undefined ? user.name : str(req.body.name,'name');
    const email = req.body.email === undefined ? user.email : str(req.body.email,'email',254).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400,'Email inválido');
    const active = req.body.active === undefined ? !!user.active : req.body.active;
    if (typeof active !== 'boolean') fail(400,'active debe ser booleano');
    if (!active && user.role==='ADMIN' && db.one("SELECT count(*) AS n FROM users WHERE role='ADMIN' AND active=1").n<=1) fail(409,'No se puede desactivar al último administrador activo');
    const trainer = req.body.trainer_id === undefined ? user.trainer_id : trainerId(req.body.trainer_id);
    if (trainer != null && user.role !== 'ATHLETE') fail(400,'Solo un atleta puede tener entrenador');
    db.transaction(() => db.run('UPDATE users SET name=?,email=?,active=?,trainer_id=? WHERE id=?',[name,email,+active,trainer,user.id]));
    res.json(safeUser(requireUser(user.id)));
  });
  app.use('/api/users',users);

  const exercises = express.Router(); exercises.use(auth);
  exercises.get('/', (req,res) => {
    const p = pagination(req); const clauses=['1=1'],args=[];
    if (req.query.q) { clauses.push('name LIKE ?'); args.push(`%${str(req.query.q,'q')}%`); }
    if (req.query.muscle_group) { clauses.push('muscle_group=?'); args.push(str(req.query.muscle_group,'muscle_group')); }
    res.json(db.all(`SELECT * FROM exercises WHERE ${clauses.join(' AND ')} ORDER BY name LIMIT ? OFFSET ?`,[...args,p.limit,p.offset]));
  });
  exercises.get('/:id', (req,res) => { const e = db.one('SELECT * FROM exercises WHERE id=?',[id(req.params.id)]); if(!e) fail(404,'Ejercicio no encontrado'); res.json(e); });
  const exerciseInput = body => {
    if (body.image_url != null) fail(400,'Las imágenes están deshabilitadas en esta etapa');
    return [str(body.name,'name'),str(body.muscle_group,'muscle_group'),str(body.description,'description',4000),null];
  };
  exercises.post('/',roles('TRAINER','ADMIN'),(req,res) => { const values=exerciseInput(req.body); const key=db.transaction(()=>db.run('INSERT INTO exercises(name,muscle_group,description,image_url) VALUES(?,?,?,?)',values)); res.status(201).json(db.one('SELECT * FROM exercises WHERE id=?',[key])); });
  exercises.patch('/:id',roles('TRAINER','ADMIN'),(req,res) => {
    const key=exerciseExists(req.params.id); const old=db.one('SELECT * FROM exercises WHERE id=?',[key]);
    db.transaction(()=>db.run('UPDATE exercises SET name=?,muscle_group=?,description=?,image_url=? WHERE id=?',[...exerciseInput({...old,...req.body}),key])); res.json(db.one('SELECT * FROM exercises WHERE id=?',[key]));
  });
  exercises.delete('/:id',roles('TRAINER','ADMIN'),(req,res) => { const key=exerciseExists(req.params.id); db.transaction(()=>db.run('DELETE FROM exercises WHERE id=?',[key])); res.sendStatus(204); });
  app.use('/api/exercises',exercises);

  const routines = express.Router(); routines.use(auth);
  const routineExercises = input => {
    if (!Array.isArray(input) || input.length<1 || input.length>100) fail(400,'exercises debe contener entre 1 y 100 ejercicios');
    return input.map((e,index)=>[exerciseExists(e.exercise_id),index,num(e.target_sets,'target_sets',1,100,true),num(e.target_reps,'target_reps',1,20,true),e.target_weight==null?null:num(e.target_weight,'target_weight'),e.notes==null?null:str(e.notes,'notes',2000)]);
  };
  const insertExercises = (routineId,values) => { for (const e of values) db.run('INSERT INTO routine_exercises(routine_id,exercise_id,order_index,target_sets,target_reps,target_weight,notes) VALUES(?,?,?,?,?,?,?)',[routineId,...e]); };
  const newRoutine = (viewer,body) => {
    const assigned = assignment(viewer,viewer.role==='ATHLETE'?viewer.id:body.assigned_to_id);
    const values=routineExercises(body.exercises); const name=str(body.name,'name'); const description=body.description==null?'':str(body.description,'description',4000);
    const key=db.transaction(()=>{const key=db.run('INSERT INTO routines(name,description,created_by_id,assigned_to_id) VALUES(?,?,?,?)',[name,description,viewer.id,assigned]); insertExercises(key,values); return key;});
    return routineDetail(db.one('SELECT * FROM routines WHERE id=?',[key]));
  };
  routines.get('/',(req,res)=>{
    const p=pagination(req); let clause='1=1',args=[];
    if(req.user.role==='ATHLETE'){clause='(r.created_by_id=? OR r.assigned_to_id=?)';args=[req.user.id,req.user.id];}
    if(req.user.role==='TRAINER'){clause='u.trainer_id=?';args=[req.user.id];}
    if(req.query.athlete_id){const athlete=athleteAccess(req.user,req.query.athlete_id);clause+=' AND r.assigned_to_id=?';args.push(athlete.id);}
    res.json(db.all(`SELECT r.* FROM routines r JOIN users u ON u.id=r.assigned_to_id WHERE ${clause} ORDER BY r.id DESC LIMIT ? OFFSET ?`,[...args,p.limit,p.offset]));
  });
  routines.post('/',(req,res)=>res.status(201).json(newRoutine(req.user,req.body)));
  routines.get('/:id',(req,res)=>res.json(routineDetail(routineAccess(req.user,req.params.id))));
  routines.post('/:id/duplicate',(req,res)=>{
    const original=routineDetail(routineAccess(req.user,req.params.id));
    res.status(201).json(newRoutine(req.user,{...original,...req.body,name:req.body.name || `${original.name} (copia)`}));
  });
  routines.patch('/:id',(req,res)=>{
    const r=routineAccess(req.user,req.params.id,true);
    const used=!!db.one('SELECT id FROM workout_sessions WHERE routine_id=? LIMIT 1',[r.id]);
    if(used && ['name','description','exercises','assigned_to_id'].some(k=>req.body[k]!==undefined)) fail(409,'Esta rutina tiene sesiones; duplíquela para modificarla');
    const name=req.body.name===undefined?r.name:str(req.body.name,'name');
    const description=req.body.description===undefined?r.description:str(req.body.description,'description',4000);
    const active=req.body.active===undefined?!!r.active:req.body.active; if(typeof active!=='boolean') fail(400,'active debe ser booleano');
    const assigned=req.body.assigned_to_id===undefined?r.assigned_to_id:assignment(req.user,req.user.role==='ATHLETE'?req.user.id:req.body.assigned_to_id);
    const values=req.body.exercises===undefined?null:routineExercises(req.body.exercises);
    db.transaction(()=>{db.run('UPDATE routines SET name=?,description=?,active=?,assigned_to_id=? WHERE id=?',[name,description,+active,assigned,r.id]);if(values){db.run('DELETE FROM routine_exercises WHERE routine_id=?',[r.id]);insertExercises(r.id,values);}});
    res.json(routineDetail(db.one('SELECT * FROM routines WHERE id=?',[r.id])));
  });
  app.use('/api/routines',routines);

  const sessions=express.Router(); sessions.use(auth);
  sessions.get('/',(req,res)=>{
    const p=pagination(req),clauses=['1=1'],args=[];
    if(req.user.role==='ATHLETE'){clauses.push('s.user_id=?');args.push(req.user.id);}
    if(req.user.role==='TRAINER'){clauses.push('u.trainer_id=?');args.push(req.user.id);}
    if(req.query.athlete_id){clauses.push('s.user_id=?');args.push(athleteAccess(req.user,req.query.athlete_id).id);}
    if(req.query.status){if(!['IN_PROGRESS','COMPLETED'].includes(req.query.status))fail(400,'Estado inválido');clauses.push('s.status=?');args.push(req.query.status);}
    dateFilters(req.query,'s.date',clauses,args);
    res.json(db.all(`SELECT s.* FROM workout_sessions s JOIN users u ON u.id=s.user_id WHERE ${clauses.join(' AND ')} ORDER BY s.date DESC,s.id DESC LIMIT ? OFFSET ?`,[...args,p.limit,p.offset]));
  });
  sessions.post('/',roles('ATHLETE'),(req,res)=>{
    let routine=null;
    if(req.body.routine_id!=null){routine=routineAccess(req.user,req.body.routine_id);if(routine.assigned_to_id!==req.user.id || !routine.active)fail(403,'La rutina debe estar activa y asignada a usted');}
    const notes=req.body.notes==null?null:str(req.body.notes,'notes',4000);
    const key=db.transaction(()=>db.run('INSERT INTO workout_sessions(user_id,routine_id,notes) VALUES(?,?,?)',[req.user.id,routine?.id??null,notes]));
    res.status(201).json(db.one('SELECT * FROM workout_sessions WHERE id=?',[key]));
  });
  sessions.get('/:id',(req,res)=>{const s=sessionAccess(req.user,req.params.id);res.json({...s,sets:db.all('SELECT ss.*,e.name,e.description FROM session_sets ss JOIN exercises e ON e.id=ss.exercise_id WHERE session_id=? ORDER BY ss.id',[s.id])});});
  sessions.patch('/:id',(req,res)=>{const s=sessionAccess(req.user,req.params.id,true);const notes=req.body.notes==null?null:str(req.body.notes,'notes',4000);db.transaction(()=>db.run('UPDATE workout_sessions SET notes=? WHERE id=?',[notes,s.id]));res.json(db.one('SELECT * FROM workout_sessions WHERE id=?',[s.id]));});
  const setInput=(s,body)=>{
    const exerciseId=exerciseExists(body.exercise_id); let re=null;
    if(s.routine_id!=null){
      if(body.routine_exercise_id==null)fail(400,'routine_exercise_id es obligatorio en una sesión con rutina');
      re=db.one('SELECT * FROM routine_exercises WHERE id=? AND routine_id=? AND exercise_id=?',[id(body.routine_exercise_id),s.routine_id,exerciseId]);
      if(!re)fail(400,'El ejercicio no pertenece a la rutina de esta sesión');
    }else if(body.routine_exercise_id!=null)fail(400,'Una sesión libre no admite routine_exercise_id');
    return [exerciseId,re?.id??null,num(body.set_number,'set_number',1,1000,true),num(body.reps,'reps',1,20,true),num(body.weight,'weight'),body.rpe==null?null:num(body.rpe,'rpe',1,10)];
  };
  sessions.post('/:id/sets',(req,res)=>{const s=sessionAccess(req.user,req.params.id,true);const values=setInput(s,req.body);const key=db.transaction(()=>db.run('INSERT INTO session_sets(session_id,exercise_id,routine_exercise_id,set_number,reps,weight,rpe) VALUES(?,?,?,?,?,?,?)',[s.id,...values]));res.status(201).json(db.one('SELECT * FROM session_sets WHERE id=?',[key]));});
  sessions.patch('/:id/sets/:setId',(req,res)=>{const s=sessionAccess(req.user,req.params.id,true);const old=db.one('SELECT * FROM session_sets WHERE id=? AND session_id=?',[id(req.params.setId),s.id]);if(!old)fail(404,'Serie no encontrada');const values=setInput(s,{...old,...req.body});db.transaction(()=>db.run('UPDATE session_sets SET exercise_id=?,routine_exercise_id=?,set_number=?,reps=?,weight=?,rpe=? WHERE id=?',[...values,old.id]));res.json(db.one('SELECT * FROM session_sets WHERE id=?',[old.id]));});
  sessions.delete('/:id/sets/:setId',(req,res)=>{const s=sessionAccess(req.user,req.params.id,true);const old=db.one('SELECT id FROM session_sets WHERE id=? AND session_id=?',[id(req.params.setId),s.id]);if(!old)fail(404,'Serie no encontrada');db.transaction(()=>db.run('DELETE FROM session_sets WHERE id=?',[old.id]));res.sendStatus(204);});
  sessions.post('/:id/complete',(req,res)=>{const s=sessionAccess(req.user,req.params.id,true);db.transaction(()=>db.run("UPDATE workout_sessions SET status='COMPLETED',completed_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=?",[s.id]));res.json(db.one('SELECT * FROM workout_sessions WHERE id=?',[s.id]));});
  app.use('/api/sessions',sessions);

  const bodyweight=express.Router();bodyweight.use(auth);
  bodyweight.get('/',(req,res)=>{const athlete=athleteAccess(req.user,req.query.athlete_id??req.user.id);const clauses=['user_id=?'],args=[athlete.id];dateFilters(req.query,'date',clauses,args);res.json(db.all(`SELECT * FROM body_weight_logs WHERE ${clauses.join(' AND ')} ORDER BY date`,args));});
  bodyweight.put('/:date',roles('ATHLETE'),(req,res)=>{const date=day(req.params.date),weight=num(req.body.weight_kg,'weight_kg',0.1,1000);db.transaction(()=>db.run('INSERT INTO body_weight_logs(user_id,date,weight_kg) VALUES(?,?,?) ON CONFLICT(user_id,date) DO UPDATE SET weight_kg=excluded.weight_kg',[req.user.id,date,weight]));res.json(db.one('SELECT * FROM body_weight_logs WHERE user_id=? AND date=?',[req.user.id,date]));});
  bodyweight.delete('/:date',roles('ATHLETE'),(req,res)=>{db.transaction(()=>db.run('DELETE FROM body_weight_logs WHERE user_id=? AND date=?',[req.user.id,day(req.params.date)]));res.sendStatus(204);});
  app.use('/api/bodyweight',bodyweight);
  app.get('/api/server',auth,roles('ADMIN'),(req,res)=>{
    const addresses=Object.entries(os.networkInterfaces()).flatMap(([name,items])=>items.filter(a=>a.family==='IPv4'&&!a.internal&&!/virtualbox|vmware|default switch/i.test(name)&&!/^0[8a]:00:27|^00:15:5d|^00:50:56/i.test(a.mac)).map(a=>a.address));
    res.json({status:'ONLINE',mode:serverMode,port:req.socket.localPort,public_origin:process.env.PUBLIC_ORIGIN||null,local_origins:addresses.map(ip=>`http://${ip}:${req.socket.localPort}`),uptime_seconds:Math.floor(process.uptime()),active_users:db.one('SELECT count(*) AS n FROM users WHERE active=1').n,in_progress_sessions:db.one("SELECT count(*) AS n FROM workout_sessions WHERE status='IN_PROGRESS'").n});
  });
  app.get('/api/public/connection',auth,(req,res)=>{
    const addresses=Object.entries(os.networkInterfaces()).flatMap(([name,items])=>items.filter(a=>a.family==='IPv4'&&!a.internal&&!/virtualbox|vmware|default switch/i.test(name)&&!/^0[8a]:00:27|^00:15:5d|^00:50:56/i.test(a.mac)).map(a=>a.address));
    const ip=addresses.find(a=>a.startsWith('192.168.'))||addresses.find(a=>a.startsWith('10.'))||addresses.find(a=>/^172\.(1[6-9]|2\d|3[01])\./.test(a));
    const configured=process.env.PUBLIC_ORIGIN;
    res.json({origin:configured|| (ip?`http://${ip}:${req.socket.localPort}`:null),addresses});
  });
  mountReports(app,{db,auth,roles,athleteAccess});
  app.get('/public/share/:token',(req,res)=>{
    if(!/^[A-Za-z0-9_-]{43}$/.test(req.params.token))fail(404,'Enlace no encontrado');
    const user=db.one('SELECT id,name FROM users WHERE share_token=? AND active=1',[req.params.token]);if(!user)fail(404,'Enlace no encontrado');
    const shared=db.all('SELECT id,name,description FROM routines WHERE assigned_to_id=? AND active=1',[user.id]).map(r=>({name:r.name,description:r.description,exercises:db.all(`SELECT e.name,e.muscle_group,e.description,re.order_index,re.target_sets,re.target_reps,re.target_weight FROM routine_exercises re JOIN exercises e ON e.id=re.exercise_id WHERE re.routine_id=? ORDER BY re.order_index`,[r.id])}));
    res.json({name:user.name,routines:shared});
  });
  app.use('/api',(_req,res)=>res.status(404).json({error:'Endpoint no encontrado'}));
  if(fs.existsSync(path.join(publicDir,'index.html'))){app.use(express.static(publicDir));app.get('/{*path}',(_req,res)=>res.sendFile(path.join(publicDir,'index.html')));}
  app.use((_req,res)=>res.status(404).json({error:'Endpoint no encontrado'}));
  app.use((err,_req,res,_next)=>{
    let status=err.status||500,message=err.message;
    if(/UNIQUE constraint failed/.test(message)){status=409;message='El registro ya existe';}
    if(/FOREIGN KEY constraint failed/.test(message)){status=409;message='El registro está en uso o referencia datos inexistentes';}
    if(/CHECK constraint failed/.test(message)){status=400;message='Los datos no cumplen las restricciones de la base';}
    if(status>=500){console.error(err);message='Error interno del servidor';}
    res.status(status).json({error:message});
  });
  return {app,db};
}
