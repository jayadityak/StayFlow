# CLAUDE.md — StayFlow

## 1. Project Overview

StayFlow is a multi-tenant hotel guest experience and staff operations platform. Guests interact via a multilingual AI-assisted chat (triggered by a per-room QR scan); hotel staff manage requests, orders, amenity bookings, and live chat escalations through a role-based dashboard.

Core goals: Multi-tenancy correctness (every query scoped by `hotelId`), real-time reliability (SSE), guest-facing simplicity, and production readiness from day one. Favour minimal, precise changes over rewrites.

Act as a senior full-stack engineer who knows this codebase intimately. Think step-by-step before coding. Flag uncertainties and trade-offs clearly.

---

## 2. Working Rules

Whenever a task is prompted:

1. Understand the task fully before making changes.
2. Make the required changes carefully.
3. Verify the result after completing the work.
4. Only say **complete** if the task has actually been verified successfully.
5. If verification fails, clearly state what failed and do not mark it complete.
6. Do not assume success without checking.
7. Prefer precise, minimal, correct changes over unnecessary rewrites.

### Execution Standard

For every task, follow this sequence:

- Read the request
- Implement the change
- Run checks / verify output
- Confirm result
- Then respond with: **complete**

### Verification Requirement

Verification should include whichever is relevant:

- `tsc --noEmit` passes (server and/or client)
- ESLint passes (`npm run lint`)
- Expected output is produced
- File changes are present and correct
- No obvious runtime errors remain

---

## 3. Tech Stack

- **Frontend**: React 18 + Vite + TypeScript (strict)
- **Styling**: Tailwind CSS (utility-only; no custom CSS unless justified)
- **Backend**: Express + TypeScript (`tsx watch` in dev, `tsc → dist/` in prod)
- **Database**: PostgreSQL + Prisma ORM
- **Auth**: JWT (staff, 7-day) + custom session token (guests, `x-guest-token`)
- **State (client)**: TanStack Query for server state; React Context for auth
- **Real-time**: SSE via `fetch()` + `ReadableStream` (no `EventSource` — custom headers needed)
- **AI**: Anthropic SDK (`claude-haiku-4-5`) — guest chat fallback via `server/src/lib/llm.ts`
- **Validation**: Zod on all API inputs
- **i18n**: Custom `T(lang, key, vars)` server-side (`lib/i18n.ts`), `TEN(key, vars)` always-English shortcut, `t(lang, key, vars)` client-side (`lib/guestI18n.ts`)
- **Translation**: `server/src/lib/translation.ts` — `translateToEnglish(text, lang)` MVP placeholder; ready to swap in DeepL/Google

**Never introduce new major dependencies without explicit approval.**

---

## 4. Project Structure

```
stayflow/
├── client/                        React 18 + Vite (guest portal + staff dashboard)
│   └── src/
│       ├── features/              Domain features (chats, requests, orders, guest, auth, …)
│       ├── hooks/                 Shared hooks (useSSEEvents, etc.)
│       └── lib/                   api.ts, guestI18n.ts, utils
└── server/                        Express + Prisma
    └── src/
        ├── routes/                One file per domain (guest.ts, requests.ts, orders.ts, …)
        ├── lib/                   prisma.ts, sse.ts, i18n.ts, translation.ts, llm.ts, checkoutUtils.ts, cleanup.ts
        └── middleware/            auth.ts (authenticate, AuthRequest)
```

Vite proxies `/api/*` → `http://localhost:4000` in dev — the client always calls `/api/...`.

---

## 5. Architecture Rules

### Multi-tenancy (CRITICAL)
Every DB model has a `hotelId` foreign key. **All** staff API routes must filter by `req.user.hotelId`. Never return or mutate data across hotel boundaries. This is the single most common place for bugs — always verify scope.

### Authentication
- **Staff**: JWT in `localStorage` as `token`. Sent as `Authorization: Bearer <token>`. Validated by `authenticate` middleware.
- **Guests**: Token in `localStorage` as `guest_token`. Sent as `x-guest-token`. Validated by `verifyGuestToken` — uses `findUnique` with **no `select`** so all fields (including `preferredLanguage`) are always on `req.guestSession`.

