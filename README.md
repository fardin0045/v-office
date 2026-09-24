# V-OFFICE: 3D Hybrid Office Management System

> **“Your Hybrid Workplace, In One Virtual Space”**
>
> 📘 Developers: start with **[PROJECT_DOCUMENTATION.md](PROJECT_DOCUMENTATION.md)** — architecture, where each feature lives, API, security, deployment and commands.

![V-Office Platform](https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1400&q=80)

**V-Office** is an interactive 3D virtual office full-stack application built for companies operating under modern hybrid work models. Rather than relying on static tabular rosters or plain dashboard cards, employees enter a rich, interactive 3D virtual floor plan, locate their assigned workstation, click their own chair to check in, and conduct their workday with real-time presence synchronized company-wide via Socket.IO.

---

## 🌟 Key Features

### 🏢 1. Interactive 3D Virtual Office
- **Precise 30-Desk Layout**: Divided into 5 distinct zones:
  - **Zone A (Front Open Office)**: 7 desks across two staggered rows.
  - **Zone B (Guest Lounge Area)**: 4 desks alongside a leather sectional sofa and glass coffee table.
  - **Zone C (Open Workspace Pods)**: 8 desks in collaborative double-pod configurations.
  - **Zone D (CEO Executive Suite)**: Private frosted-glass office with executive mahogany desk, luxury chair, credenza, and visitor seating.
  - **Zone E (Engineering & Ops Wing)**: Separate glass-enclosed 10-desk suite arranged with a central walking aisle.
- **Camera Rig & Navigation**: Orbit, zoom, pan, and smooth camera transitions to zone presets (Overview, Zone A, Lounge, Pods, CEO Suite, Zone E) plus a dedicated **"Find My Chair"** feature that interpolates the camera directly to your assigned desk.
- **Realistic Lighting & Atmosphere**: Soft ambient downlights, ceiling spotlighting, metallic desk framing, glow-emitting monitor screens, mechanical keyboards, coffee cups, and indoor foliage (monstera, ficus).

