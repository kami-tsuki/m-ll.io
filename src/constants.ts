export const CONFIG = {
  BIN_CAPACITY: 10,
  SPAWN_INTERVAL_MS: [1200, 2500] as [number, number],
  TRUCK_INTERVAL_MS: [10000, 15000] as [number, number],
  INSPECTION_INTERVAL_MS: [6000, 14000] as [number, number],
  MAX_SPAWN_QUEUE: 8,
  LEADERBOARD_LIMIT: 10,
  SCORE_PER_ITEM: 10,
};

export const SECURITY = {
  SESSION_HMAC_ALGO: 'sha256',
  SESSION_TTL_MS: 1000 * 60 * 60 * 2, // 2h
};

export function minSpawnInterval() { return CONFIG.SPAWN_INTERVAL_MS[0]; }
