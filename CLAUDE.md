# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

XENITH CRM + Inventory Control System with RFID integration for audiovisual equipment rental. Built with Next.js 15 (App Router), React 19, TypeScript, Prisma ORM, PostgreSQL, and NextAuth.js v5.

## Development Commands

```bash
# Development server (Turbopack disabled by default — Windows compatibility issue)
npm run dev
npm run dev:turbo    # Turbopack enabled (may be unstable on Windows)

# Build & production
npm run build
npm run start

# Linting
npm run lint

# Database
docker compose up -d          # Start PostgreSQL
docker compose down           # Stop PostgreSQL
npx prisma migrate dev        # Run migrations + generate client
npx prisma studio             # Database GUI
npm run db:seed               # Seed demo data (creates superadmin: camilo.vargas@xenith.com.co / admin123)

# Email template preview
npm run email:dev             # Starts react-email dev server at localhost:3000
```

No test framework is configured in this project.

## Architecture

### Route Groups (App Router)
- `app/(auth)/` - Login page (unauthenticated)
- `app/(dashboard)/` - Protected routes; layout wraps Sidebar + DashboardHeader + MobileBottomNav (+ `RouteGuard`)
- `app/(public)/` - Public landing pages (inicio, soluciones, contacto)
- `app/api/` - REST API endpoints

Route protection runs in `middleware.ts` (Edge runtime) using the edge-safe `auth.config.ts` (no bcrypt/Prisma). It returns 401 for protected `/api/*` (except `PUBLIC_API_PREFIXES`: `/api/auth`, `/api/contact`, `/api/health`), redirects unauthenticated `/dashboard/*` to `/login`, and blocks cross-origin mutating API requests (CSRF). The full credentials provider lives in `auth.ts`. The middleware `matcher` excludes static assets (`/images`, `/icons`, `_next`, image file extensions) — important because the 360 panoramas load from `public/images/ubicaciones` and must stay publicly reachable.

### Dashboard Shell & Navigation
- **Single source of truth for the menu**: `components/layout/nav-config.ts` (`navSections`, `segmentLabels` for Spanish breadcrumbs, `isNavActive`, `resolveHref`). Sidebar, header breadcrumbs and mobile bottom nav all read from it — add new pages there.
- Nav items declare `modules` (visible if the user can view ANY of them), `adminOnly`, `matches` (extra active prefixes) and `fallbackHref` (e.g. "Equipos" goes to `/items` if the user lacks `productos`).
- `Sidebar.tsx` (grouped sections, brand logo `public/images/logo_shock_trim.png`, framer-motion active indicator), `DashboardHeader.tsx` (Spanish breadcrumbs + avatar), `MobileBottomNav.tsx` (adapted from a 21st.dev "Bottom Nav Bar"; hidden on `lg+`).
- Home `/dashboard` = `components/dashboard/DashboardHome.tsx`: REAL data from existing APIs (projects, clients, quotations, my tasks, inventory summary); each block only shows if the user can view that module. `StatsCard` supports `href` + count-up.
- Brand: dark background + orange `#F5920A`. Surfaces use `bg-[#141414]/80 border-white/[0.07] rounded-2xl`; keep accents orange (no per-section rainbow colors).

### Inventory UX: Producto → Unidad
- In the UI, **Producto** = catalog model (`Product`) and **Unidad** = physical piece (`InventoryItem`, a.k.a. "item"). The menu entry is **Equipos**.
- `/dashboard/inventario/productos` and `/dashboard/inventario/items` both render `components/dashboard/inventory/EquipmentCatalog.tsx` (`defaultView` productos/unidades). "Por producto" = product cards with an availability bar that expand to their units; "Todas las unidades" = `InventoryItemsTable`. Client-side filtering over `/api/products` + `/api/inventory`. URL params: `?productId=<id>` (expand + scroll), `?vista=unidades|productos`.
- `items/nuevo?productId=<id>` pre-selects the product (`InventoryItemForm` prop `defaultProductId`) and returns to that product after saving.
- Shared status labels/colors + `formatCOP` live in `components/dashboard/inventory/status.ts`.
- `ProductsTable`, `RecentActivity` and `QuickActions` are no longer used (kept in the repo).

