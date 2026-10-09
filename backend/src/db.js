import initSqlJs from 'sql.js';
import fs from 'node:fs';
import path from 'node:path';

export async function openDatabase(directory) {
  fs.mkdirSync(directory, { recursive: true });
  const file = path.join(directory, 'rutinatrack.sqlite');
  const SQL = await initSqlJs();
  let db = new SQL.Database(fs.existsSync(file) ? fs.readFileSync(file) : undefined);
  db.run('PRAGMA foreign_keys = ON');
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL COLLATE NOCASE UNIQUE,
      password_hash TEXT NOT NULL, role TEXT NOT NULL CHECK(role IN ('ADMIN','TRAINER','ATHLETE')),
      trainer_id INTEGER REFERENCES users(id), active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
      share_token TEXT NOT NULL UNIQUE, created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      CHECK(trainer_id IS NULL OR role = 'ATHLETE')
    );
    CREATE TABLE IF NOT EXISTS exercises (
      id INTEGER PRIMARY KEY, name TEXT NOT NULL UNIQUE, muscle_group TEXT NOT NULL,
      description TEXT NOT NULL, image_url TEXT
    );
    CREATE TABLE IF NOT EXISTS routines (
      id INTEGER PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
      created_by_id INTEGER NOT NULL REFERENCES users(id), assigned_to_id INTEGER NOT NULL REFERENCES users(id),
      active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE TABLE IF NOT EXISTS routine_exercises (
      id INTEGER PRIMARY KEY, routine_id INTEGER NOT NULL REFERENCES routines(id),
      exercise_id INTEGER NOT NULL REFERENCES exercises(id), order_index INTEGER NOT NULL CHECK(order_index >= 0),
      target_sets INTEGER NOT NULL CHECK(typeof(target_sets) = 'integer' AND target_sets > 0),
      target_reps INTEGER NOT NULL CHECK(typeof(target_reps) = 'integer' AND target_reps BETWEEN 1 AND 20),
      target_weight REAL CHECK(target_weight >= 0), notes TEXT, UNIQUE(routine_id,order_index)
    );
    CREATE TABLE IF NOT EXISTS workout_sessions (
      id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), routine_id INTEGER REFERENCES routines(id),
      date TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      status TEXT NOT NULL DEFAULT 'IN_PROGRESS' CHECK(status IN ('IN_PROGRESS','COMPLETED')),
      notes TEXT, completed_at TEXT
    );
    CREATE TABLE IF NOT EXISTS session_sets (
      id INTEGER PRIMARY KEY, session_id INTEGER NOT NULL REFERENCES workout_sessions(id),
      exercise_id INTEGER NOT NULL REFERENCES exercises(id), routine_exercise_id INTEGER REFERENCES routine_exercises(id),
      set_number INTEGER NOT NULL CHECK(typeof(set_number) = 'integer' AND set_number > 0),
      reps INTEGER NOT NULL CHECK(typeof(reps) = 'integer' AND reps BETWEEN 1 AND 20),
      weight REAL NOT NULL CHECK(weight >= 0), rpe REAL CHECK(rpe BETWEEN 1 AND 10),
      completed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
    CREATE TABLE IF NOT EXISTS body_weight_logs (
      id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id), date TEXT NOT NULL,
      weight_kg REAL NOT NULL CHECK(weight_kg > 0), UNIQUE(user_id,date)
    );
    CREATE INDEX IF NOT EXISTS idx_users_trainer ON users(trainer_id);
    CREATE INDEX IF NOT EXISTS idx_routines_assigned ON routines(assigned_to_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_user_date ON workout_sessions(user_id,date);
    CREATE INDEX IF NOT EXISTS idx_sets_session ON session_sets(session_id);
    CREATE INDEX IF NOT EXISTS idx_sets_exercise ON session_sets(exercise_id);
    CREATE TRIGGER IF NOT EXISTS validate_trainer_insert BEFORE INSERT ON users
    WHEN NEW.trainer_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.trainer_id AND role='TRAINER')
    BEGIN SELECT RAISE(ABORT, 'trainer_id debe referenciar un entrenador'); END;
    CREATE TRIGGER IF NOT EXISTS validate_trainer_update BEFORE UPDATE ON users
    WHEN NEW.trainer_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.trainer_id AND role='TRAINER')
    BEGIN SELECT RAISE(ABORT, 'trainer_id debe referenciar un entrenador'); END;
    CREATE TRIGGER IF NOT EXISTS validate_assignment BEFORE INSERT ON routines
    WHEN NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.assigned_to_id AND role='ATHLETE')
    BEGIN SELECT RAISE(ABORT, 'La rutina debe asignarse a un atleta'); END;
  `);
  const all = (sql, params = []) => {
    const stmt = db.prepare(sql);
    try { stmt.bind(params); const rows = []; while (stmt.step()) rows.push(stmt.getAsObject()); return rows; }
    finally { stmt.free(); }
  };
  const one = (sql, params) => all(sql, params)[0];
  // sql.js export() reopens the database and resets connection PRAGMAs.
  const snapshot = () => { const bytes = db.export(); db.run('PRAGMA foreign_keys = ON'); return bytes; };
  const save = () => { const temp = file + '.tmp'; fs.writeFileSync(temp, snapshot()); fs.renameSync(temp, file); };
  const run = (sql, params = []) => { db.run(sql, params); return one('SELECT last_insert_rowid() AS id').id; };
  const transaction = (fn) => {
    const before = snapshot(); db.run('BEGIN');
    try { const result = fn(); db.run('COMMIT'); save(); return result; }
    catch (error) {
      // Restore memory as well if the disk write failed after COMMIT.
      db.close(); db = new SQL.Database(before); db.run('PRAGMA foreign_keys = ON');
      throw error;
    }
  };
  save();
  return { all, one, run, transaction, close: () => db.close(), file };
}
