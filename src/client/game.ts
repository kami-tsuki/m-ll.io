import { GameEngine, COLORS } from './gameLogic';
import { TrashItem, TrashType } from './types';

let engine = new GameEngine();
let running = false;
let currentDrag: { itemId: string; ghost: HTMLElement } | null = null;
let highlightedBin: HTMLElement | null = null;

const root = document.getElementById('game-root')!;
const statusEl = document.getElementById('status')!;
const btnStart = document.getElementById('btn-start')! as HTMLButtonElement;
const btnReset = document.getElementById('btn-reset')! as HTMLButtonElement;
const leaderboardList = document.getElementById('leaderboard');

btnStart.onclick = () => { if (!running) { running = true; loop(); btnStart.disabled = true; } };
btnReset.onclick = () => { restartGame(); };

function loop() {
  if (!running) return;
  engine.tick();
  render();
  requestAnimationFrame(loop);
}

function render() {
  const snap = engine.snapshot();
  const truckMsg = snap.nextTruckTarget ? `${snap.nextTruckTarget} bin empties in ${(snap.nextTruckEta/1000).toFixed(1)}s` : `Truck pending`;
  statusEl.textContent = snap.lost ? `Lost: ${snap.reason}` : `Score ${snap.score} | ${truckMsg} | Inspection in ${(snap.nextInspectionEta/1000).toFixed(1)}s`;
  root.innerHTML = '';
  // Central spawn area
  const spawnArea = div('mb-6 p-4 bg-slate-800/60 rounded border border-slate-700 flex flex-wrap gap-2 min-h-[56px]');
  const queueLabel = div('w-full text-xs uppercase tracking-wide text-slate-400');
  queueLabel.textContent = `Unsorted Trash (${snap.spawnQueue.length})`;
  spawnArea.appendChild(queueLabel);
  for (const item of snap.spawnQueue) {
    const colorClass = unsortedColor(item.type);
    const el = renderTrashItem(item, `${colorClass} hover:scale-110 transition-transform cursor-grab touch-none`);
    enableCustomDrag(el, item.id);
    spawnArea.appendChild(el);
  }
  root.appendChild(spawnArea);

  const binsWrap = div('grid grid-cols-2 md:grid-cols-4 gap-4');
  for (const bin of snap.bins) {
  const binEl = div('p-2 rounded-lg shadow bg-slate-800 border flex flex-col transition-colors data-[hovered=true]:ring-4 data-[hovered=true]:ring-emerald-400');
    binEl.style.borderColor = colorForBin(bin.color);
  binEl.dataset.bin = bin.color;
    const title = div('font-semibold mb-2 capitalize');
    title.textContent = `${bin.color} bin (${bin.items.length}/${bin.capacity})`;
    binEl.appendChild(title);
    const itemsCol = div('flex-1 flex flex-col-reverse gap-1 overflow-hidden');
    for (const item of [...bin.items].slice(-bin.capacity)) {
  const itemEl = renderTrashItem(item, item.misSorted ? 'bg-rose-600' : 'bg-emerald-600');
      itemsCol.appendChild(itemEl);
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
  // extraClasses already contains bg color context based on state
  const base = `w-6 h-6 rounded-sm flex items-center justify-center text-[8px] select-none cursor-grab shadow-inner ${extraClasses}`;
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

async function loadLeaderboard() {
  if (!leaderboardList) return;
  try {
    const res = await fetch('/api/leaderboard');
    const data = await res.json();
    leaderboardList.innerHTML = '';
    (data.scores || []).forEach((s: any, idx: number) => {
      const li = document.createElement('li');
      li.textContent = `${idx + 1}. ${s.name} – ${s.score}`;
      leaderboardList.appendChild(li);
    });
  } catch { /* ignore */ }
}

async function submitScore(name: string, score: number) {
  try {
    const res = await fetch('/api/leaderboard', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name, score }) });
    const data = await res.json().catch(() => ({}));
    if (data?.id) highlightScoreId = data.id;
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
  const submitBtn = button('Save Score', 'px-3 py-2 rounded bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 font-semibold text-sm tracking-wide');
  submitBtn.onclick = async () => {
    if (submitBtn.disabled) return;
    await submitScore(nameInput.value || 'anon', score);
    await loadLeaderboard();
    submitBtn.disabled = true; submitBtn.textContent = 'Saved'; nameInput.disabled = true;
  };
  const restartBtn = button('Play Again', 'px-3 py-2 rounded bg-blue-600 hover:bg-blue-500 active:bg-blue-700 font-semibold text-sm tracking-wide');
  restartBtn.onclick = () => { overlayBuilt = false; restartGame(); };
  controls.appendChild(nameInput);
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