### 🪑 2. Workstation Access Control & Live Check-In
- **Seat Rules by Work Mode**:
  - **Office mode**: check in only at your own assigned desk (e.g. `DESK-12`).
  - **Remote mode**: work from your own desk **or any free, unassigned desk** in the virtual office (colleagues' assigned seats stay protected), or log remote time without a desk.
  - History records both, e.g. `DESK-04 · Remote`, `DESK-12 · Office`, or `Remote`.
- **Four Visual Status States**:
  - `AVAILABLE`: Brand aqua (`#2DD9D6`).
  - `WORKING`: Pulsing emerald (`#10B981`) with an animated floor ring.
  - `OCCUPIED`: Amber (`#F59E0B`).
  - `LOCKED`: Slate grey (`#94A3B8`) with lock icon.
- **Live Duration Stopwatch**: Real-time counter tracks hours, minutes, and seconds while checked in.
- **Check-Out System**: Calculate total session duration and save records directly to MongoDB.

### 🌐 3. Real-Time Presence (Socket.IO)
- Check-ins, check-outs, desk locks, and reassignments are immediately broadcast to all active browser sessions with zero page reload.
- **Team notifications for everyone**: every signed-in user gets a pop-up when a colleague checks in or out, plus a 24-hour activity feed in the bell menu.
- **Away status**: when someone closes V-Office while checked in, their desk turns amber ("Away") after a short grace period (page refreshes don't count).
- **Automatic check-out**: if they don't come back within `AUTO_CHECKOUT_AFTER_MINUTES` (default 15), the session closes, ending at the time they left. Sessions longer than `MAX_SESSION_HOURS` (default 12) are capped. Auto-closed sessions are tagged "Auto" in history.
- **Sign-out prompt**: signing out while checked in asks whether to check out first.

### 📊 4. Personal Dashboard & Work History
- **Today's Status**: Live duration timer, current workstation ID, and daily totals.
- **Hybrid Work Mode Switch**: Toggle between **Office Mode** (check in at your assigned chair) and **Remote Mode** (use any free virtual desk, or log time without one).
- **Interactive Recharts**: 7-day daily working hours bar chart and 30-day office vs. remote pie breakdown.
- **Audit History**: Filterable, searchable, and paginated record of all historical work sessions.

### 🛡️ 5. Comprehensive Admin Management Suite (`/admin`)
- **Overview KPIs**: Total staff count, currently active sessions, in-office vs. remote breakdown, available desks, and cumulative hours logged today.
- **Employee Roster**: Full CRUD functionality for employees, credential management, role escalation, and desk assignment modals.
- **Workstation Grid**: Visual card grid of all 30 desks with zone filters, one-click desk assignment, unassigning, and administrative lock/unlock toggles.
- **Live 3D Telemetry**: Dual-pane supervisory monitor with live active employee list and interactive 3D floor view.
- **Company-Wide Work Session Logs**: Filterable session logs with duration calculations.

---

## 🛠️ Tech Stack

| Layer | Technologies |
| :--- | :--- |
| **Frontend** | React 18, Vite (route-level code splitting), React Router v7, Tailwind CSS (white + `#53ece9` theme), Lucide Icons, Recharts, Canvas-Confetti |
| **3D Engine** | Three.js, React Three Fiber (`@react-three/fiber`), React Three Drei (`@react-three/drei`) |
| **Backend** | Node.js, Express.js, Socket.IO, JWT, bcryptjs, Helmet (CSP), compression, express-rate-limit |
| **Database** | MongoDB & Mongoose (with self-healing local runner support) |

---

## 📁 Project Architecture

```
v-office/
├── Dockerfile                     # Single-image production build (API + app)
├── package.json                   # Root scripts: dev, build, start, seed, lint
├── server/
│   ├── .env.example               # All server settings, documented
│   └── src/
│       ├── server.js              # HTTP + Socket.IO bootstrap, graceful shutdown
│       ├── app.js                 # Express app: security headers, CORS, rate limits, static client
│       ├── realtime.js            # Broadcast helpers used by routes
│       ├── config/                # env.js (validated config), db.js (Mongo connection)
│       ├── middleware/            # auth, central error handler, rate limiting
│       ├── models/                # User, Desk, WorkSession (with query indexes)
│       ├── services/              # deskService (assignment rules), sessionService (check-out)
│       ├── routes/                # auth, desks, work, employees, admin
│       ├── sockets/officeSocket.js
│       ├── utils/                 # http helpers, timezone-aware date helpers, serializers
│       └── seed/seedData.js       # 30 desks, 14 users, ~130 historical sessions
└── client/
    ├── .env.example
    ├── vite.config.js             # Dev proxy + vendor chunk splitting
    ├── tailwind.config.js         # Brand scale built around #53ece9
    └── src/
        ├── App.jsx                # Providers + lazily-loaded routes
        ├── context/               # Auth, Socket (live desks), WorkSession (active session)
        ├── services/api.js        # Axios client, global 401 handling
        ├── hooks/ · lib/          # Shared hooks and utilities
        ├── components/
        │   ├── ui/                # Design system: Button, Input, Modal, Toast, Card, Badge...
        │   ├── common/            # Navbar, Footer, AuthLayout, ErrorBoundary, route guards
        │   ├── dashboard/         # Charts, live timer, responsive session table
        │   └── office3d/          # 3D scene, desks, floating desk panel
        └── pages/                 # Landing, auth, office, dashboard, history, profile, admin/*
```

---

## ⚡ Quick Start & Installation

### 1. Prerequisites
- **Node.js**: v18.18 or higher
- **MongoDB**: a local instance (auto-started on Windows if installed) or a MongoDB Atlas URI

### 2. Setup
From the project root:

```bash
# Install all root, server, and client dependencies
npm run install:all
```

*(Or navigate into `server` and `client` individually and run `npm install`)*

Then create your server config:

```bash
cp server/.env.example server/.env
```

### 3. Database Seeding
To populate all 30 desks across the 5 zones, 14 demo accounts, and historical attendance logs:

```bash
npm run seed
```

### 4. Running Locally
Run both backend and frontend concurrently:

```bash
npm run dev
```

- **Frontend Client**: `http://localhost:5173` (proxies `/api` and `/socket.io` to the backend)
- **Backend API**: `http://localhost:5000`
- **Backend Health Check**: `http://localhost:5000/api/health`

---

## 🚢 Deployment

In production, **one Node process serves everything**: the REST API, Socket.IO, and the built React app. You deploy a single service and there is no CORS to configure.

### Required environment variables
| Variable | Example |
| :--- | :--- |
| `NODE_ENV` | `production` |
| `MONGO_URI` | `mongodb+srv://user:pass@cluster.mongodb.net/voffice` |
| `JWT_SECRET` | 48+ random bytes: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `AUTO_CHECKOUT_AFTER_MINUTES` | *(optional)* `15`. Auto check-out after being away this long; `0` disables |
| `MAX_SESSION_HOURS` | *(optional)* `12`. Cap for forgotten sessions; `0` disables |

The server refuses to start in production without `MONGO_URI` and `JWT_SECRET`. See `server/.env.example` for optional settings (registration toggle, rate limits, proxy count). To hide the demo-account buttons, build the client with `VITE_ENABLE_DEMO_LOGIN=false`.

### Option A: Docker
```bash
docker build -t v-office .
docker run -p 5000:5000 -e MONGO_URI=... -e JWT_SECRET=... v-office
```

### Option B: Any Node host (Render, Railway, a VM...)
- **Build command:** `npm run install:all && npm run build`
- **Start command:** `NODE_ENV=production npm start`
- **Health check path:** `/api/health` (returns `503` if the database is unreachable)

Seed demo data once with `npm run seed`. It wipes existing data, and refuses to run against a production database unless you pass `--force`.

> **Scaling beyond one instance:** Socket.IO broadcasts and online-presence tracking are in-memory. To run several instances behind a load balancer, add `@socket.io/redis-adapter`, enable sticky sessions, and move presence into Redis.

---

## 🔑 Demo Accounts

Use the following credentials after `npm run seed` (one-click buttons appear on `/login` in development):

| Role | Email | Password | Assigned Desk |
| :--- | :--- | :--- | :--- |
| **Administrator** | `admin@voffice.local` | `Admin123!` | `DESK-20` (CEO Suite) |
| **Employee (Maya)** | `maya.p@voffice.local` | `Employee123!` | `DESK-03` (Front office) |
| **Employee (Elena)** | `elena.r@voffice.local` | `Employee123!` | `DESK-08` (Business team) |
| **Employee (James)** | `james.w@voffice.local` | `Employee123!` | `DESK-09` (Business team) |

---

## 📡 REST API Reference

### Authentication (`/api/auth`)
- `POST /api/auth/register` — Self-service sign-up (always creates a regular employee; disable with `ALLOW_REGISTRATION=false`).
- `POST /api/auth/login` — Sign in and receive a JWT (7-day default, `JWT_EXPIRES_IN`).
- `GET /api/auth/me` — Retrieve the currently authenticated profile.
- `PUT /api/auth/profile` — Update display name, avatar, password, or work mode.

### Workstations (`/api/desks`)
- `GET /api/desks` — List all 30 desks with assigned employee and live session data.
- `GET /api/desks/:deskId` — Fetch a single desk by its identifier.
- `POST /api/desks/assign` — Assign an employee to a desk *(Admin only)*.
- `POST /api/desks/unassign` — Clear an assignment from a desk *(Admin only)*.
- `POST /api/desks/lock` — Toggle physical lock state for a desk *(Admin only)*.

### Work Sessions (`/api/work`)
- `POST /api/work/start` — Start a session: `{ mode: 'office' | 'remote', deskId? }`. Office requires your own desk; remote may use your desk or a free unassigned one.
- `POST /api/work/end` — End your active session (admins may end any session by `sessionId`).
- `GET /api/work/active` — Retrieve current active session for the authenticated user.
- `GET /api/work/history` — Paginated records; filters `mode`, `startDate`, `endDate`, `q` (desk/date search).
- `GET /api/work/stats` — Fetch employee metrics (today, weekly, monthly, charts).
- `GET /api/work/activity` — Team check-ins/check-outs from the last 24 hours (signed-in users).

### Admin Suite (`/api/admin`)
- `GET /api/admin/stats` — High-level corporate KPI summary.
- `GET /api/admin/analytics` — Attendance trends, mode breakdown, and department stats.
- `GET /api/admin/sessions` — Company-wide paginated log; filters `q` (name/ID/desk), `mode`, `startDate`, `endDate`.

---

## 🛡️ Security Features
- **Bcrypt Password Hashing**: Passwords are never stored in plain text.
- **JWT Authorization Middleware**: Protected endpoints require valid Bearer tokens.
- **Strict Role-Based Access Control**: Sensitive actions (desk assignments, employee deletion, administrative locks) are restricted to admin accounts.
- **Chair Access Control Matrix**: Employees cannot start sessions on workstations assigned to other colleagues.
- **No Self-Promotion to Admin**: Public registration always creates employees; admins can't demote or delete themselves.
- **Race-Safe Check-Ins**: A unique database index guarantees one active session per employee, and desks are claimed atomically.
- **Hardened HTTP**: Helmet security headers with a Content-Security-Policy, rate-limited login/registration, request size limits, and no internal errors leaked in production.
- **Privacy**: Public desk data never includes email addresses; employees can only read their own profile stats.
- **Environment Isolation**: Secrets live in `.env` and are required (not defaulted) in production.

---

## 🚀 Future Roadmap
- WebRTC video bubble popups when standing near a colleague's desk.
- Custom 3D avatars with walkability / WASD first-person avatar controls.
- Slack / Google Calendar integrations for synchronized meeting presence.
