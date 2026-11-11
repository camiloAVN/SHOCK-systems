// Uso: npm run db:guard
// Sale con código 1 si DATABASE_URL no apunta a una base local.
import { assertLocalDatabase, getDatabaseHost } from '../lib/db/local-guard'

try {
  assertLocalDatabase()
  console.log(`[db-guard] OK: base local (${getDatabaseHost(process.env.DATABASE_URL)})`)
} catch (error) {
  console.error((error as Error).message)
  process.exit(1)
}
