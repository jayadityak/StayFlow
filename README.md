# StayFlow

**QR-based in-stay guest experience platform for hotels.**

Guests scan a QR code in their room and chat with an intelligent assistant to order food, book spa slots, request services, and get hotel information — all managed from a clean staff dashboard.

---

## Demo Credentials

| Role         | Email                           | Password  |
|--------------|---------------------------------|-----------|
| Admin        | admin@royalpalm.com             | admin123  |
| Front Desk   | staff@royalpalm.com             | staff123  |
| Housekeeping | housekeeping@royalpalm.com      | staff123  |
| Concierge    | concierge@royalpalm.com         | staff123  |

**Hotel:** Royal Palm Suites, Udaipur, Rajasthan

**Guest Portal (OTP flow):** `http://localhost:5173/hotel/royal-palm-suites/verify`  
**Guest Portal (Room QR flow):** `http://localhost:5173/hotel/royal-palm-suites/room/101`

Active demo guest rooms: **103** (Arjun Kapoor), **203** (Sneha Joshi), **302** (Vikram Nair)

---

## Tech Stack

| Layer      | Technology                                      |
|------------|--------------------------------------------------|
| Frontend   | React 18 + TypeScript + Vite                    |
| Styling    | Tailwind CSS + Radix UI primitives              |
| Icons      | lucide-react                                     |
| Routing    | React Router v6                                  |
| State      | TanStack Query (server) + React hooks (local)   |
| Charts     | Recharts                                         |
| QR Codes   | qrcode (npm)                                     |
| Backend    | Node.js + Express + TypeScript                  |
| Database   | PostgreSQL via Prisma ORM                        |
| Auth       | JWT (staff/admin) + Guest tokens                |
| Validation | Zod                                              |
| Date utils | date-fns                                         |
| Password   | bcryptjs                                         |

---

## Project Structure

```
stayflow/
├── client/                    # React frontend (Vite)
│   └── src/
│       ├── App.tsx             # Router setup
│       ├── components/
│       │   ├── layout/         # DashboardLayout (sidebar + header)
│       │   └── ui/             # Shared UI primitives (button, input, toast…)
│       ├── features/
│       │   ├── auth/           # Login, Signup, Landing, AuthContext
│       │   ├── overview/       # Dashboard KPI cards + charts
│       │   ├── rooms/          # Room management + per-room panel
│       │   ├── amenities/      # Amenity timings management
│       │   ├── services/       # Service configuration
│       │   ├── menu/           # F&B menu editor
│       │   ├── chats/          # Staff chat inbox (all conversations)
│       │   ├── requests/       # Service request management
│       │   ├── orders/         # Food order management
│       │   ├── staffboard/     # Live staff operations board
│       │   ├── notifications/  # Notification center
│       │   ├── qr/             # QR code generation + download
│       │   ├── analytics/      # Usage analytics + charts
│       │   ├── settings/       # Hotel settings
│       │   └── guest/          # Guest-facing pages
│       │       ├── GuestVerifyPage.tsx   # OTP verification flow
│       │       ├── GuestRoomPage.tsx     # Per-room QR flow (no OTP)
│       │       └── GuestChatPage.tsx     # Guest chat interface
│       └── lib/
│           ├── api.ts          # Fetch wrapper with auth headers
│           └── utils.ts        # cn() helper
│
└── server/                    # Express backend
    ├── src/
    │   ├── index.ts            # App entry point + route registration
    │   ├── middleware/auth.ts  # JWT + guest token middleware
    │   ├── lib/
    │   │   ├── prisma.ts       # Prisma client singleton
    │   │   ├── i18n.ts         # Server-side i18n — T(lang, key, vars), 12 languages
    │   │   ├── sse.ts          # SSE client registry (staff + guest connections)
    │   │   ├── checkoutUtils.ts# Checkout boundary helpers
    │   │   └── cleanup.ts      # Hourly background cleanup job
    │   └── routes/
    │       ├── auth.ts         # Signup, login, /me
    │       ├── hotel.ts        # Hotel profile CRUD
    │       ├── rooms.ts        # Room management + room panel data
    │       ├── amenities.ts    # Amenity management
    │       ├── services.ts     # Service management
    │       ├── menu.ts         # Menu item management
    │       ├── guest.ts        # Guest session, chat assistant, guest SSE stream
    │       ├── chats.ts        # Staff chat read + reply
    │       ├── requests.ts     # Service request management + ROLE_SERVICE_TYPES
    │       ├── orders.ts       # Food order management
    │       ├── notifications.ts# Notification read/mark
    │       ├── analytics.ts    # Analytics aggregation
    │       ├── events.ts       # Staff SSE endpoint (GET /api/events)
    │       └── qr.ts           # QR code generation
    └── prisma/
        ├── schema.prisma       # Database schema
        ├── seed.ts             # Full demo data seed
        └── reset-demo.ts       # Runtime-only reset (keeps hotel/rooms/menu/staff)
```

