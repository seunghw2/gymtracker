import * as SQLite from 'expo-sqlite';
import { CREATE_TABLES } from './schema';
import { SEED_EXERCISES } from '../constants/exercises';

let db: SQLite.SQLiteDatabase | null = null;

export async function getDb(): Promise<SQLite.SQLiteDatabase> {
  if (!db) {
    db = await SQLite.openDatabaseAsync('gymtracker.db');
    await db.execAsync('PRAGMA journal_mode = WAL;');
    await db.execAsync(CREATE_TABLES);
    await seedIfNeeded(db);
  }
  return db;
}

async function seedIfNeeded(database: SQLite.SQLiteDatabase) {
  const row = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM exercise_master WHERE is_system = 1'
  );
  if (row && row.count > 0) return;

  for (const ex of SEED_EXERCISES) {
    await database.runAsync(
      'INSERT INTO exercise_master (name, muscle_group, equipment_type, brand, is_system, is_custom) VALUES (?, ?, ?, ?, ?, ?)',
      [ex.name, ex.muscle_group, ex.equipment_type, ex.brand ?? null, ex.is_system, ex.is_custom]
    );
  }
}

export type Exercise = {
  id: number;
  name: string;
  muscle_group: string;
  equipment_type: string;
  brand: string | null;
  note: string | null;
  is_system: number;
  is_custom: number;
};

export type WorkoutSession = {
  id: number;
  date: string;
  gym_id: number | null;
  duration_sec: number | null;
  note: string | null;
};

export type WorkoutSet = {
  id: number;
  session_id: number;
  exercise_id: number;
  set_order: number;
  weight_kg: number;
  reps: number;
  estimated_1rm: number | null;
  created_at: string;
};

export type BodyLog = {
  id: number;
  date: string;
  weight_kg: number | null;
  body_fat_pct: number | null;
};

export type Gym = {
  id: number;
  name: string;
  location: string | null;
};

export async function getExercises(muscle_group?: string, equipment_type?: string, brand?: string): Promise<Exercise[]> {
  const database = await getDb();
  let query = 'SELECT * FROM exercise_master WHERE 1=1';
  const params: (string | number | null)[] = [];

  if (muscle_group) { query += ' AND muscle_group = ?'; params.push(muscle_group); }
  if (equipment_type) { query += ' AND equipment_type = ?'; params.push(equipment_type); }
  if (brand) { query += ' AND brand = ?'; params.push(brand); }

  query += ' ORDER BY is_system DESC, name ASC';
  return database.getAllAsync<Exercise>(query, params);
}

export async function addCustomExercise(name: string, muscle_group: string, equipment_type: string, brand?: string): Promise<number> {
  const database = await getDb();
  const result = await database.runAsync(
    'INSERT INTO exercise_master (name, muscle_group, equipment_type, brand, is_system, is_custom) VALUES (?, ?, ?, ?, 0, 1)',
    [name, muscle_group, equipment_type, brand ?? null]
  );
  return result.lastInsertRowId;
}

export async function deleteCustomExercise(id: number): Promise<void> {
  const database = await getDb();
  await database.runAsync('DELETE FROM exercise_master WHERE id = ? AND is_custom = 1', [id]);
}

export async function createWorkoutSession(date: string, gym_id?: number): Promise<number> {
  const database = await getDb();
  const result = await database.runAsync(
    'INSERT INTO workout_session (date, gym_id) VALUES (?, ?)',
    [date, gym_id ?? null]
  );
  return result.lastInsertRowId;
}

export async function updateSessionDuration(sessionId: number, duration_sec: number): Promise<void> {
  const database = await getDb();
  await database.runAsync(
    'UPDATE workout_session SET duration_sec = ? WHERE id = ?',
    [duration_sec, sessionId]
  );
}

export async function addWorkoutSet(
  session_id: number,
  exercise_id: number,
  set_order: number,
  weight_kg: number,
  reps: number,
  estimated_1rm: number
): Promise<number> {
  const database = await getDb();
  const result = await database.runAsync(
    'INSERT INTO workout_set (session_id, exercise_id, set_order, weight_kg, reps, estimated_1rm) VALUES (?, ?, ?, ?, ?, ?)',
    [session_id, exercise_id, set_order, weight_kg, reps, estimated_1rm]
  );
  return result.lastInsertRowId;
}

export async function getLastSessionSets(exercise_id: number): Promise<WorkoutSet[]> {
  const database = await getDb();
  const lastSession = await database.getFirstAsync<{ session_id: number }>(
    `SELECT session_id FROM workout_set WHERE exercise_id = ? ORDER BY created_at DESC LIMIT 1`,
    [exercise_id]
  );
  if (!lastSession) return [];
  return database.getAllAsync<WorkoutSet>(
    'SELECT * FROM workout_set WHERE session_id = ? AND exercise_id = ? ORDER BY set_order ASC',
    [lastSession.session_id, exercise_id]
  );
}

