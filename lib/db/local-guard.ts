/**
 * Protección de la base de producción.
 *
 * Los comandos destructivos o de datos de prueba (seed, migrate dev, reset) solo
 * pueden ejecutarse contra una base LOCAL. Cualquier otro host aborta.
 * Si DATABASE_URL falta o no se puede leer, también aborta (falla cerrado).
 */

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])

export function getDatabaseHost(url: string | undefined): string | null {
  if (!url) return null
  try {
    return new URL(url).hostname || null
  } catch {
    return null
  }
}

export function isLocalDatabaseUrl(url: string | undefined): boolean {
  const host = getDatabaseHost(url)
  return host !== null && LOCAL_HOSTS.has(host)
}

export function assertLocalDatabase(url: string | undefined = process.env.DATABASE_URL): void {
  if (isLocalDatabaseUrl(url)) return
  const host = getDatabaseHost(url)
  throw new Error(
    `[db-guard] BLOQUEADO: DATABASE_URL apunta a "${host ?? 'un valor ausente o ilegible'}", que no es una base local. ` +
      'Este comando solo puede correr contra localhost. Usa los scripts "db:local:*" de package.json.'
  )
}