---

## Prerequisites

- **Node.js** v18 or later
- **PostgreSQL** v14 or later (running locally or via Docker)
- **npm** v9 or later

---

## Setup Instructions

### 1. Clone and install

```bash
git clone <your-repo-url> stayflow
cd stayflow
```

Install server dependencies:
```bash
cd server
npm install
```

Install client dependencies:
```bash
cd ../client
npm install
```

---

### 2. Set up PostgreSQL

#### Option A: Local PostgreSQL
```sql
CREATE DATABASE stayflow;
```

#### Option B: Docker (quick start)
```bash
docker run --name stayflow-db \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=stayflow \
  -p 5432:5432 \
  -d postgres:16
```

---

### 3. Configure environment variables

```bash
cd server
cp .env.example .env
```

Edit `server/.env`:
```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/stayflow"
JWT_SECRET="change-this-to-a-random-secret-in-production"
PORT=4000
CLIENT_URL="http://localhost:5173"
NODE_ENV="development"
```

---

### 4. Run database migrations

```bash
cd server
npx prisma migrate dev --name init
```

---

### 5. Seed demo data

```bash
cd server
npm run db:seed
```

This creates:
- **Hotel:** Royal Palm Suites (Udaipur)
- **15 rooms** across 5 floors (standard, deluxe, suite, villa)
- **10 amenities** with timings (pool, spa, gym, restaurant, etc.)
- **10 services** (housekeeping, laundry, taxi, spa, etc.)
- **20 menu items** across 6 categories
- **2 staff users** (admin + staff)
- **Sample guest sessions, requests, orders, and notifications**

---

### 6. Start the servers

**Terminal 1 — Backend:**
```bash
cd server
npm run dev
```
Server runs at: `http://localhost:4000`

**Terminal 2 — Frontend:**
```bash
cd client
npm run dev
```
Frontend runs at: `http://localhost:5173`

---

## Application Routes

### Public / Guest Routes
| Route                              | Description                              |
|------------------------------------|------------------------------------------|
| `/`                                | Landing page                             |
| `/login`                           | Staff/admin login                        |
| `/signup`                          | Hotel registration                       |
| `/hotel/:slug/verify`             | Guest email OTP verification             |
| `/hotel/:slug/room/:roomNumber`   | Per-room QR guest entry (no OTP needed) |
| `/hotel/:slug/chat`               | Guest chat interface                     |

### Dashboard Routes (requires login)
| Route                  | Description                         |
|------------------------|-------------------------------------|
| `/app/overview`        | KPI cards + live charts             |
| `/app/rooms`           | Room management                     |
| `/app/rooms/:id`       | Per-room detail panel               |
| `/app/amenities`       | Amenity timings                     |
| `/app/services`        | Service configuration               |
| `/app/menu`            | F&B menu editor                     |
| `/app/chats`           | Guest chat inbox                    |
| `/app/requests`        | Service request management          |
| `/app/staff-board`     | Live staff operations board         |
| `/app/orders`          | Food order management               |
| `/app/notifications`   | Notification center                 |
| `/app/qr`              | QR code generation + download       |
| `/app/analytics`       | Usage analytics                     |
| `/app/settings`        | Hotel settings                      |

---

## API Endpoints

### Auth
```
POST /api/auth/signup
POST /api/auth/login
GET  /api/auth/me
```

### Hotel
```
GET  /api/hotel
PUT  /api/hotel
GET  /api/hotel/public/:slug        (guest-facing, no auth)
```