### Guest Entry
- QR scan only: `/hotel/:slug/room/:roomNumber` → language picker → name → `POST /guest/room-session` → chat.
- No OTP or email-based entry.

### Guest Chat — Hybrid Rule-Based + AI
`processGuestMessage()` in `server/src/routes/guest.ts` is the core engine:
1. Structured flows (amenity booking, cancellation, table booking) — fully rule-based via `ConversationFlowState` in DB.
2. Service keyword matching — `SERVICE_KEYWORDS` array maps phrases to service types.
3. Fallback (first unrecognised message) — calls `askClaudeForGuest()` in `lib/llm.ts`. Returns Claude's response if available; falls back to canned reply if key is missing or call fails.
4. Repeated unknowns — `unknownCount` on `Conversation` (DB column, not in-memory). After 2 unknowns offer front desk button; after 3+ auto-escalate.

**`infoOnly` service types** (e.g. Early Check-in): matched but no DB request created — redirect to front desk.

### Multilingual
- 12 languages: `en, hi, ar, zh, fr, de, es, ru, ja, ko, pt, it`
- Always use `T(lang, key, vars)` server-side and `t(lang, key, vars)` client-side. **Never hardcode English strings in guest-facing flows.**
- Button `value` strings sent to server must always be English (NLP keyword matching). Only display `label` strings are translated.
- `guest_lang` in localStorage is authoritative; sent in every message POST body as `lang`.
- Arabic: `dir="rtl"` on all guest page root divs.

#### Two-language message contract (CRITICAL)
Every message in the DB carries two content fields:

| Field | Who reads it | What it contains |
|---|---|---|
| `content` | Guest (`GuestChatPage`) | Localized text in guest's language |
| `englishContent` | Staff (`ChatsPage`, previews) | English equivalent; falls back to `content` for old messages |
| `originalLanguage` | Both | BCP-47 lang code (`'en'`, `'hi'`, etc.) |

**Rules for generating messages:**
- Every `return` from `processGuestMessage()` must include **both** `message` (localized via `T(lang, ...)`) **and** `englishMessage` (via `TEN(...)`). Missing `englishMessage` means staff sees the guest's language.
- For system/assistant messages generated from i18n keys: `englishMessage = TEN(key, vars)`.
- For guest free-text messages stored as service request details or notification bodies: use `translateToEnglish(content, lang)` — returns `[Language — translation pending] <original>` until a real API is wired.
- `createServiceRequest(hotelId, session, type, billable, content, lang)` — **always pass `lang`** when the `content` could be in the guest's language; it uses `translateToEnglish` internally for both `details` and `notification.body`.
- Service amenity info builder (`amenityUnavailable`, `amenityOpen` keys): must use `T(lang, ...)` for guest message and `TEN(...)` for English equivalent — never build both from the same hardcoded English string.

#### i18n helpers (server)
- `T(lang, key, vars)` — returns string in the given language
- `TEN(key, vars)` — shortcut for `T('en', key, vars)`, always English
- `translateToEnglish(text, lang)` — from `lib/translation.ts`; returns original if English, else placeholder

#### Adding a new i18n key
Add the key to **all 12 language blocks** in `server/src/lib/i18n.ts`. Keys missing from a language silently fall back to the key name — always add to all 12.

### Real-Time (SSE)
- Staff: `GET /api/events` → `addSSEClient(hotelId, res)` → `emitToHotel(hotelId, event, data)`
- Guest: `GET /api/guest/conversations/:id/events` → `addGuestSSEClient` → `emitToConversation`
- Keep-alive ping every 25 s on both endpoints.
- Polling fallbacks in case SSE drops: guest 30 s, staff chat 15 s, chat list 30 s, notifications 8 s.

### Session Expiry
Guests lose access at noon on their checkout day. `isSessionActive(session)` in `lib/checkoutUtils.ts` enforces this. Background cleanup runs on startup + hourly (`lib/cleanup.ts`).

### Staff Roles & Routing
`ROLE_SERVICE_TYPES` in `server/src/routes/requests.ts` is the single source of truth for which role sees which service type:
- `housekeeping` — Housekeeping, Extra Towels, Laundry, Maintenance, AC, etc.
- `frontdesk` — Currency Exchange, Limo / Car Service, Late Check-out, Early Check-out, etc.
- `restaurant` — Restaurant Reservation, Water / Beverages, Minibar Restock, etc.
- `admin` — sees everything

