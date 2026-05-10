import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Preview,
  Section,
  Text,
} from '@react-email/components'
import * as React from 'react'
import {
  main,
  container,
  header,
  logoImg,
  content,
  divider,
  footer,
  footerDivider,
  footerText,
  footerSubtext,
} from './email-template'

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

interface ContactNotificationTemplateProps {
  name: string
  email: string
  phone?: string
  company?: string
  subject: string
  message: string
}

export function ContactNotificationTemplate({
  name,
  email,
  phone,
  company,
  subject,
  message,
}: ContactNotificationTemplateProps) {
  return (
    <Html>
      <Head />
      <Preview>Nuevo contacto de {name}: {subject}</Preview>
      <Body style={main}>
        <Container style={container}>
          {/* Header */}
          <Section style={header}>
            <table
              role="presentation"
              width="100%"
              cellPadding={0}
              cellSpacing={0}
            >
              <tbody>
                <tr>
                  <td align="center">
                    <Img
                      src={`${appUrl}/images/logo_shock.png`}
                      alt="Logo"
                      width={220}
                      height={80}
                      style={logoImg}
                    />
                  </td>
                </tr>
              </tbody>
            </table>
          </Section>

          {/* Content */}
          <Section style={content}>
            <Heading as="h2" style={titleStyle}>
              Nuevo mensaje de contacto
            </Heading>
            <Hr style={divider} />

            <Text style={subtitleStyle}>
              Has recibido un nuevo mensaje desde el formulario de contacto del sitio web.
            </Text>

            {/* Data table */}
            <Section style={dataCard}>
              <table role="presentation" width="100%" cellPadding={0} cellSpacing={0}>
                <tbody>
                  <tr>
                    <td style={labelCell}>Nombre</td>
                    <td style={valueCell}>{name}</td>
                  </tr>
                  <tr>
                    <td style={labelCell}>Email</td>
                    <td style={{ ...valueCell, color: '#F5920A' }}>
                      <a href={`mailto:${email}`} style={{ color: '#F5920A', textDecoration: 'none' }}>
                        {email}
                      </a>
                    </td>
                  </tr>
                  {phone && (
                    <tr>
                      <td style={labelCell}>Teléfono</td>
                      <td style={valueCell}>{phone}</td>
                    </tr>
                  )}
                  {company && (
                    <tr>
                      <td style={labelCell}>Empresa</td>
                      <td style={valueCell}>{company}</td>
                    </tr>
                  )}
                  <tr>
                    <td style={labelCell}>Asunto</td>
                    <td style={valueCell}>{subject}</td>
                  </tr>
                </tbody>
              </table>
            </Section>

            {/* Message */}
            <Text style={messageLabelStyle}>Mensaje:</Text>
            <Section style={messageCard}>
              <Text style={messageTextStyle}>{message}</Text>
            </Section>

            <Text style={hintStyle}>
              Responde directamente a <a href={`mailto:${email}`} style={{ color: '#F5920A' }}>{email}</a> para contactar a este cliente.
            </Text>
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Hr style={footerDivider} />
            <Text style={footerText}>Sistema de Gestion Integral</Text>
            <Text style={footerSubtext}>
              Este correo fue generado automáticamente desde el formulario de contacto público.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

// ---------- Additional Styles ----------

const titleStyle: React.CSSProperties = {
  color: '#F5920A',
  fontSize: '20px',
  fontWeight: 600,
  margin: '0 0 4px 0',
  lineHeight: '1.4',
}

const subtitleStyle: React.CSSProperties = {
  color: '#A1A1AA',
  fontSize: '14px',
  margin: '0 0 20px 0',
  lineHeight: '1.6',
}

const dataCard: React.CSSProperties = {
  backgroundColor: '#18181B',
  border: '1px solid #27272A',
  borderRadius: '10px',
  padding: '20px 24px',
  marginBottom: '20px',
}

const labelCell: React.CSSProperties = {
  color: '#71717A',
  fontSize: '13px',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  paddingBottom: '12px',
  paddingRight: '20px',
  width: '100px',
  verticalAlign: 'top',
}

const valueCell: React.CSSProperties = {
  color: '#E4E4E7',
  fontSize: '14px',
  paddingBottom: '12px',
  verticalAlign: 'top',
}

const messageLabelStyle: React.CSSProperties = {
  color: '#71717A',
  fontSize: '13px',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  margin: '0 0 8px 0',
}

const messageCard: React.CSSProperties = {
  backgroundColor: '#18181B',
  border: '1px solid #27272A',
  borderLeft: '3px solid #F5920A',
  borderRadius: '10px',
  padding: '20px 24px',
  marginBottom: '20px',
}

const messageTextStyle: React.CSSProperties = {
  color: '#D4D4D8',
  fontSize: '15px',
  lineHeight: '1.75',
  margin: '0',
  whiteSpace: 'pre-wrap',
}

const hintStyle: React.CSSProperties = {
  color: '#71717A',
  fontSize: '13px',
  margin: '0',
}