### Teams ("Equipo") — `/dashboard/equipo`
- Models `Team` + `TeamMember` (role, responsibilities one-per-line, `isLead`, `order`); unique `(teamId, userId)`, cascade on team/user delete.
- **Every active user can view; only SUPERADMIN can create/edit/delete** (enforced in `app/api/teams` via `requireSuperAdmin()`). PUT replaces the full member list in a transaction. Actions are audit-logged with module `equipo`. Not a `SystemModule` (no per-user permission).
- UI: `app/(dashboard)/dashboard/equipo/page.tsx` + `components/teams/TeamEditor.tsx`; the member picker uses `/api/users?forSelect=true`. Shared Prisma include in `lib/teams/shared.ts`, zod in `lib/validations/team.ts`.

### API Pattern
All API routes follow this pattern:
1. Check permission with the helpers in `lib/auth/check-permission.ts` (`canViewModule` / `canEditModule` / `requireSuperAdmin` / `requireActiveUser`), or `auth()` from `@/auth` for session-only checks
2. Validate input with Zod schemas from `lib/validations/`
3. Use Prisma client from `lib/db/prisma.ts`
4. Return `NextResponse.json()`

### State Management
- **Zustand stores** (`store/`): One store per entity (auth, clients, projects, quotations, categories, products, suppliers, inventory, itemGroups, locations, concepts, rfid, tasks, ui)
- **React Hook Form + Zod**: Form state and validation; Zod schemas are shared between client forms and API routes
- **Custom hooks** (`hooks/`): One hook per entity — wraps store + API calls, exposes loading/error state

### Permission & Audit Systems
- `lib/auth/check-permission.ts` — server-side helpers. They load role, `isActive` and the module permission **from the DB on every call** (never trust the JWT role — tokens live 24 h), so deactivations and role changes apply immediately. Also `requireSuperAdmin()` and `requireActiveUser()`.
- `components/auth/RouteGuard.tsx` — client page guard: route→module map, `publicRoutes` (`/dashboard/perfil`, `/dashboard/equipo`), `adminRoutes` (`/dashboard/usuarios`, `/dashboard/comunicados`). UI only; the API is the real enforcement.
- Users API (`app/api/users`): ADMIN/SUPERADMIN only, role read from the DB. **Only SUPERADMIN can create/modify/deactivate ADMIN users or grant ADMIN**; nobody can create or modify the SUPERADMIN.
- Per-user data (profile, password, avatar) always uses the session user id — never an id from the URL/body (IDOR protection). Keep it that way for any new "my X" endpoint.
- `components/auth/PermissionGate.tsx` — client-side conditional rendering by permission
- `lib/audit/log.ts` — logs critical actions to `AuditLog` (module, action, entity, IP, user agent)
- Audit history visible at `/dashboard/historial`

### Email System
- **Sending**: Resend SDK (`RESEND_API_KEY` env var required)
- **Templates**: React Email components in `components/email/`; preview with `npm run email:dev` (templates in `react-email-starter/emails/`)
- Task notifications and contact form submissions use `@react-email/components` + `resend`

### Database Models (Prisma)

#### CRM Models
- **User**: Roles (SUPERADMIN, ADMIN, USER), bcrypt-hashed passwords, per-module `UserPermission` records
- **Client**: Customer records
- **Project**: Status (PROSPECT, IN_PROGRESS, ON_HOLD, COMPLETED, CANCELLED), priority levels
- **Task**: Sub-tasks within projects (TODO, IN_PROGRESS, DONE)
- **Quotation**: Auto-numbered (QT-YYYY-NNNN), status (DRAFT, SENT, ACCEPTED, REJECTED, EXPIRED)
- **QuotationItem**: Line items with optional link to `InventoryItem`
- **QuotationGroup**: Equipment package line items linked to `ItemGroup`