### Rooms
```
GET    /api/rooms
POST   /api/rooms
PUT    /api/rooms/:id
DELETE /api/rooms/:id
GET    /api/rooms/public/:hotelSlug  (guest-facing)
```

### Amenities / Services / Menu Items
```
GET    /api/amenities
POST   /api/amenities
PUT    /api/amenities/:id
DELETE /api/amenities/:id
GET    /api/amenities/public/:hotelSlug

(Same pattern for /api/services and /api/menu-items)
```

### Guest Flow
```
POST /api/guest/send-otp                              OTP email flow
POST /api/guest/verify-otp
POST /api/guest/room-session                          Per-room QR flow (no OTP)
GET  /api/guest/session                               Validate guest token
PATCH /api/guest/session/language                     Update preferred language
POST /api/guest/chat/start
GET  /api/guest/conversations/:id
GET  /api/guest/conversations/:id/events              Guest SSE stream (staff_reply)
POST /api/guest/conversations/:id/message             Chat assistant
POST /api/guest/orders                                Place food order
POST /api/guest/requests                              Direct service request
POST /api/guest/feedback                              Post-stay feedback
```

### Staff Dashboard
```
GET  /api/events                               Staff SSE stream (new_request, new_order,
                                               new_chat, escalation, message_created)

GET   /api/chats
GET   /api/chats/past
GET   /api/chats/:id
POST  /api/chats/:id/reply
PATCH /api/chats/:id/status

GET   /api/requests
PATCH /api/requests/:id/status
PATCH /api/requests/:id/assign
PATCH /api/requests/:id/notes

GET   /api/orders
PATCH /api/orders/:id/status
PATCH /api/orders/:id/acknowledge

GET   /api/notifications
PATCH /api/notifications/:id/read
PATCH /api/notifications/read-all

GET   /api/analytics/overview
GET   /api/analytics/alerts
GET   /api/qr
```

---

## Chat Assistant Features

The guest chat assistant (`/api/guest/conversations/:id/message`) handles all of the following without any LLM — purely rule-based intent detection in `processGuestMessage()`:

| Category                  | Examples                                                                 |
|---------------------------|--------------------------------------------------------------------------|
| Greetings / thanks        | hi, hello, namaste, thanks — short-circuit before NLP, no escalation    |
| Spa/gym/pool booking      | "book spa" → shows 1-hour slots → "today at 3pm" → confirmed            |
| Service requests          | housekeeping, laundry, towels, wake-up call, taxi, maintenance…         |
| Front-desk requests       | currency exchange, limo, late checkout, early checkout                   |
| Early check-in            | Informational only — redirects to front desk, no request filed          |
| Food ordering             | "I'm hungry", "order pizza" — opens menu drawer                         |
| Amenity timings           | "when does the pool open?", "gym timings"                               |
| Hotel info                | check-in/out time, WiFi password, front desk number                     |
| Escalation fallback       | 1st unknown → clarify + menu, 2nd → offer front desk button, 3rd+ → auto-escalate |

Multi-step flow state (amenity booking, cancellation, table reservation) is persisted in the `ConversationFlowState` DB table — server restarts do not break active flows.

### Multilingual Support
Language is picked at scan / OTP verify (12 languages: en, hi, ar, zh, fr, de, es, ru, ja, ko, pt, it). Button `value` strings are always English for server-side matching; only display `label` strings are translated. `guest_lang` in localStorage is authoritative over the DB value.

### Spa Booking Flow (example)
```
Guest:  "book spa"
Bot:    💆 Spa & Wellness Booking
        📅 Today:    15:00 | 16:00 | 17:00 | 18:00 | 19:00
        📅 Tomorrow: 09:00 | 10:00 | 11:00 | ... | 19:00
        Reply with your preferred time, e.g. "today at 3pm"

Guest:  "today at 3pm"
Bot:    ✅ Booking Confirmed!
        💆 Spa & Wellness  📅 Today — 22 Apr 2026  🕐 15:00 to 16:00
```
Slots are generated from the amenity's `openingTime`/`closingTime` in the DB. Past slots filtered for today.

---

## Guest Entry Flows

### Flow 1 — Email OTP (original)
1. Go to `/hotel/royal-palm-suites/verify`
2. Enter name, room number, email, check-in/out dates → Send OTP
3. OTP is printed to server console + shown in UI (dev mode)
4. Enter OTP → enter chat

