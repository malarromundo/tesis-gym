import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
export const token = () => crypto.randomBytes(32).toString('base64url');
export function fail(status, message) { const e = new Error(message); e.status = status; throw e; }
export function str(value, field, max = 200) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) fail(400, `${field}: texto obligatorio (máximo ${max} caracteres)`);
  return value.trim();
}
export function num(value, field, min = 0, max = 100000, integer = false) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value)))
    fail(400, `${field}: debe ser ${integer ? 'un entero' : 'un número'} entre ${min} y ${max}`);
  return value;
}
export const id = value => { const n = Number(value); return num(n, 'id', 1, Number.MAX_SAFE_INTEGER, true); };
export function day(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0,10) !== value) fail(400, 'Fecha inválida: use YYYY-MM-DD');
  return value;
}
export function password(value) {
  if (typeof value !== 'string' || value.length < 8 || Buffer.byteLength(value) > 72) fail(400, 'La contraseña debe tener al menos 8 caracteres y como máximo 72 bytes');
  return value;
}
export const safeUser = u => { const {password_hash, ...publicFields} = u; return {...publicFields, active: !!u.active}; };
export function createUser(db, input, role = 'ATHLETE', trainer = null) {
  const name = str(input.name, 'name');
  const email = str(input.email, 'email', 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400, 'Email inválido');
  if (db.one('SELECT id FROM users WHERE email=?', [email])) fail(409, 'El email ya está registrado');
  const hash = bcrypt.hashSync(password(input.password), 12);
  const userId = db.transaction(() => db.run('INSERT INTO users(name,email,password_hash,role,trainer_id,share_token) VALUES(?,?,?,?,?,?)', [name,email,hash,role,trainer,token()]));
  return safeUser(db.one('SELECT * FROM users WHERE id=?',[userId]));
}
