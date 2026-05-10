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

Route protection is handled entirely through NextAuth.js in `auth.ts` — there is no `middleware.ts`.

### API Pattern
All API routes follow this pattern:
1. Check session with `auth()` from `@/auth`
2. Validate input with Zod schemas from `lib/validations/`
3. Use Prisma client from `lib/db/prisma.ts`
4. Return `NextResponse.json()`

### State Management
- **Zustand stores** (`store/`): One store per entity (auth, clients, projects, quotations, categories, products, suppliers, inventory, itemGroups, concepts, rfid, tasks, ui)
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
- **InventoryItem**: Physical items with RFID, serial number, asset tag, status (IN, OUT, MAINTENANCE, LOST)
- **ItemGroup**: Named equipment packages used in quotations
- **BulkInventory**: Quantity-based inventory without RFID
- **BulkMovement**: Bulk inventory movement history
- **RfidTag**: RFID tags with EPC, status (ENROLLED, UNASSIGNED, UNKNOWN)
- **RfidDetection**: RFID read log from readers (RSSI, direction, reader ID)
- **InventoryMovement**: Item movement audit trail

#### Admin Models
- **AuditLog**: Action history (module, action, entityType, entityId, metadata, IP, userAgent)
- **UserPermission**: Per-module access control (canView, canEdit) per user

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
```