### Flow 2 — Per-room QR (no OTP)
1. Staff generates a room-specific QR from `/app/qr`
2. Guest scans QR → lands on `/hotel/:slug/room/:roomNumber`
3. Enter name → enter chat immediately (no OTP)

---

## Demo Scenarios

### Scenario 1 — Pool timings
1. Enter guest chat → type "What time does the pool open?"
2. Bot replies with pool timings from the database ✅

### Scenario 2 — Spa booking
1. Type "book spa" → bot shows today + tomorrow 1-hour slots
2. Reply "today at 3pm" → bot confirms the booking
3. Staff sees the `Spa Appointment` service request in `/app/requests` ✅

### Scenario 3 — Housekeeping request
1. Type "I need housekeeping"
2. Bot creates a service request and confirms
3. Staff: `/app/requests` → Start → Complete ✅

### Scenario 4 — Food order
1. Type "I'm hungry" or tap **Order Food**
2. Browse menu, add items, tap Order
3. Staff: `/app/orders` → Acknowledge Bill ✅

### Scenario 5 — Escalation
1. Type something the bot doesn't recognise ("my TV remote is broken")
2. Bot escalates → `/app/chats` shows ⚠️ badge
3. Staff replies directly from the chat view ✅

### Scenario 6 — Admin edits menu
1. Log in as admin → `/app/menu` → edit a price
2. Guest sees updated price in the menu drawer ✅

---

## Development Notes

### OTP in Development
In `NODE_ENV=development`:
- OTP is printed to server console: `📧 OTP for email@example.com: 123456`
- Returned in the API response as `devOtp` and shown as a blue hint in the UI

In production, replace the OTP logic in `server/src/routes/guest.ts` with a real email provider (Resend, SendGrid, etc.).

### Database Studio
```bash
cd server
npm run db:studio
```
Opens at `http://localhost:5555`

### Reset demo data (operational data only)
```bash
npm run db:reset-demo
```
Deletes only runtime data (guest sessions, conversations, requests, orders, notifications, QR scans) and re-creates the three demo guests. Hotel, rooms, menu, amenities, services, and staff are **not touched**.

### Full reset and reseed
```bash
cd server
npx prisma migrate reset
npm run db:seed
```

---

## User Roles

| Capability               | Admin | Front Desk | Housekeeping | Restaurant |
|--------------------------|-------|------------|--------------|------------|
| Full dashboard + config  | ✅    | ❌         | ❌           | ❌         |
| Manage rooms/menu/etc.   | ✅    | ❌         | ❌           | ❌         |
| View/respond to chats    | ✅    | ✅         | ❌           | ❌         |
| Service requests         | ✅ all| ✅ own type| ✅ own type  | ✅ own type|
| Room orders              | ✅    | ❌         | ❌           | ❌         |
| Notifications            | ✅    | ✅         | ✅           | ✅         |
| Analytics                | ✅    | ❌         | ❌           | ❌         |
| Hotel settings           | ✅    | ❌         | ❌           | ❌         |

Each non-admin role sees only the service request types assigned to it in `ROLE_SERVICE_TYPES` (`server/src/routes/requests.ts`). Sidebar nav items are also scoped per role in `DashboardLayout.tsx`.

---

## Production Considerations

1. **JWT_SECRET** — use a strong random string (32+ chars)
2. **Email OTP** — integrate Resend or SendGrid in `server/src/routes/guest.ts`
3. **HTTPS** — required for production deployments
4. **Database** — use managed PostgreSQL (Supabase, Railway, Neon, RDS)
5. **NODE_ENV** — set to `production` to hide dev OTP hints
6. **CORS** — update `CLIENT_URL` in server `.env` to your frontend domain
7. **SSE + reverse proxy** — if using nginx, set `proxy_buffering off` and `proxy_read_timeout 3600` on the `/api/events` and `/api/guest/conversations/:id/events` paths to keep streams alive. The server also writes `:ping` every 25 s to prevent 30 s idle timeouts.
8. **Multi-instance deployments** — SSE clients are stored in a process-level `Set`. If you run multiple server instances behind a load balancer, staff/guests may miss events from other instances. Move to a pub/sub layer (e.g. Redis) in that case.

---

## License

MIT
