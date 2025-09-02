export type TrashType = 'yellow' | 'blue' | 'brown' | 'black';

export interface TrashItem {
  id: string;
  type: TrashType; // correct bin color
  placedAt: number; // timestamp
  misSorted?: boolean; // user tried wrong bin
}

export interface BinState {
  color: TrashType;
  capacity: number; // max items
  items: TrashItem[];
}

export interface GameConfig {
  binCapacity: number;
  baseSpawnIntervalMs: [number, number]; // random range
  truckIntervalMs: [number, number];
  inspectionIntervalMs: [number, number];
  maxSpawnQueue: number; // how many can wait in central spawn area before losing
}

export interface InspectionResult {
  inspectedBin: TrashType;
  depth: number; // how many top items checked
  foundMisSort: boolean;
}

export interface GameStateSnapshot {
  bins: BinState[];
  score: number;
  lost: boolean;
  reason?: string;
  nextTruckEta: number; // ms until truck
  nextTruckTarget?: TrashType; // which bin will be emptied
  nextInspectionEta: number;
  nextSpawnEta: number;
  time: number;
  spawnQueue: TrashItem[]; // unsorted items waiting in central area
}
