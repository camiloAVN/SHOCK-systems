# SHOCK Systems

Sistema de control de inventario, CRM y alquiler de equipos audiovisuales con integración RFID.

## Requisitos previos

- [Node.js](https://nodejs.org/) v18 o superior
- [Docker](https://www.docker.com/products/docker-desktop/) y Docker Compose
- [npm](https://www.npmjs.com/) (incluido con Node.js)

## Inicio rápido

### 1. Clonar e instalar dependencias

```bash
git clone <repo-url>
cd shock_systems
npm install
```

### 2. Configurar variables de entorno

```bash
cp .env.example .env
```

Edita `.env` con tus valores. Para desarrollo local con Docker:

```env
DATABASE_URL="postgresql://shock:shock123@localhost:5433/shock_db"
AUTH_SECRET="<genera con: openssl rand -base64 32>"
NEXTAUTH_URL="http://localhost:3000"
NEXT_PUBLIC_APP_URL="http://localhost:3000"
RESEND_API_KEY="re_..."
RFID_API_KEY="tu-clave-rfid"
```

### 3. Iniciar la base de datos

```bash
docker compose up -d
```

### 4. Ejecutar migraciones

```bash
npx prisma migrate dev
```

### 5. Poblar la base de datos con datos iniciales

```bash
npm run db:seed
```

Crea los superadmins iniciales:
- `camilo.vargas@xenith.com.co` / `admin123`
- `nelsonshock@gmail.com` / `admin123`

### 6. Iniciar el servidor de desarrollo

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000) en tu navegador.

## Comandos útiles

| Comando | Descripción |
|---------|-------------|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm run start` | Servidor de producción |
| `npm run lint` | ESLint |
| `npm run db:seed` | Poblar BD con datos iniciales |
| `docker compose up -d` | Iniciar PostgreSQL |
| `docker compose down` | Detener PostgreSQL |
| `npx prisma migrate dev` | Ejecutar migraciones pendientes |
| `npx prisma studio` | GUI para la base de datos |

## Despliegue en Railway

1. Crear proyecto en [Railway](https://railway.app) → Deploy from GitHub
2. Agregar servicios: **PostgreSQL** y **Redis**
3. Configurar variables de entorno en el servicio Next.js (Railway inyecta `DATABASE_URL` y `REDIS_URL` automáticamente)
4. Railway detecta `railway.toml` y ejecuta `prisma migrate deploy` antes de iniciar

Variables requeridas en Railway:
```
AUTH_SECRET
NEXTAUTH_URL
NEXT_PUBLIC_APP_URL
RESEND_API_KEY
RFID_API_KEY
ADMIN_EMAIL
ADMIN_PASSWORD
ADMIN_SETUP_KEY
```

## Tecnologías

- [Next.js 15](https://nextjs.org/) — Framework React con App Router
- [Prisma](https://www.prisma.io/) — ORM
- [PostgreSQL](https://www.postgresql.org/) — Base de datos
- [Redis](https://redis.io/) — Rate limiting distribuido
- [NextAuth.js v5](https://authjs.dev/) — Autenticación
- [Tailwind CSS](https://tailwindcss.com/) — Estilos
- [Zustand](https://zustand-demo.pmnd.rs/) — Estado global
- [React Hook Form](https://react-hook-form.com/) + [Zod](https://zod.dev/) — Formularios y validación
- [Resend](https://resend.com/) — Envío de emails
- [React PDF](https://react-pdf.org/) — Generación de cotizaciones en PDF
