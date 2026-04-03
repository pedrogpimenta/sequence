// Uses Node.js built-in SQLite (available since Node 22.5+, no extra package needed)
import { DatabaseSync } from 'node:sqlite'

const db = new DatabaseSync(process.env.DB_PATH || './sequence.db')

db.exec(`
  CREATE TABLE IF NOT EXISTS rooms (
    code       TEXT PRIMARY KEY,
    names      TEXT NOT NULL,
    state      TEXT,
    updated_at INTEGER NOT NULL DEFAULT (unixepoch())
  );
  DELETE FROM rooms WHERE updated_at < unixepoch() - 86400;
`)

const stmtUpsert = db.prepare(`
  INSERT INTO rooms (code, names, state, updated_at)
  VALUES (?, ?, ?, unixepoch())
  ON CONFLICT(code) DO UPDATE SET
    names      = excluded.names,
    state      = excluded.state,
    updated_at = unixepoch()
`)

const stmtLoad   = db.prepare('SELECT names, state FROM rooms WHERE code = ?')
const stmtDelete = db.prepare('DELETE FROM rooms WHERE code = ?')
const stmtExists = db.prepare('SELECT 1 AS found FROM rooms WHERE code = ?')

export function saveRoom(code, names, state) {
  stmtUpsert.run(code, JSON.stringify(names), state ? JSON.stringify(state) : null)
}

export function loadRoom(code) {
  const row = stmtLoad.get(code)
  if (!row) return null
  return {
    names: JSON.parse(row.names),
    state: row.state ? JSON.parse(row.state) : null,
  }
}

export function deleteRoom(code) {
  stmtDelete.run(code)
}

export function codeExists(code) {
  return !!stmtExists.get(code)?.found
}
