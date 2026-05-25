export const CREATE_TABLES = `
CREATE TABLE IF NOT EXISTS exercise_master (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  muscle_group TEXT NOT NULL,
  equipment_type TEXT NOT NULL,
  brand TEXT,
  note TEXT,
  is_system INTEGER DEFAULT 0,
  is_custom INTEGER DEFAULT 0,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS gym (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  location TEXT
);

CREATE TABLE IF NOT EXISTS gym_equipment (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  gym_id INTEGER REFERENCES gym(id),
  exercise_id INTEGER REFERENCES exercise_master(id)
);

CREATE TABLE IF NOT EXISTS workout_session (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL,
  gym_id INTEGER REFERENCES gym(id),
  duration_sec INTEGER,
  note TEXT
);

CREATE TABLE IF NOT EXISTS workout_set (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL REFERENCES workout_session(id),
  exercise_id INTEGER NOT NULL REFERENCES exercise_master(id),
  set_order INTEGER NOT NULL,
  weight_kg REAL NOT NULL,
  reps INTEGER NOT NULL,
  estimated_1rm REAL,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS body_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  date TEXT NOT NULL UNIQUE,
  weight_kg REAL,
  body_fat_pct REAL
);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;
