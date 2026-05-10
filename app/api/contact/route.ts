import { NextRequest, NextResponse } from 'next/server'
import { contactSchema } from '@/lib/validations/contact'
import { ZodError } from 'zod'
import { Resend } from 'resend'
import { render } from '@react-email/components'
import { ContactNotificationTemplate } from '@/components/email/contact-notification-template'

const resend = new Resend(process.env.RESEND_API_KEY)

const CONTACT_DESTINATION = 'camilo.vargas@xenith.com.co'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const validatedData = contactSchema.parse(body)

    const html = await render(
      ContactNotificationTemplate({
        name: validatedData.name,
        email: validatedData.email,
        phone: validatedData.phone,
        company: validatedData.company,
        subject: validatedData.subject,
        message: validatedData.message,
      })
    )

    const { error } = await resend.emails.send({
      from: 'XENITH Contacto <onboarding@resend.dev>',
      to: [CONTACT_DESTINATION],
      replyTo: validatedData.email,
      subject: `Nuevo contacto: ${validatedData.subject}`,
      html,
    })

    if (error) {
      console.error('Error sending contact email:', error)
      return NextResponse.json(
        { success: false, message: 'Error al enviar el mensaje' },
        { status: 500 }
      )
    }

    console.info(
      `[CONTACT] New message from ${validatedData.email} (${validatedData.name})`
    )

    return NextResponse.json(
      { success: true, message: 'Mensaje enviado correctamente' },
      { status: 200 }
    )
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        {
          success: false,
          message: 'Datos de formulario inválidos',
          errors: error.issues,
        },
        { status: 400 }
      )
    }

    console.error('Contact form error:', error)

    return NextResponse.json(
      { success: false, message: 'Error al procesar el mensaje' },
      { status: 500 }
    )
  }
}
