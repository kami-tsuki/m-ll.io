import { GameEngine } from './gameLogic';
import { TrashItem, TrashType } from './types';

let engine = new GameEngine();
let running = false;
// Throttle renders to reduce layout cost; logic still ticks every frame.
const RENDER_INTERVAL = 100; // ms (~10 FPS visual refresh for stability)
let lastRender = 0;
let currentDrag: { itemId: string; ghost: HTMLElement } | null = null;
let highlightedBin: HTMLElement | null = null;
let sessionId: string | null = null;
let lastSpawnIds: Set<string> = new Set();

const root = document.getElementById('game-root')!;
const statusEl = document.getElementById('status')!;
const btnStart = document.getElementById('btn-start')! as HTMLButtonElement;
const btnReset = document.getElementById('btn-reset')! as HTMLButtonElement;
// Keyboard controls: 1-4 to drop first unsorted item into corresponding bin
window.addEventListener('keydown', (e) => {
  if (!running) return;
  if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
  const map: Record<string, TrashType> = { '1': 'yellow', '2': 'blue', '3': 'brown', '4': 'black' };
  const color = map[e.key];
  if (color) {
    const snap = engine.snapshot();
    const first = snap.spawnQueue[0];
    if (first) {
      engine.moveFromSpawnToBin(color, first.id);
      render();
    }
  }
});
const leaderboardList = document.getElementById('leaderboard');

btnStart.onclick = async () => {
  if (!running) {
    // Obtain session from server for anti-cheat plausibility validation
    try {
      const res = await fetch('/api/session/start', { method: 'POST' });
      const data = await res.json();
      sessionId = data.sessionId || null;
    } catch { sessionId = null; }
    running = true; loop(); btnStart.disabled = true; }
};
btnReset.onclick = () => { restartGame(); };

function loop() {
  if (!running) return;
  engine.tick();
  const now = performance.now();
  if (now - lastRender >= RENDER_INTERVAL) {
    render();
    lastRender = now;
  }
  requestAnimationFrame(loop);
}

