import { BinState, GameConfig, GameStateSnapshot, InspectionResult, TrashItem, TrashType } from './types';

const COLORS: TrashType[] = ['yellow', 'blue', 'brown', 'black'];

export class GameEngine {
  private bins: BinState[] = [];
  private spawnQueue: TrashItem[] = []; // central unsorted pile
  private score = 0;
  private lost = false;
  private reason?: string;

  private config: GameConfig;

  private nextSpawnTime = 0;
  private nextTruckTime = 0;
  private nextTruckTarget: TrashType | undefined;
  private currentTruckInterval = 0; // total duration for progress
  private nextInspectionTime = 0;

  constructor(config?: Partial<GameConfig>) {
    this.config = {
      binCapacity: 10,
      baseSpawnIntervalMs: [1200, 2500],
  truckIntervalMs: [10000, 15000],
      inspectionIntervalMs: [6000, 14000],
      maxSpawnQueue: 8,
      ...config,
    };
    this.reset();
  }

  reset() {
    this.bins = COLORS.map(color => ({ color, capacity: this.config.binCapacity, items: [] }));
    this.spawnQueue = [];
    this.score = 0; this.lost = false; this.reason = undefined;
    const now = performance.now();
    this.nextSpawnTime = now + this.randRange(...this.config.baseSpawnIntervalMs);
  this.scheduleNextTruck(now);
    this.nextInspectionTime = now + this.randRange(...this.config.inspectionIntervalMs);
  }

  private randRange(a: number, b: number) { return a + Math.random() * (b - a); }

  private pickRandomBin(): BinState { return this.bins[Math.floor(Math.random() * this.bins.length)]; }

  private spawnTrash() {
    const target = COLORS[Math.floor(Math.random() * COLORS.length)];
    const t: TrashItem = { id: crypto.randomUUID(), type: target, placedAt: performance.now() };
    this.spawnQueue.push(t);
    if (this.spawnQueue.length > this.config.maxSpawnQueue) this.lose('Too much unsorted trash waiting');
  }

  private scheduleNextTruck(from: number) {
    this.nextTruckTarget = COLORS[Math.floor(Math.random() * COLORS.length)];
  const interval = this.randRange(...this.config.truckIntervalMs);
  this.currentTruckInterval = interval;
  this.nextTruckTime = from + interval;
  }

  private truckArrives() {
    if (!this.nextTruckTarget) this.nextTruckTarget = this.pickRandomBin().color;
    const bin = this.bins.find(b => b.color === this.nextTruckTarget)!;
    bin.items = []; // empties the bin
    this.scheduleNextTruck(performance.now());
  }

  private inspect(): InspectionResult {
    const bin = this.pickRandomBin();
    // choose depth: at least 1 item, up to min(items length, random 1-4)
    const depth = Math.min(bin.items.length, 1 + Math.floor(Math.random() * 4));
    let found = false;
    for (let i = 0; i < depth; i++) {
      const item = bin.items[bin.items.length - 1 - i]; // top to deeper
      if (item && item.misSorted) { found = true; break; }
    }
    if (found) this.lose('Inspection found wrong trash in ' + bin.color + ' bin');
    return { inspectedBin: bin.color, depth, foundMisSort: found };
  }

  private lose(reason: string) { if (!this.lost) { this.lost = true; this.reason = reason; } }

  tick() {
    if (this.lost) return;
    const now = performance.now();
    if (now >= this.nextSpawnTime) {
      this.spawnTrash();
      this.nextSpawnTime = now + this.randRange(...this.config.baseSpawnIntervalMs);
    }
    if (now >= this.nextTruckTime) {
  this.truckArrives();
    }
    if (now >= this.nextInspectionTime) {
      this.inspect();
      this.nextInspectionTime = now + this.randRange(...this.config.inspectionIntervalMs);
    }
    // check overfilled bins
    for (const bin of this.bins) {
      if (bin.items.length > bin.capacity) { this.lose('A bin overflowed'); break; }
    }
  }

  moveFromSpawnToBin(binColor: TrashType, itemId: string) {
    const bin = this.bins.find(b => b.color === binColor)!;
    const idx = this.spawnQueue.findIndex(i => i.id === itemId);
    if (idx === -1) return;
    const item = this.spawnQueue.splice(idx, 1)[0];
    if (item.type !== bin.color) item.misSorted = true; else this.score += 10;
    bin.items.push(item);
  }

  getSpawnQueue(): TrashItem[] { return [...this.spawnQueue]; }

  snapshot(): GameStateSnapshot {
    const now = performance.now();
    return {
      bins: this.bins.map(b => ({ ...b, items: [...b.items] })),
      score: this.score,
      lost: this.lost,
      reason: this.reason,
      nextTruckEta: Math.max(0, this.nextTruckTime - now),
  truckIntervalTotal: this.currentTruckInterval,
  nextInspectionEta: Math.max(0, this.nextInspectionTime - now),
      nextSpawnEta: Math.max(0, this.nextSpawnTime - now),
      time: now,
      spawnQueue: this.getSpawnQueue(),
  nextTruckTarget: this.nextTruckTarget,
    };
  }
}

export { COLORS };
