import { describe, it, expect } from 'vitest';
import { GameEngine } from '../client/gameLogic';

describe('GameEngine basic', () => {
  it('increments score on correct placement', () => {
    const engine = new GameEngine();
    // Force a spawn
  // Force a spawn by invoking private method via bracket access (keeps type safety local)
  (engine as unknown as { spawnTrash: () => void }).spawnTrash();
  const snap = engine.snapshot();
  const item = snap.spawnQueue[0]!;
  engine.moveFromSpawnToBin(item.type, item.id);
    const after = engine.snapshot();
    expect(after.score).toBeGreaterThan(0);
  });
});