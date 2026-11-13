import { createHash } from 'crypto'

/**
 * Consentimiento de tratamiento de datos de la app de asistencia.
 *
 * El texto vigente vive AQUÍ. Para publicar una versión nueva:
 *   1. Cambia el texto.
 *   2. Cambia `version` (por ejemplo "2027-01-v1").
 *   3. Despliega. Todos los empleados tendrán que aceptarlo de nuevo al abrir la app.
 *
 * Cada aceptación guarda la versión y la huella SHA-256 del texto exacto, de modo
 * que siempre se puede demostrar qué texto aceptó cada persona.
 *
 * ⚠️ TEXTO PROVISIONAL: pendiente de revisión legal (lo ajusta el dueño con un abogado).
 */

export type ConsentDocument = {
  version: string
  isDraft: boolean
  title: string
  paragraphs: string[]
  checkboxLabel: string
}

export const CURRENT_CONSENT: ConsentDocument = {
  version: 'borrador-1',
  isDraft: true,
  title: 'Autorización de tratamiento de datos personales',
  paragraphs: [
    'Para registrar tu asistencia, esta aplicación recoge y trata los siguientes datos personales: tu identificación (nombre, cédula, correo, teléfono y cargo), tu ubicación en el momento de cada marcación y fotografías de tu rostro.',
    'Las fotografías de tu rostro son datos biométricos y, por tanto, datos sensibles. Se usan únicamente para comprobar que quien marca la asistencia eres tú, comparando la foto de cada marcación con tu foto de referencia.',
    'Tu ubicación se consulta solo en el momento en que marcas entrada o salida, para verificar que estás dentro del área de trabajo asignada. La aplicación no rastrea tu ubicación en segundo plano.',
    'La comparación de rostros se realiza mediante un servicio en la nube ubicado fuera de Colombia. Las fotos de cada marcación se conservan 90 días, salvo que la marcación esté en revisión o en disputa. Los registros de asistencia se conservan 3 años. Tu foto de referencia se conserva mientras estés activo en la empresa.',
    'Por tratarse de datos sensibles, no estás obligado a autorizar su tratamiento. Puedes conocer, actualizar, rectificar y solicitar la supresión de tus datos, así como revocar esta autorización, comunicándote con la empresa.',
  ],
  checkboxLabel:
    'He leído y autorizo el tratamiento de mis datos personales y biométricos para el control de asistencia.',
}

/**
 * Huella del texto exacto. Cualquier cambio (una coma, el título, la casilla o la
 * versión) produce otra huella. El separador evita que dos textos distintos
 * concatenados den el mismo resultado.
 */
export function consentTextHash(doc: ConsentDocument): string {
  const canonical = JSON.stringify({
    version: doc.version,
    title: doc.title,
    paragraphs: doc.paragraphs,
    checkboxLabel: doc.checkboxLabel,
  })
  return createHash('sha256').update(canonical, 'utf8').digest('hex')
}

export const CURRENT_CONSENT_HASH = consentTextHash(CURRENT_CONSENT)
