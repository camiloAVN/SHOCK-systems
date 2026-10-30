import { Chakra_Petch } from 'next/font/google'
import { Navbar } from '@/components/layout/Navbar'
import { Footer } from '@/components/layout/Footer'
import './public.css'

const displayFont = Chakra_Petch({
  variable: '--font-display',
  subsets: ['latin'],
  weight: ['600', '700'],
})

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className={`shock-site ${displayFont.variable}`}>
      <Navbar />
      <main>{children}</main>
      <Footer />
    </div>
  )
}
