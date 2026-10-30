// Contenido editable del sitio público.
// Para poner una foto: copia el archivo en public/images/sitio/ y reemplaza
// `src: null` por la ruta, por ejemplo `src: '/images/sitio/concierto.jpg'`.

export interface SiteImage {
  src: string | null
  alt: string
}

export const heroImage: SiteImage = {
  src: null,
  alt: 'Escenario de SHOCK Producciones durante un concierto',
}

export const contact = {
  email: 'contacto@xenith.com',
  phone: '+52 (123) 456-7890',
  phoneHref: 'tel:+521234567890',
  city: 'Bogotá, Colombia',
  hours: 'Lun - Vie: 9:00 - 18:00',
}

export const navLinks = [
  { href: '/inicio', label: 'Inicio' },
  { href: '/soluciones', label: 'Soluciones' },
  { href: '/contacto', label: 'Contacto' },
]

export const eventTypes = [
  'Conciertos',
  'Festivales',
  'Eventos masivos',
  'Eventos corporativos',
  'Lanzamientos de marca',
  'Ferias',
  'Congresos',
  'Activaciones',
]

export const services = [
  {
    id: 'renta',
    title: 'Renta de equipos',
    summary: 'Audio, video e iluminación para una fecha o una gira.',
    description:
      'Equipos revisados y listos para salir. Eliges solo el alquiler o lo sumas con técnicos y montaje.',
    items: ['Sonido', 'Video y pantallas', 'Iluminación', 'Acompañamiento técnico opcional'],
    level: '38',
    image: { src: null, alt: 'Equipos audiovisuales en bodega' } as SiteImage,
  },
  {
    id: 'venta',
    title: 'Venta de equipos',
    summary: 'Equipo profesional para quienes producen todo el año.',
    description:
      'Te ayudamos a escoger lo que tu espacio o tu operación necesita, sin comprar de más.',
    items: ['Asesoría antes de comprar', 'Equipos para venues y empresas', 'Soluciones a la medida del espacio'],
    level: '56',
    image: { src: null, alt: 'Equipo audiovisual profesional' } as SiteImage,
  },
  {
    id: 'produccion',
    title: 'Producción audiovisual',
    summary: 'Montaje, operación y dirección técnica del show.',
    description:
      'Diseñamos el montaje, llevamos el equipo y operamos en vivo para que todo salga a tiempo.',
    items: ['Diseño técnico', 'Montaje y desmontaje', 'Operación en vivo', 'Dirección técnica'],
    level: '72',
    image: { src: null, alt: 'Consola de producción durante un evento' } as SiteImage,
  },
  {
    id: 'agencia',
    title: 'Agencia creativa',
    summary: 'Del concepto al evento, organizado de punta a punta.',
    description:
      'Creamos la idea y organizamos el evento completo: concepto, experiencia, logística y ejecución.',
    items: ['Concepto y experiencia', 'Organización de eventos', 'Contenido para pantallas', 'Logística'],
    level: '48',
    image: { src: null, alt: 'Equipo creativo planeando un evento' } as SiteImage,
  },
]

export const eventShowcase = [
  {
    title: 'Conciertos',
    text: 'Sonido, luces y pantallas para que el show llegue hasta la última fila.',
    layout: 'bento-large',
    image: { src: null, alt: 'Concierto en vivo' } as SiteImage,
    sizes: '(min-width: 760px) 50vw, 100vw',
  },
  {
    title: 'Eventos masivos',
    text: 'Producción completa para públicos grandes.',
    layout: 'bento-wide',
    image: { src: null, alt: 'Evento masivo al aire libre' } as SiteImage,
    sizes: '(min-width: 760px) 50vw, 100vw',
  },
  {
    title: 'Corporativos',
    text: 'Congresos y encuentros de empresa.',
    layout: '',
    image: { src: null, alt: 'Evento corporativo' } as SiteImage,
    sizes: '(min-width: 760px) 25vw, 100vw',
  },
  {
    title: 'Marcas',
    text: 'Lanzamientos y activaciones.',
    layout: '',
    image: { src: null, alt: 'Lanzamiento de marca' } as SiteImage,
    sizes: '(min-width: 760px) 25vw, 100vw',
  },
]

export const projectGallery = [
  { layout: 'gallery-wide gallery-tall', image: { src: null, alt: 'Proyecto 1' } as SiteImage },
  { layout: '', image: { src: null, alt: 'Proyecto 2' } as SiteImage },
  { layout: 'gallery-tall', image: { src: null, alt: 'Proyecto 3' } as SiteImage },
  { layout: '', image: { src: null, alt: 'Proyecto 4' } as SiteImage },
  { layout: 'gallery-wide', image: { src: null, alt: 'Proyecto 5' } as SiteImage },
  { layout: '', image: { src: null, alt: 'Proyecto 6' } as SiteImage },
  { layout: '', image: { src: null, alt: 'Proyecto 7' } as SiteImage },
]

export const processSteps = [
  { title: 'Brief', text: 'Nos cuentas la fecha, el lugar, el público y lo que quieres lograr.' },
  { title: 'Diseño', text: 'Armamos la propuesta creativa y técnica, con su cotización.' },
  { title: 'Montaje', text: 'Llevamos el equipo, lo instalamos y probamos todo antes de abrir puertas.' },
  { title: 'Show', text: 'Operamos en vivo y desmontamos al terminar.' },
]

export const faqs = [
  {
    q: '¿Puedo rentar equipos sin contratar la producción?',
    a: 'Sí. Puedes rentar solo los equipos o sumar técnicos, montaje y operación según lo que necesites.',
  },
  {
    q: '¿Qué información necesitan para cotizar?',
    a: 'Con la fecha, el lugar, el número de asistentes y el tipo de evento podemos empezar. Si tienes un rider o un plano, envíalo también.',
  },
  {
    q: '¿Con cuánta anticipación debo escribirles?',
    a: 'Entre más pronto, mejor, porque así aseguramos la disponibilidad de equipos y personal. Si tu fecha está cerca, escríbenos igual y revisamos qué se puede hacer.',
  },
  {
    q: '¿También organizan el evento completo?',
    a: 'Sí. Como agencia creativa podemos encargarnos desde el concepto hasta la ejecución.',
  },
]