function render() {
  const snap = engine.snapshot();
  const truckMsg = snap.nextTruckTarget ? `${snap.nextTruckTarget} in ${(snap.nextTruckEta/1000).toFixed(1)}s` : `Truck pending`;
  // Build status with progress bar
  const inspectionMsg = `Inspect ${(snap.nextInspectionEta/1000).toFixed(1)}s`;
  let truckProgress = '';
  if (snap.truckIntervalTotal && snap.nextTruckTarget) {
    const pct = 1 - (snap.nextTruckEta / snap.truckIntervalTotal);
    truckProgress = `<div class='truck-bar h-1 w-24 bg-slate-700 rounded overflow-hidden'><div class='h-full bg-amber-400 transition-[width] duration-150' style='width:${(pct*100).toFixed(1)}%'></div></div>`;
  }
  statusEl.innerHTML = snap.lost ? `<span class='text-rose-400 font-semibold'>Lost:</span> ${snap.reason}` : `Score <span class='font-mono'>${snap.score}</span> | Truck ${truckMsg} ${truckProgress} | ${inspectionMsg}`;
  root.innerHTML = '';
  // Central spawn area (fixed grid)
  const spawnArea = div('mb-6 p-4 bg-slate-800/60 rounded border border-slate-700 flex flex-col gap-2');
  spawnArea.setAttribute('aria-label','Unsorted trash spawn area');
  const queueLabel = div('text-xs uppercase tracking-wide text-slate-400 flex items-center justify-between');
  queueLabel.textContent = `Unsorted Trash (${snap.spawnQueue.length}/${engineConfig().maxSpawnQueue})`;
  spawnArea.appendChild(queueLabel);
  const grid = div('grid grid-cols-8 gap-2');
  const maxSpawn = engineConfig().maxSpawnQueue;
  for (const item of snap.spawnQueue) {
    const colorClass = unsortedColor(item.type);
    const isNew = !lastSpawnIds.has(item.id);
    const el = renderTrashItem(item, `${colorClass} hover:scale-110 transition-transform cursor-grab touch-none ${isNew ? 'spawn-pop' : ''}`);
    enableCustomDrag(el, item.id);
    grid.appendChild(el);
  }
  for (let i = snap.spawnQueue.length; i < maxSpawn; i++) {
    const placeholder = div('w-5 h-5 md:w-6 md:h-6 rounded-sm bg-slate-700/30 border border-slate-600/30');
    grid.appendChild(placeholder);
  }
  spawnArea.appendChild(grid);
  root.appendChild(spawnArea);
  lastSpawnIds = new Set(snap.spawnQueue.map(i=>i.id));

  const binsWrap = div('grid grid-cols-2 md:grid-cols-4 gap-4');
  for (const bin of snap.bins) {
    const truckTarget = snap.nextTruckTarget === bin.color;
    const binEl = div('p-2 rounded-lg shadow relative bg-slate-800/70 border flex flex-col transition-colors data-[hovered=true]:ring-4 data-[hovered=true]:ring-emerald-400');
    binEl.style.borderColor = colorForBin(bin.color);
    if (truckTarget) binEl.classList.add('animate-pulse','ring','ring-offset-2','ring-amber-400/60');
    binEl.dataset.bin = bin.color;
    const title = div('font-semibold mb-2 capitalize flex items-center justify-between');
    title.innerHTML = `<span>${bin.color} bin</span><span class='text-[10px] font-normal text-slate-400'>${bin.items.length}/${bin.capacity}</span>`;
    binEl.appendChild(title);
    const itemsCol = div('grid grid-cols-4 auto-rows-[1fr] gap-1 flex-1 overflow-hidden bin-grid');
    const capped = [...bin.items].slice(-bin.capacity);
    for (const item of capped) {
      const itemEl = renderTrashItem(item, item.misSorted ? 'bg-rose-600' : 'bg-emerald-600');
      itemsCol.appendChild(itemEl);
    }
    for (let i = capped.length; i < bin.capacity; i++) { // placeholders to stabilize layout
      const ph = div('w-5 h-5 md:w-6 md:h-6 opacity-0');
      itemsCol.appendChild(ph);
    }
    binEl.appendChild(itemsCol);
    // drop zone
    // native DnD fallback (desktop)
    binEl.addEventListener('dragover', ev => ev.preventDefault());
    binEl.addEventListener('drop', ev => {
      ev.preventDefault();
      const id = ev.dataTransfer?.getData('text/plain');
      if (id) { engine.moveFromSpawnToBin(bin.color, id); render(); }
    });
    binsWrap.appendChild(binEl);
  }
  root.appendChild(binsWrap);
  if (snap.lost) ensureOverlay(snap.score, snap.reason || ''); else removeOverlay();
}

function renderTrashItem(item: TrashItem, extraClasses: string) {
  // Responsive fixed size, subtle border & depth.
  const base = `w-5 h-5 md:w-6 md:h-6 rounded-sm flex items-center justify-center text-[8px] select-none cursor-grab shadow-inner border border-slate-900/40 ${extraClasses}`;
  const el = div(base);
  el.title = item.type + (item.misSorted ? ' (Wrong bin)' : '');
  return el;
}

function colorForBin(t: TrashType) {
  switch (t) {
    case 'yellow': return '#eab308';
    case 'blue': return '#3b82f6';
    case 'brown': return '#92400e';
    case 'black': return '#1e293b';
  }
}

function unsortedColor(t: TrashType) {
  switch (t) {
    case 'yellow': return 'bg-yellow-500';
    case 'blue': return 'bg-blue-500';
    case 'brown': return 'bg-amber-700';
    case 'black': return 'bg-slate-700';
  }
}

function div(cls: string) { const d = document.createElement('div'); d.className = cls; return d; }
function button(txt: string, cls: string) { const b = document.createElement('button'); b.textContent = txt; b.className = cls; return b; }

function removeOverlay() { const existing = document.getElementById('game-over-overlay'); if (existing) existing.remove(); }

function restartGame() {
  running = false;
  btnStart.disabled = false;
  engine = new GameEngine();
  removeOverlay();
  render();
}