export async function getWeeklyWorkoutCount(startDate: string, endDate: string): Promise<number> {
  const database = await getDb();
  const row = await database.getFirstAsync<{ count: number }>(
    'SELECT COUNT(*) as count FROM workout_session WHERE date >= ? AND date <= ?',
    [startDate, endDate]
  );
  return row?.count ?? 0;
}

export async function getWorkoutDates(year: number, month: number): Promise<string[]> {
  const database = await getDb();
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const end = `${year}-${String(month).padStart(2, '0')}-31`;
  const rows = await database.getAllAsync<{ date: string }>(
    'SELECT DISTINCT date FROM workout_session WHERE date >= ? AND date <= ? ORDER BY date',
    [start, end]
  );
  return rows.map(r => r.date);
}

export async function getAllWorkoutDates(): Promise<string[]> {
  const database = await getDb();
  const rows = await database.getAllAsync<{ date: string }>(
    'SELECT DISTINCT date FROM workout_session ORDER BY date DESC'
  );
  return rows.map(r => r.date);
}

export async function getMonthStats(year: number, month: number): Promise<{ count: number; totalSec: number }> {
  const database = await getDb();
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const end = `${year}-${String(month).padStart(2, '0')}-31`;
  const row = await database.getFirstAsync<{ count: number; totalSec: number }>(
    'SELECT COUNT(*) as count, COALESCE(SUM(duration_sec), 0) as totalSec FROM workout_session WHERE date >= ? AND date <= ?',
    [start, end]
  );
  return { count: row?.count ?? 0, totalSec: row?.totalSec ?? 0 };
}

export async function getTodayBodyLog(date: string): Promise<BodyLog | null> {
  const database = await getDb();
  return database.getFirstAsync<BodyLog>('SELECT * FROM body_log WHERE date = ?', [date]);
}

export async function getLatestBodyLog(): Promise<BodyLog | null> {
  const database = await getDb();
  return database.getFirstAsync<BodyLog>('SELECT * FROM body_log ORDER BY date DESC LIMIT 1');
}

export async function upsertBodyLog(date: string, weight_kg: number, body_fat_pct?: number): Promise<void> {
  const database = await getDb();
  await database.runAsync(
    `INSERT INTO body_log (date, weight_kg, body_fat_pct) VALUES (?, ?, ?)
     ON CONFLICT(date) DO UPDATE SET weight_kg = excluded.weight_kg, body_fat_pct = COALESCE(excluded.body_fat_pct, body_fat_pct)`,
    [date, weight_kg, body_fat_pct ?? null]
  );
}

export async function getBodyLogs(limit = 30): Promise<BodyLog[]> {
  const database = await getDb();
  return database.getAllAsync<BodyLog>('SELECT * FROM body_log ORDER BY date DESC LIMIT ?', [limit]);
}

export async function get1RMHistory(exercise_id: number): Promise<{ date: string; estimated_1rm: number }[]> {
  const database = await getDb();
  return database.getAllAsync<{ date: string; estimated_1rm: number }>(
    `SELECT ws.date, MAX(wset.estimated_1rm) as estimated_1rm
     FROM workout_set wset
     JOIN workout_session ws ON ws.id = wset.session_id
     WHERE wset.exercise_id = ? AND wset.estimated_1rm IS NOT NULL
     GROUP BY ws.date
     ORDER BY ws.date ASC`,
    [exercise_id]
  );
}

export async function getSetting(key: string, defaultValue: string): Promise<string> {
  const database = await getDb();
  const row = await database.getFirstAsync<{ value: string }>(
    'SELECT value FROM app_settings WHERE key = ?', [key]
  );
  return row?.value ?? defaultValue;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const database = await getDb();
  await database.runAsync(
    'INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, value]
  );
}

export async function getGyms(): Promise<Gym[]> {
  const database = await getDb();
  return database.getAllAsync<Gym>('SELECT * FROM gym ORDER BY name ASC');
}

export async function addGym(name: string, location?: string): Promise<number> {
  const database = await getDb();
  const result = await database.runAsync(
    'INSERT INTO gym (name, location) VALUES (?, ?)',
    [name, location ?? null]
  );
  return result.lastInsertRowId;
}

export async function deleteGym(id: number): Promise<void> {
  const database = await getDb();
  await database.runAsync('DELETE FROM gym WHERE id = ?', [id]);
}

export async function getCustomExercises(): Promise<Exercise[]> {
  const database = await getDb();
  return database.getAllAsync<Exercise>(
    'SELECT * FROM exercise_master WHERE is_custom = 1 ORDER BY name ASC'
  );
}
