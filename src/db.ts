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

const TOP_LIMIT = 10; // hard cap for history

function pruneExcess() {
  // Keep only top TOP_LIMIT by score (then earliest id for ties)
  db.prepare(`DELETE FROM leaderboard WHERE id NOT IN (
    SELECT id FROM leaderboard ORDER BY score DESC, id ASC LIMIT ?
  )`).run(TOP_LIMIT);
}

function tenthScore(): number | undefined {
  const row = db.prepare(`SELECT score FROM leaderboard ORDER BY score DESC, id ASC LIMIT 1 OFFSET ?`).get(TOP_LIMIT - 1) as { score: number } | undefined;
  return row?.score;
}

export function tryAddScoreLimited(name: string, score: number): { accepted: boolean; id?: number; minimumToBeat?: number } {
  if (score <= 0) return { accepted: false, minimumToBeat: tenthScore() };
  const currentCount = db.prepare('SELECT COUNT(*) as c FROM leaderboard').get() as { c: number };
  const tenth = currentCount.c >= TOP_LIMIT ? tenthScore() : undefined;
  if (tenth !== undefined && score <= tenth) {
    return { accepted: false, minimumToBeat: tenth + 1 };
  }
  const stmt = db.prepare('INSERT INTO leaderboard (name, score) VALUES (?, ?)');
  const info = stmt.run(name.substring(0, 24), score);
  pruneExcess();
  return { accepted: true, id: Number(info.lastInsertRowid), minimumToBeat: tenthScore() };
}

export function topScores(): LeaderboardEntry[] {
  return db.prepare('SELECT id, name, score, created_at FROM leaderboard ORDER BY score DESC, id ASC LIMIT ?').all(TOP_LIMIT) as LeaderboardEntry[];
}

export function clearScores() { db.exec('DELETE FROM leaderboard'); }

export function leaderboardMeta() {
  const scores = topScores();
  const tenth = scores.length === TOP_LIMIT ? scores[scores.length - 1].score : undefined;
  return { limit: TOP_LIMIT, tenth }; }

export default db;