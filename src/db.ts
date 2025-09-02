import Database from 'better-sqlite3';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dbFile = process.env.DB_FILE || join(__dirname, '..', 'data', 'leaderboard.db');

const db = new Database(dbFile);
db.pragma('journal_mode = WAL');

db.exec(`CREATE TABLE IF NOT EXISTS leaderboard (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  score INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_leaderboard_score ON leaderboard(score DESC);`);

export interface LeaderboardEntry { id: number; name: string; score: number; created_at: string; }

export function addScore(name: string, score: number): number {
  const stmt = db.prepare('INSERT INTO leaderboard (name, score) VALUES (?, ?)');
  const info = stmt.run(name.substring(0, 24), score);
  return Number(info.lastInsertRowid);
}

export function topScores(limit = 20): LeaderboardEntry[] {
  return db.prepare('SELECT id, name, score, created_at FROM leaderboard ORDER BY score DESC, id ASC LIMIT ?').all(limit) as LeaderboardEntry[];
}

export function clearScores() { db.exec('DELETE FROM leaderboard'); }

export default db;