interface InternalEngine { config: { maxSpawnQueue: number } }
function engineConfig() {
  return (engine as unknown as InternalEngine).config;
}

interface LeaderboardEntry { id: number; name: string; score: number; }
interface LeaderboardResponse { scores: LeaderboardEntry[] }
async function loadLeaderboard() {
  if (!leaderboardList) return;
  try {
    const res = await fetch('/api/leaderboard');
  const data: LeaderboardResponse = await res.json();
    leaderboardList.innerHTML = '';
  (data.scores || []).forEach((s, idx: number) => {
      const li = document.createElement('li');
      li.textContent = `${idx + 1}. ${s.name} – ${s.score}`;
      li.className = 'transition-colors';
      if (highlightScoreId && s.id === highlightScoreId) li.classList.add('highlight-score');
      leaderboardList.appendChild(li);
    });
  } catch { /* ignore */ }
}

interface SubmitResult { ok?: boolean; id?: number; minimumToBeat?: number; reason?: string }
async function submitScore(name: string, score: number) {
  try {
  const res = await fetch('/api/leaderboard', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, score, sessionId }) });
  const data: SubmitResult = await res.json().catch(() => ({} as SubmitResult));
  if (data?.ok && data?.id) highlightScoreId = data.id; else return data;
  } catch { /* ignore */ }
}

loadLeaderboard();

// Overlay handling with memoization
let overlayBuilt = false;
let highlightScoreId: number | null = null;
function ensureOverlay(score: number, reason: string) {
  if (overlayBuilt) return; // keep existing overlay; don't rebuild so inputs stay intact
  overlayBuilt = true;
  const overlay = div('fixed inset-0 backdrop-blur-sm bg-black/70 flex items-center justify-center');
  overlay.id = 'game-over-overlay';
  const panel = div('bg-slate-900/90 border border-slate-700 p-6 rounded-xl shadow-xl max-w-sm w-full text-center space-y-5');
  panel.innerHTML = `<h2 class='text-xl font-bold tracking-wide'>Game Over</h2><p class='text-sm text-slate-300'>${reason}</p><p class='text-2xl font-mono text-emerald-400'>${score}</p>`;
  const controls = div('flex flex-col gap-3');
  const nameInput = document.createElement('input');
  nameInput.placeholder = 'Your name';
  nameInput.maxLength = 24;
  nameInput.autocomplete = 'username';
  nameInput.className = 'px-3 py-2 rounded bg-slate-800 focus:bg-slate-700 focus:outline-none focus:ring focus:ring-emerald-600/40 transition text-sm';
  nameInput.setAttribute('aria-label','Enter your name for leaderboard');
  const sanitizeNote = div('text-[10px] text-slate-500');
  sanitizeNote.textContent = '';
  const submitBtn = button('Save Score', 'px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 font-semibold text-sm tracking-wide');
  let canSubmit = true;
  // Pre-fetch leaderboard to determine eligibility
  fetch('/api/leaderboard').then(r=>r.json()).then(data => {
    const scores = data.scores || [];
    if (scores.length === 10) {
      const tenth = scores[scores.length - 1].score;
      if (score <= tenth) {
        canSubmit = false;
        submitBtn.disabled = true; submitBtn.textContent = `Need > ${tenth}`;
      }
    }
  }).catch(()=>{});
  submitBtn.onclick = async () => {
    if (submitBtn.disabled || !canSubmit) return;
    const result = await submitScore(nameInput.value || 'anon', score);
    if (result && !result.ok) {
      submitBtn.textContent = result.minimumToBeat ? `Need > ${result.minimumToBeat - 1}` : 'Not in top 10';
      return;
    }
    await loadLeaderboard();
    submitBtn.disabled = true; submitBtn.textContent = 'Saved'; nameInput.disabled = true;
  };
  const restartBtn = button('Play Again', 'px-3 py-2 rounded bg-blue-600 hover:bg-blue-500 active:bg-blue-700 font-semibold text-sm tracking-wide');
  restartBtn.onclick = () => { overlayBuilt = false; restartGame(); };
  nameInput.addEventListener('input', () => {
    const preview = clientSanitizeName(nameInput.value);
    if (preview !== nameInput.value) sanitizeNote.textContent = `Will appear as: ${preview}`; else sanitizeNote.textContent = '';
  });
  controls.appendChild(nameInput);
  controls.appendChild(sanitizeNote);
  controls.appendChild(submitBtn);
  controls.appendChild(restartBtn);
  panel.appendChild(controls);
  overlay.appendChild(panel);
  document.body.appendChild(overlay);
  nameInput.focus();
}