Nav items per role live in `DashboardLayout.tsx`.

---

## 6. Coding Conventions

- **TypeScript**: Strict mode, no `any`, prefer explicit return types on exported functions.
- **Naming**: `PascalCase` for components/types, `camelCase` for variables/functions, `kebab-case` for file names.
- **Exports**: Named exports preferred.
- **Components**: Functional + hooks only. Keep under ~150 lines; split if larger.
- **No business logic in route handlers**: Extract to service functions or helpers.
- **No `console.log` in production paths** — use descriptive `console.error` for caught exceptions only.
- **DB changes always require a migration** (`npm run db:migrate`). Never use `db push` on a shared or production DB.
- **Zod validation on all API inputs** — never trust `req.body` raw.
- **No prop drilling** — use TanStack Query or context.

---

## 7. Common Commands

All commands run from `stayflow/` root unless noted.

```bash
# Development
npm run dev:server          # Express on port 4000 (tsx watch)
npm run dev:client          # Vite on port 5173
npm run install:all         # Install deps for both workspaces

# Database
npm run db:migrate          # Prisma migrate dev
npm run db:seed             # Seed demo data (Royal Palm Suites)
npm run db:studio           # Prisma Studio at localhost:5555
npm run db:reset            # Drop all → re-migrate → re-seed
npm run db:reset-demo       # Reset runtime data only (keeps hotel/rooms/menu/staff)

# From server/
npx prisma generate         # Regenerate client after schema changes
npx prisma db push          # Push schema without migration history (dev only)

# Build & type-check
cd client && npm run build  # tsc + vite build
cd client && npm run lint   # ESLint on .ts/.tsx
cd server && npm run build  # tsc → dist/
cd server && npx tsc --noEmit  # Type-check without emitting
```

---

## 8. Environment Variables

Copy `server/.env.example` → `server/.env`. Required:

| Variable | Notes |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Any string in dev; 32+ chars in prod |
| `PORT` | `4000` |
| `CLIENT_URL` | `http://localhost:5173` |
| `ANTHROPIC_API_KEY` | Required for AI fallback in guest chat; omit to disable gracefully |

---

## 9. Recurring Mistakes & Lessons

- **Always scope queries by `hotelId`** — missing this leaks cross-tenant data.
- **After any Prisma schema change**: run `npx prisma generate` in `server/` and restart the dev server.
- **After adding a new service type**: update `ROLE_SERVICE_TYPES` in `requests.ts` or it won't route to any staff role.
- **Never hardcode strings in guest-facing code** — always go through `T()` / `t()`. This includes dynamic message paths like the service-notes branch and amenity info builder.
- **Button `value` fields are NLP inputs** — keep them English regardless of guest language.
- **`verifyGuestToken` uses no `select`** — do not add a `select` clause or `preferredLanguage` will be missing downstream.
- **Every `processGuestMessage` return must include `englishMessage`** — omitting it causes staff to see the guest's language. Use `TEN(key, vars)` for i18n-keyed messages and `translateToEnglish(text, lang)` for LLM/free-text responses.
- **`createServiceRequest` requires `lang` at call site** — when passing raw guest `content`, always pass the resolved `lang` so `details` and `notification.body` are stored in English (or with translation placeholder).
- **Adding i18n keys: update all 12 languages** — keys are in `server/src/lib/i18n.ts` as a `Record<Lang, Record<string, string>>`. A key missing from any language block silently returns the key name at runtime.
- **Never commit `.env` files or secrets.**

---

## 10. Demo Credentials (seeded by `db:seed`)

| Role | Email | Password |
|---|---|---|
| Admin | `admin@royalpalm.com` | `admin123` |
| Front Desk | `staff@royalpalm.com` | `staff123` |
| Housekeeping | `housekeeping@royalpalm.com` | `staff123` |
| Concierge | `concierge@royalpalm.com` | `staff123` |

- Hotel slug: `royal-palm-suites`
- Active demo guest rooms: 103 (Arjun Kapoor), 203 (Sneha Joshi), 302 (Vikram Nair)

---

**Maintenance note**: Update section 9 whenever a recurring mistake is identified. Review and prune after major refactors.
