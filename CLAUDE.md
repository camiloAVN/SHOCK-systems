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
- `app/(dashboard)/` - Protected routes; layout wraps Navbar + Sidebar
- `app/(public)/` - Public landing pages (inicio, soluciones, contacto)
- `app/api/` - REST API endpoints

Route protection runs in `middleware.ts` (Edge runtime) using the edge-safe `auth.config.ts` (no bcrypt/Prisma). It returns 401 for protected `/api/*` (except `PUBLIC_API_PREFIXES`: `/api/auth`, `/api/contact`, `/api/health`), redirects unauthenticated `/dashboard/*` to `/login`, and blocks cross-origin mutating API requests (CSRF). The full credentials provider lives in `auth.ts`. The middleware `matcher` excludes static assets (`/images`, `/icons`, `_next`, image file extensions) — important because the 360 panoramas load from `public/images/ubicaciones` and must stay publicly reachable.

### API Pattern
All API routes follow this pattern:
1. Check session with `auth()` from `@/auth`
2. Validate input with Zod schemas from `lib/validations/`
3. Use Prisma client from `lib/db/prisma.ts`
4. Return `NextResponse.json()`

### State Management
- **Zustand stores** (`store/`): One store per entity (auth, clients, projects, quotations, categories, products, suppliers, inventory, itemGroups, locations, concepts, rfid, tasks, ui)
- **React Hook Form + Zod**: Form state and validation; Zod schemas are shared between client forms and API routes
- **Custom hooks** (`hooks/`): One hook per entity — wraps store + API calls, exposes loading/error state

### Permission & Audit Systems
- `lib/auth/check-permission.ts` — server-side helpers (`canViewModule`, `canEditModule`) checking `UserPermission` records
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
- **AuditLog**: Action history (module, action, entityType, entityId, metadata, IP, userAgent)
- **UserPermission**: Per-module access control (canView, canEdit) per user

### Locations & 360 Panoramas (Photo Sphere Viewer)
- UI at `/dashboard/inventario/ubicaciones` (module `ubicaciones`). Builds the `Location` tree; each node can be assigned a 360 panorama and a click-placed marker.
- API: `app/api/locations` (GET tree / POST), `app/api/locations/[id]` (GET/PUT/DELETE — PUT recomputes descendants' `fullPath`; DELETE cascades), `app/api/locations/[id]/panorama` (assign/clear image), `app/api/locations/[id]/marker` (set/clear marker), `app/api/locations/[id]/panorama-context` (resolves the panorama + markers to show for a target node by walking up to the nearest ancestor with a panorama), and `app/api/locations/panoramas` (GET — lists image files from `public/images/ubicaciones`).
- 360 images are **static files in `public/images/ubicaciones/`** (a fixed reusable set), NOT uploaded to R2. They are equirectangular (2:1). Selected via a gallery picker in the editor.
- Viewer: `components/locations/PanoramaViewer.tsx` wraps `@photo-sphere-viewer/core` + `markers-plugin` (vanilla JS over three.js). Loaded **client-only** via `next/dynamic({ ssr:false })`. Creation is deferred one tick + cancelable to survive React Strict Mode's double-mount (otherwise PSV hangs on "loading"). **three is pinned to `0.184.0`** (caret `^0.184.0`) to match PSV's required range — a newer three causes a duplicate-instance warning and breaks the viewer.
- The 360 viewer is reachable from: item detail, product detail, products table, items table (`PanoramaLocationModal` / `ProductPanoramaButton`) and the locations tree.

### Image Storage (Cloudflare R2)
- **Product images only** use R2 (`lib/storage/r2.ts` — custom AWS SigV4 signing, no SDK). Upload/delete via `app/api/uploads/products`. Product hard-delete also removes its R2 image; soft-delete keeps it.
- `components/ui/ImagePicker.tsx` (upload/replace/remove + preview), `ProductThumbnail.tsx` (click-to-enlarge), `ImagePreviewModal.tsx` (zoom/rotate). Thumbnails appear in products & items tables and detail pages.
- Requires R2 env vars (see Environment Setup). Product images render via plain `<img>` (no CORS needed). (Location 360s do not use R2.)

### Responsive / Mobile
- Dashboard shell already mobile-ready: sidebar is a drawer (`components/layout/Sidebar.tsx`), `DashboardHeader` has the menu toggle; `app/(dashboard)/dashboard/layout.tsx` uses responsive padding.
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
```

## Dev Workflow Gotchas (Windows)
- **Do NOT run `npm run build` / `next build` while `npm run dev` is running** — it overwrites `.next` and corrupts the dev server (`Cannot find module './xxxx.js'`). To type-check during dev use `npx tsc --noEmit` (does not touch `.next`). If `.next` gets corrupted: stop dev, `rm -rf .next`, restart.
- `prisma generate` can fail with `EPERM` renaming the query engine DLL while the dev server holds it — stop the dev server first.
- 360 panoramas need same-origin images in `public/images/ubicaciones/` (no R2/CORS). New panorama images: drop equirectangular (2:1) files there; they appear automatically in the picker.