// Auto-refresh leaderboard every 20s
setInterval(() => loadLeaderboard(), 20000);

function enableCustomDrag(el: HTMLElement, itemId: string) {
  // Also set draggable for desktop compatibility
  el.setAttribute('draggable', 'true');
  el.addEventListener('pointerdown', (e) => {
    if (currentDrag || e.button !== 0) return;
    e.preventDefault();
    const rect = el.getBoundingClientRect();
    const ghost = el.cloneNode(true) as HTMLElement;
    ghost.style.position = 'fixed';
    ghost.style.left = rect.left + 'px';
    ghost.style.top = rect.top + 'px';
    ghost.style.width = rect.width + 'px';
    ghost.style.height = rect.height + 'px';
    ghost.style.pointerEvents = 'none';
    ghost.style.opacity = '0.9';
    ghost.style.zIndex = '1000';
    ghost.classList.add('scale-110');
    document.body.appendChild(ghost);
    currentDrag = { itemId, ghost };
    const offsetX = e.clientX - rect.left;
    const offsetY = e.clientY - rect.top;

    const move = (ev: PointerEvent) => {
      if (!currentDrag) return;
      currentDrag.ghost.style.left = (ev.clientX - offsetX) + 'px';
      currentDrag.ghost.style.top = (ev.clientY - offsetY) + 'px';
      updateBinHover(ev.clientX, ev.clientY);
    };
    const up = (ev: PointerEvent) => {
      if (!currentDrag) return;
      document.removeEventListener('pointermove', move);
      document.removeEventListener('pointerup', up);
      const targetBin = binAtPoint(ev.clientX, ev.clientY);
      currentDrag.ghost.remove();
      if (highlightedBin) { highlightedBin.dataset.hovered = 'false'; highlightedBin = null; }
      const id = currentDrag.itemId;
      currentDrag = null;
      if (targetBin) {
        const color = targetBin.dataset.bin as TrashType;
        engine.moveFromSpawnToBin(color, id);
        render();
      }
    };
    document.addEventListener('pointermove', move, { passive: true });
    document.addEventListener('pointerup', up, { once: true });
  });
}

// Client-side mirror of sanitize (simplified)
function clientSanitizeName(input: string) {
  let name = input.normalize('NFKC');
  const patterns = [
    /n[\W_]*[i1l|![\W_]*g+[\W_]*g*[\W_]*[ae4@]?/ig,
    /f[\W_]*u[\W_]*c[\W_]*k+/ig,
    /s[\W_]*h[\W_]*i[\W_]*t+/ig,
    /b[\W_]*i[\W_]*t[\W_]*c[\W_]*h+/ig,
    /c[\W_]*u[\W_]*n[\W_]*t+/ig,
    /a[\W_]*s[\W_]*s+h*[\W_]*/ig,
  ];
  for (const p of patterns) name = name.replace(p,'***');
  name = name.replace(/\*{2,}/g,'***').replace(/\s{2,}/g,' ').trim();
  if (!name || name === '***') name = 'anon';
  name = name.replace(/^[^A-Za-z0-9]+/, '');
  if (!name) name = 'anon';
  return name.slice(0,24);
}

function binAtPoint(x: number, y: number): HTMLElement | null {
  const el = document.elementFromPoint(x, y) as HTMLElement | null;
  if (!el) return null;
  return el.closest('[data-bin]') as HTMLElement | null;
}

function updateBinHover(x: number, y: number) {
  const b = binAtPoint(x, y);
  if (b === highlightedBin) return;
  if (highlightedBin) highlightedBin.dataset.hovered = 'false';
  highlightedBin = b;
  if (highlightedBin) highlightedBin.dataset.hovered = 'true';
}

render();
