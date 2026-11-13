import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db/prisma', () => ({ prisma: {} }))

import { CURRENT_CONSENT, CURRENT_CONSENT_HASH, consentTextHash } from '@/lib/attendance/consent'
import { decideBind, deviceStatusFor } from '@/lib/mobile/activation'
import { createUserSchema, updateUserSchema } from '@/lib/validations/user'

describe('huella del consentimiento', () => {
  it('es estable y tiene formato SHA-256', () => {
    expect(consentTextHash(CURRENT_CONSENT)).toBe(CURRENT_CONSENT_HASH)
    expect(CURRENT_CONSENT_HASH).toMatch(/^[0-9a-f]{64}$/)
  })

  it('cambia con cualquier cambio del texto, la versión o la casilla', () => {
    const variants = [
      { ...CURRENT_CONSENT, version: 'otra' },
      { ...CURRENT_CONSENT, title: CURRENT_CONSENT.title + '.' },
      { ...CURRENT_CONSENT, checkboxLabel: CURRENT_CONSENT.checkboxLabel.replace('autorizo', 'acepto') },
      { ...CURRENT_CONSENT, paragraphs: [...CURRENT_CONSENT.paragraphs.slice(0, -1), CURRENT_CONSENT.paragraphs.at(-1) + ' '] },
      { ...CURRENT_CONSENT, paragraphs: [...CURRENT_CONSENT.paragraphs].reverse() },
    ]
    for (const v of variants) expect(consentTextHash(v)).not.toBe(CURRENT_CONSENT_HASH)
  })

  it('juntar dos párrafos en uno da otra huella', () => {
    const [a, b, ...rest] = CURRENT_CONSENT.paragraphs
    expect(consentTextHash({ ...CURRENT_CONSENT, paragraphs: [a + b, ...rest] })).not.toBe(CURRENT_CONSENT_HASH)
  })

  it('el borrador está marcado como tal', () => {
    expect(CURRENT_CONSENT.isDraft).toBe(true)
  })
})

describe('estado del teléfono', () => {
  it('ninguno, este u otro', () => {
    expect(deviceStatusFor(null, 'inst-A')).toBe('none')
    expect(deviceStatusFor('inst-A', 'inst-A')).toBe('this_device')
    expect(deviceStatusFor('inst-A', 'inst-B')).toBe('other_device')
    expect(deviceStatusFor('inst-A', null)).toBe('other_device')
  })
})

describe('decisión de vinculación', () => {
  const base = { consentAccepted: true, activeInstallationId: null as string | null, requestInstallationId: 'inst-A' as string | null }
  it('libre -> vincula', () => expect(decideBind(base)).toBe('bind'))
  it('mismo teléfono -> ya vinculado (repetir no hace daño)', () =>
    expect(decideBind({ ...base, activeInstallationId: 'inst-A' })).toBe('already_bound'))
  it('otro teléfono activo -> rechazado', () =>
    expect(decideBind({ ...base, activeInstallationId: 'inst-B' })).toBe('bound_elsewhere'))
  it('sin consentimiento -> lo exige primero', () =>
    expect(decideBind({ ...base, consentAccepted: false })).toBe('consent_required'))
  it('sin consentimiento tiene prioridad sobre otro teléfono', () =>
    expect(decideBind({ ...base, consentAccepted: false, activeInstallationId: 'inst-B' })).toBe('consent_required'))
  it('sesión sin id de instalación -> no se puede vincular', () =>
    expect(decideBind({ ...base, requestInstallationId: null })).toBe('missing_installation'))
})

describe('cédula y teléfono en el formulario de usuarios', () => {
  const valid = { name: 'Ana Pérez', email: 'ana@empresa.co', password: 'Clave1234' }

  it('son opcionales: el formulario actual sigue siendo válido sin ellos', () => {
    expect(createUserSchema.safeParse(valid).success).toBe(true)
    expect(updateUserSchema.safeParse({ name: 'Ana' }).success).toBe(true)
  })

  it('vacío se guarda como null', () => {
    const r = createUserSchema.parse({ ...valid, cedula: '', phone: '  ' })
    expect(r.cedula).toBeNull()
    expect(r.phone).toBeNull()
  })

  it('acepta cédulas de 5 a 15 dígitos y teléfonos con formato habitual', () => {
    const r = createUserSchema.parse({ ...valid, cedula: '1020304050', phone: '+57 (300) 123-4567' })
    expect(r.cedula).toBe('1020304050')
    expect(r.phone).toBe('+57 (300) 123-4567')
  })

  it('rechaza cédulas con puntos, letras o longitud fuera de rango', () => {
    for (const cedula of ['1.020.304', '12A45', '1234', '1234567890123456']) {
      expect(createUserSchema.safeParse({ ...valid, cedula }).success).toBe(false)
    }
  })

  it('rechaza teléfonos con letras o demasiado cortos', () => {
    for (const phone of ['300-ABC-1234', '12345']) {
      expect(updateUserSchema.safeParse({ phone }).success).toBe(false)
    }
  })
})