#### Inventory Models
- **Category**: Product categories with color/icon
- **Supplier**: Equipment suppliers with contact info
- **Product**: Product catalog with SKU, brand, unit & rental pricing, soft-delete
- **ProductSupplier**: Many-to-many product-supplier relationship
- **InventoryItem**: Physical items with RFID, serial number, asset tag, status (IN, OUT, MAINTENANCE, LOST). Has `locationId` (FK → `Location`) plus a `location` string snapshot of the location's `fullPath` (kept for movements/display); the item form uses a structured location picker, not free text. Also `imageUrl` is inherited from its product.
- **Location**: Self-referencing hierarchical tree of physical storage locations — `SECTOR` (letters) → `CUADRANTE` (numbers) → `RACK` (letters) → `NIVEL` (numbers) → `POSICION` (numbers). Levels are optional/skippable. Each node has `code`, optional `description`, precomputed `fullPath` (e.g. `A · 1 · B`), and for 360 viewing: `panoramaUrl` (path under `public/images/ubicaciones`), `markerYaw`/`markerPitch` (radians) and `markerOnLocationId` (which ancestor panorama hosts this node's marker). Hierarchy/code rules + helpers in `lib/validations/location.ts`.
- **ItemGroup**: Named equipment packages used in quotations
- **BulkInventory**: Quantity-based inventory without RFID
- **BulkMovement**: Bulk inventory movement history
- **RfidTag**: RFID tags with EPC, status (ENROLLED, UNASSIGNED, UNKNOWN)
- **RfidDetection**: RFID read log from readers (RSSI, direction, reader ID)
- **InventoryMovement**: Item movement audit trail

#### Admin Models
- **Team / TeamMember**: Internal work teams (see the Teams section)
- **AuditLog**: Action history (module, action, entityType, entityId, metadata, IP, userAgent)
- **UserPermission**: Per-module access control (canView, canEdit) per user

### Locations & 360 Panoramas (Photo Sphere Viewer)
- UI at `/dashboard/inventario/ubicaciones` (module `ubicaciones`). Builds the `Location` tree; each node can be assigned a 360 panorama and a click-placed marker.
- API: `app/api/locations` (GET tree / POST), `app/api/locations/[id]` (GET/PUT/DELETE — PUT recomputes descendants' `fullPath`; DELETE cascades), `app/api/locations/[id]/panorama` (assign/clear image), `app/api/locations/[id]/marker` (set/clear marker), `app/api/locations/[id]/panorama-context` (resolves the panorama + markers to show for a target node by walking up to the nearest ancestor with a panorama), and `app/api/locations/panoramas` (GET — lists image files from `public/images/ubicaciones`).
- 360 images are **static files in `public/images/ubicaciones/`** (a fixed reusable set), NOT uploaded to R2. They are equirectangular (2:1). Selected via a gallery picker in the editor.
- Viewer: `components/locations/PanoramaViewer.tsx` wraps `@photo-sphere-viewer/core` + `markers-plugin` (vanilla JS over three.js). Loaded **client-only** via `next/dynamic({ ssr:false })`. Creation is deferred one tick + cancelable to survive React Strict Mode's double-mount (otherwise PSV hangs on "loading"). **three is pinned to `0.184.0`** (caret `^0.184.0`) to match PSV's required range — a newer three causes a duplicate-instance warning and breaks the viewer.
- The 360 viewer is reachable from: item detail, product detail, products table, items table (`PanoramaLocationModal` / `ProductPanoramaButton`) and the locations tree.

### Image Storage (Cloudflare R2)
- Product images and **user avatars** use R2 (`lib/storage/r2.ts` — custom AWS SigV4 signing, no SDK). Product upload/delete via `app/api/uploads/products` (DELETE only accepts keys under the products prefix — `isProductImageKey`). Product hard-delete also removes its R2 image; soft-delete keeps it.
- **Avatars**: `app/api/uploads/avatar` (POST/DELETE, current user only) → key `avatars/<userId>/<ts>.<ext>` (`R2_AVATARS_PREFIX`, default `avatars`), magic-byte validation, previous avatar deleted. Stored in the existing `User.image` column. The client crops to a 512px square (`components/profile/AvatarUploader.tsx`) and calls NextAuth `update({ image })`; the `jwt` callback in `auth.config.ts` accepts ONLY `image` on `trigger === 'update'`. Render avatars with `components/ui/UserAvatar.tsx` (initials fallback).
- `components/ui/ImagePicker.tsx` (upload/replace/remove + preview), `ProductThumbnail.tsx` (click-to-enlarge), `ImagePreviewModal.tsx` (zoom/rotate). Thumbnails appear in products & items tables and detail pages.
- Requires R2 env vars (see Environment Setup). Product images render via plain `<img>` (no CORS needed). (Location 360s do not use R2.)

### Responsive / Mobile
- The dashboard shell is mobile-first: the sidebar is a drawer (closes on route change), plus a floating bottom nav on `<lg`. `main` has `pb-bottom-nav` so content isn't hidden behind it. Global mobile CSS in `app/globals.css` forces 16px inputs (no iOS zoom). Buttons are taller on mobile (`h-9`/`h-11`). Detail-page header action rows use `flex flex-wrap`.
- Page titles use `text-2xl sm:text-3xl`. List headers stack on mobile with `flex flex-col gap-4 sm:flex-row ...`.
- **Tables → cards on mobile**: most list tables add `className="table-cards"` to `<Table>`; a global CSS rule in `app/globals.css` (`@media max-width:767px`) turns each row into a card and hides the header. Products/Items tables instead ship bespoke mobile cards (`md:hidden`) + desktop table (`hidden md:block`). Reuse `table-cards` for any new list table.

### Security Features
- Rate limiting in `lib/security/rate-limiter.ts` — in-memory (5 login attempts/15 min, 3 contact forms/hour); consider Redis for production
- Strong password validation in `lib/validations/auth.ts` (8–128 chars, mixed case, number, special char, no common passwords)
- Security headers (CSP, HSTS, X-Frame-Options) configured in `next.config.ts`
- Constant-time password comparison in NextAuth credentials provider

## Environment Setup

Copy `.env.example` to `.env`. Required variables:
```
DATABASE_URL="postgresql://shock:shock123@localhost:5433/shock_db"
AUTH_SECRET=<generate with: openssl rand -base64 32>
NEXTAUTH_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
RESEND_API_KEY="re_..."           # Required for email sending (contact form, task notifications)
RFID_API_KEY="your-rfid-reader-api-key"

# Cloudflare R2 — required for PRODUCT image upload/preview (not for 360 panoramas)
R2_ACCOUNT_ID="..."
R2_ACCESS_KEY_ID="..."
R2_SECRET_ACCESS_KEY="..."
R2_BUCKET_NAME="shock-images"
R2_ENDPOINT="https://<account_id>.r2.cloudflarestorage.com"
R2_PUBLIC_URL="https://<public-bucket-or-custom-domain>"
R2_REGION="auto"
R2_PRODUCTS_PREFIX="products"
R2_AVATARS_PREFIX="avatars"       # optional
```

## Deployment (Railway) & Database Safety
- **The production DB has real data.** The local `.env` may point at the Railway production database — never run destructive commands (`migrate dev`, `migrate reset`, `db push --force-reset`) against it. Only additive migrations, applied with `npx prisma migrate deploy`.
- New migrations: write the SQL in `prisma/migrations/<timestamp>_<name>/migration.sql` and verify it with `npx prisma migrate diff --from-schema-datamodel <old.prisma> --to-schema-datamodel prisma/schema.prisma --script` (needs no DB).
- `railway.toml` is config-as-code (fields set there are locked in the Railway dashboard): `preDeployCommand = ["npx prisma migrate deploy"]` (must EXIT — never start the server there, or deploys hang), `startCommand = "npm run start"`, healthcheck `/api/health` (public, runs `SELECT 1`).
- `postgres.railway.internal` only resolves inside Railway; from a local machine you need the TCP-proxy public URL (`DATABASE_PUBLIC_URL`), which is disabled by default.
- Production URL: https://www.shock-producciones.com
- The Railway CLI (`railway.exe`) is blocked on the dev machine by Windows Smart App Control ("Una directiva de Control de aplicaciones bloqueó este archivo") — use the Railway dashboard instead.

## Dev Workflow Gotchas (Windows)
- **Do NOT run `npm run build` / `next build` while `npm run dev` is running** — it overwrites `.next` and corrupts the dev server (`Cannot find module './xxxx.js'`). To type-check during dev use `npx tsc --noEmit` (does not touch `.next`). If `.next` gets corrupted: stop dev, `rm -rf .next`, restart.
- `npm run lint` is broken (eslint can't resolve `eslint-config-next/core-web-vitals`); validate with `npx tsc --noEmit` and `next build` instead.
- `prisma generate` can fail with `EPERM` renaming the query engine DLL while the dev server holds it — stop the dev server first.
- 360 panoramas need same-origin images in `public/images/ubicaciones/` (no R2/CORS). New panorama images: drop equirectangular (2:1) files there; they appear automatically in the picker.

## Mobile API (`/api/mobile/v1`) — attendance app

Backend for the Expo attendance app (repo at `C:\dev\xenith-asistencia`, design docs in its `docs/`). It shares the DB, `User`, roles and `UserPermission` with the web, but **authentication is separate**: the web keeps the NextAuth cookie; the app uses tokens.

- **`/api/mobile` is excluded from the cookie check in `middleware.ts`** (`PUBLIC_API_PREFIXES`). Every route under it MUST be wrapped with `authedMobileRoute` from `lib/mobile/handler.ts` — a route without it is public. Use `publicMobileRoute` only for login and refresh.
- **Tokens**: access token = HS256 JWT, 15 min, signed with `MOBILE_JWT_SECRET` (must differ from `AUTH_SECRET`, ≥ 32 chars; if missing only the mobile API fails, with `SERVER_MISCONFIGURED`). It carries only user id + session id — role/permissions are always read from the DB. Refresh token = opaque, rotated on every use, stored only as a SHA-256 hash in `MobileSession`; the previous token is accepted for 2 min (lost responses), after that reuse revokes the whole session. Sessions are also revoked on logout, user deactivation and password change (password fingerprint).
- **Responses**: success `{ data }`, error `{ error: { code, message, details? } }`. Codes live in `lib/mobile/errors.ts` and are a contract with installed app versions — never rename one.
- **Login rate limit** is stored in Postgres (`MobileLoginAttempt`), not in `lib/security/rate-limiter.ts`.
- **All attendance thresholds live in `lib/attendance/config.ts`** — do not hardcode them elsewhere.
- `lib/mobile/credentials.ts` intentionally duplicates the credential check of `auth.ts`; if you change one, review the other.
- Endpoints so far: `POST auth/login`, `POST auth/refresh`, `POST auth/logout`, `GET me` (includes `activation`), `GET|POST consent`, `POST device`.

### App activation: consent + bound phone (Phase 3)
- **Consent text lives in code**: `lib/attendance/consent.ts` (`CURRENT_CONSENT`). To publish a new version change the text AND `version`, then deploy — every employee must accept again. Each `ConsentAcceptance` stores version + SHA-256 of the exact text (`consentTextHash`), installation id, IP and user agent. A POST with a stale version/hash is rejected (`CONSENT_OUTDATED`). The text is still a DRAFT pending legal review.
- **One active phone per employee**, enforced by the DB: `MobileDevice.activeUserId` is unique and equals `userId` while active, `NULL` once unbound. Binding requires current consent and uses the installation id stored in the SESSION (set at login), never one from the request body. Logging in from another phone is allowed; `/me` reports `device.status = other_device` and binding fails with `DEVICE_BOUND_ELSEWHERE`.
- **Unbinding is web-only**: `DELETE /api/users/[id]/mobile/device` (ADMIN/SUPERADMIN, same hierarchy as the users API via `lib/mobile/admin-access.ts`). It also revokes the app sessions opened on that phone and writes an `AuditLog` (`MOBILE_DEVICE_UNBOUND`). `GET /api/users/[id]/mobile` feeds the "App móvil" section of the users modal (`components/users/MobileAppStatus.tsx`).
- Users have optional `cedula` (unique, digits only) and `phone`, editable in the users page; a cédula change is audit-logged (`USER_CEDULA_CHANGED`).

### Local database & production guard
- `npm run db:local:migrate | db:local:seed | db:local:studio` and `npm run dev:local` force `DATABASE_URL` to the docker-compose Postgres (`localhost:5433`); `dev:local` also sets a dev-only `MOBILE_JWT_SECRET` that the server rejects in production.
- `prisma/seed.ts` calls `assertLocalDatabase()` (`lib/db/local-guard.ts`) and aborts on any non-local host. `npm run db:guard` runs the same check.
- The guard cannot intercept a hand-typed `npx prisma migrate dev`; never run it with a non-local `DATABASE_URL`.
- Tests: `npm test` (vitest, pure logic in `tests/`) and `npm run mobile:smoke` (end-to-end against `npm run dev:local`; creates and deletes its own test user).

### Face enrollment (Phase 4)
- Flow: app requests `POST /api/mobile/v1/liveness/attempts` (server picks the challenge order; one-use, 3 min) → on-device liveness → `POST /api/mobile/v1/enrollment` (multipart `photo` + `attemptId`). Requires current consent AND this phone bound. Server checks size (≤ 1 MB) and JPEG magic bytes, runs Rekognition `DetectFaces` and `evaluateEnrollmentQuality` (thresholds in `lib/attendance/config.ts` → `enrollment`), stores the photo in the PRIVATE R2 bucket (`lib/storage/r2-private.ts`, env `R2_ATT_*`) and creates a `FaceEnrollment` in `PENDING`. Logic in `lib/attendance/enrollment.ts`.
- One PENDING-or-APPROVED enrollment per user, enforced by the unique `activeUserId` column. A new submission while pending supersedes the old one. Rejected / superseded / revoked photos are deleted from the bucket immediately; the approved one is kept.
- Review is web-only at `/dashboard/asistencia/registros` (`/api/attendance/enrollments*`): list needs `asistencia_reportes` view; approve / reject / revoke needs `asistencia_reportes` edit (SUPERADMIN always). Reject/revoke need a reason. **Nobody can review their own enrollment.** Photos are shown via 5-minute signed URLs and every view is audit-logged (`FACE_ENROLLMENT_PHOTO_VIEWED`).
- New modules `asistencia_areas` and `asistencia_reportes` (group "Asistencia"); menu entry in `nav-config.ts`, route guard maps `/dashboard/asistencia` → `asistencia_reportes`.
- Rekognition uses `AWS_REGION` / `AWS_ACCESS_KEY_ID` / `AWS_SECRET_ACCESS_KEY` (IAM user limited to CompareFaces + DetectFaces). Local keys live in `.env.local` (gitignored); production needs them in Railway.
- `npm run mobile:smoke` loads `.env.local` and uses a real face photo (`SMOKE_FACE_IMAGE`, defaults to the owner's test photo in the app repo); it calls the real Rekognition and R2 and cleans up after itself.
