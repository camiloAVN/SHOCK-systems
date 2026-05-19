import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "react-hot-toast";
import { SessionProvider } from "@/components/providers/SessionProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "SHOCK Systems - Control de Inventario y Alquiler de Equipos",
    template: "%s | SHOCK",
  },
  description: "Sistema de control de inventario, CRM y alquiler de equipos audiovisuales con integración RFID.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <SessionProvider>
          {children}
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: 'rgb(26, 26, 26)',
                color: 'rgb(237, 237, 237)',
                border: '1px solid rgb(38, 38, 38)',
              },
              success: {
                iconTheme: {
                  primary: 'rgb(245, 146, 10)',
                  secondary: 'white',
                },
              },
              error: {
                iconTheme: {
                  primary: 'rgb(239, 68, 68)',
                  secondary: 'white',
                },
              },
            }}
          />
        </SessionProvider>
      </body>
    </html>
  );
}
