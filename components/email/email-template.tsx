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

interface EmailTemplateProps {
  subject: string
  body: string
}

const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

export function EmailTemplate({ subject, body }: EmailTemplateProps) {
  return (
    <Html>
      <Head />
      <Preview>{subject}</Preview>
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
            <Heading as="h2" style={subjectStyle}>
              {subject}
            </Heading>
            <Hr style={divider} />
            <Text style={bodyText}>{body}</Text>
          </Section>

          {/* Footer */}
          <Section style={footer}>
            <Hr style={footerDivider} />
            <Text style={footerText}>
              Sistema de Gestion Integral
            </Text>
            <Text style={footerSubtext}>
              Este es un comunicado interno. No responda a este correo.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

// ---------- Styles ----------

export const main: React.CSSProperties = {
  backgroundColor: '#09090B',
  fontFamily:
    "'Segoe UI', -apple-system, BlinkMacSystemFont, 'Roboto', 'Helvetica Neue', sans-serif",
  padding: '40px 0',
}

export const container: React.CSSProperties = {
  maxWidth: '580px',
  margin: '0 auto',
  backgroundColor: '#111113',
  borderRadius: '16px',
  border: '1px solid #27272A',
  overflow: 'hidden',
}

export const header: React.CSSProperties = {
  backgroundColor: '#18181B',
  padding: '36px 40px 28px',
  borderBottom: '2px solid #F5920A',
  textAlign: 'center',
}

export const logoImg: React.CSSProperties = {
  display: 'block',
  margin: '0 auto',
  maxWidth: '220px',
  height: 'auto',
  objectFit: 'contain',
}

export const content: React.CSSProperties = {
  padding: '36px 40px 32px',
}

export const subjectStyle: React.CSSProperties = {
  color: '#F5920A',
  fontSize: '20px',
  fontWeight: 600,
  margin: '0 0 4px 0',
  lineHeight: '1.4',
}

export const divider: React.CSSProperties = {
  borderColor: '#27272A',
  margin: '20px 0',
}

export const bodyText: React.CSSProperties = {
  color: '#D4D4D8',
  fontSize: '15px',
  lineHeight: '1.75',
  margin: '0',
  whiteSpace: 'pre-wrap',
}

export const footer: React.CSSProperties = {
  padding: '0 40px 28px',
  textAlign: 'center',
}

export const footerDivider: React.CSSProperties = {
  borderColor: '#27272A',
  margin: '0 0 24px 0',
}

export const footerText: React.CSSProperties = {
  color: '#71717A',
  fontSize: '12px',
  margin: '0 0 4px 0',
  fontWeight: 500,
}

export const footerSubtext: React.CSSProperties = {
  color: '#52525B',
  fontSize: '11px',
  margin: '0',
}
