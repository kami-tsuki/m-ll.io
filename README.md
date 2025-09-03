<div align="center">
	<h1>Müll.IO ♻️</h1>
	<p><strong>Fastify + TypeScript + Tailwind</strong> arcade sorting game with random inspections, timed truck pickups, and a persistent SQLite leaderboard.</p>
	<img src="https://img.shields.io/badge/fastify-4.x-black" alt="Fastify" />
	<img src="https://img.shields.io/badge/typescript-5.x-blue" alt="TypeScript" />
	<img src="https://img.shields.io/badge/tailwind-3.x-38bdf8" alt="Tailwind" />
</div>

---

## 🕹 Gameplay Overview
You start with four bins: **yellow**, **blue**, **brown**, **black**. A central pile spawns colored trash pieces (color = intended bin). Drag items to the correct bin to score.

| Mechanic | Details |
|----------|---------|
| Spawn Queue | Up to N unsorted items (config). If it overflows → lose. |
| Scoring | +10 points per correctly sorted item. |
| Mis-Sort Risk | If you drop into the wrong bin the piece stays (marked red) and can trigger a loss during inspection. |
| Inspections | Random interval; inspector looks at the top few items of a random bin. Any mis-sorted within inspected depth → game over. |
| Truck | Every 10–15s a truck empties a pre-announced bin (status bar shows countdown & target). |
| Bin Capacity | Exceeding capacity → lose. |
| Restart | Cleanly resets engine & state (WIP improvement if disabled). |
| Leaderboard | Submit score with a name; stored in SQLite volume. |

Current color logic:
- Unsorted (in spawn queue): tinted with intended bin color.
- Correctly sorted: green.
- Mis-sorted: red.

## 🧱 Tech Stack
- **Fastify** (static serving + JSON API)
- **TypeScript** (strict) for server and game logic
- **esbuild** for fast client bundling
- **Tailwind CSS** for UI styling
- **better-sqlite3** for low-latency embedded leaderboard DB
- **Docker / docker compose** for deployment

## 🛠 Development
Install deps:
```bash
npm install
```
Run live dev (server + client watch + Tailwind JIT):
```bash
npm run dev
```
Open: http://localhost:3000

Manual build:
```bash
npm run build        # server TS -> dist, bundle client, build tailwind
```
Start production build locally:
```bash
npm run build && npm run start:prod  # uses dist/ (with ESM resolution tweak)
```

### Quick Local Test Run
```bash
cp .env.example .env   # optional, customize vars
npm install            # install dependencies
npm run build          # compile server + bundle client + tailwind
npm run start:prod     # start optimized server
# open http://localhost:3000
```

For quick dev (auto rebuild):
```bash
npm run dev
```

Run tests & lint:
```bash
npm test
npm run lint
```

## 🗄 Leaderboard (SQLite)
Files stored under `data/` (mounted to a named volume in Docker). API:
```
GET  /api/leaderboard     -> { scores: [...] }
POST /api/leaderboard { name, score }
```
Environment variable: `DB_FILE` to override path (defaults to `data/leaderboard.db`).

## 🐳 Docker & Remote Deployment
Build & run (local Docker):
```bash
docker build -t mull-io:latest .
docker run -d -p 3000:3000 -v mullio_data:/data -e DB_FILE=/data/leaderboard.db mull-io:latest
```

Using predefined scripts (context `kami`):
```bash
npm run docker:build           # build image on remote context
npm run docker:compose:build   # compose build remote
npm run docker:up              # start/up services
npm run docker:logs            # follow logs
npm run docker:deploy          # local build then remote compose up --build
```

### Compose Volume
`mullio_data` persists `leaderboard.db`. Remove it to wipe scores:
```bash
docker --context <ctx> volume rm mullio_data
```

## ⚙️ Configuration (future extensibility)
| Aspect | Current | Potential Config Key |
|--------|---------|----------------------|
| Bin capacity | 10 | BIN_CAPACITY |
| Spawn interval | 1.2–2.5s | SPAWN_MIN/SPAWN_MAX |
| Truck interval | 10–15s | TRUCK_MIN/TRUCK_MAX |
| Inspection interval | 6–14s | INSP_MIN/INSP_MAX |
| Spawn queue limit | 8 | SPAWN_QUEUE_MAX |

These are hardcoded in the engine now; can be externalized via env + server-provided config endpoint.

## 🚧 Known Issues / TODO
- Restart button overlay input focus reliability (improve accessibility & focus trap)
- Add truck animation & bin flash (planned with Kaliypso)
- Aging urgency indicator for unsorted items
- Mobile touch fine-tuning (drag threshold)
- Anti-spam leaderboard submission (one per game) – basic disable exists
- Security: run container as non-root user

## 🧪 Testing (Planned)
Lightweight unit tests for engine logic (spawn, inspection probability, loss conditions) to be added under `src/__tests__`.

## 🤝 Contributing
1. Fork / branch
2. `npm run dev`
3. Commit with conventional-style messages (optional)
4. PR welcome

## 📄 License
[MIT](LICENSE)

---
Made with TypeScript, trash, and probably recycled caffeine.


