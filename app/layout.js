import { Cormorant_Garamond, Nunito } from 'next/font/google';
import './globals.css';

const cormorant = Cormorant_Garamond({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  style: ['normal', 'italic'],
  variable: '--font-cormorant',
});

const nunito = Nunito({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-nunito',
});

export const metadata = {
  title: 'Reservar Cita — Clínica Estética UNIR',
  description: 'Sistema de reservas online para clínica estética — TFM UNIR',
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body className={`${cormorant.variable} ${nunito.variable} antialiased`}>
        {children}
      </body>
    </html>
  );
}
