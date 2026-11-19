import { describe, expect, it } from 'vitest'
import { ageOn, isProfileComplete, profileUpdateSchema, todayInBogota } from '@/lib/mobile/profile-rules'

const NOW = new Date('2026-11-19T15:00:00Z')

describe('profileUpdateSchema', () => {
  const schema = profileUpdateSchema(NOW)

  it('acepta los datos que pide la app y limpia el celular', () => {
    expect(schema.parse({ cedula: ' 1032456789 ', phone: '300 123-4567', birthDate: '1995-04-30' })).toEqual({
      cedula: '1032456789',
      phone: '3001234567',
      birthDate: '1995-04-30',
    })
    expect(schema.parse({ phone: '+57 300 123 4567' }).phone).toBe('+573001234567')
  })

  it('rechaza cédula con puntos, celular corto y fechas imposibles', () => {
    expect(schema.safeParse({ cedula: '1.032.456' }).success).toBe(false)
    expect(schema.safeParse({ phone: '12345' }).success).toBe(false)
    expect(schema.safeParse({ birthDate: '1995-02-30' }).success).toBe(false)
    expect(schema.safeParse({ birthDate: '30/04/1995' }).success).toBe(false)
  })

  it('exige una edad entre 14 y 100 años', () => {
    expect(schema.safeParse({ birthDate: '2012-11-19' }).success).toBe(true) // cumple 14 hoy
    expect(schema.safeParse({ birthDate: '2012-11-20' }).success).toBe(false) // le falta un día
    expect(schema.safeParse({ birthDate: '1920-01-01' }).success).toBe(false)
    expect(schema.safeParse({ birthDate: '2030-01-01' }).success).toBe(false)
  })
})

describe('ageOn y todayInBogota', () => {
  it('cuenta la edad cumplida', () => {
    expect(ageOn('1995-04-30', '2026-04-29')).toBe(30)
    expect(ageOn('1995-04-30', '2026-04-30')).toBe(31)
  })
  it('usa la fecha de Bogotá, no la UTC', () => {
    expect(todayInBogota(new Date('2026-11-20T03:00:00Z'))).toBe('2026-11-19')
  })
})

describe('isProfileComplete', () => {
  it('pide cédula, celular y fecha de nacimiento', () => {
    expect(isProfileComplete({ cedula: '123456', phone: '3001234567', birthDate: new Date() })).toBe(true)
    expect(isProfileComplete({ cedula: '123456', phone: null, birthDate: new Date() })).toBe(false)
  })
})
