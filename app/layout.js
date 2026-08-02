import './styles.css';

export const metadata = {
  title: 'Mirror José',
  description: 'Panel patrimonial personal',
  manifest: '/manifest.json',
  appleWebApp: { capable: true, statusBarStyle: 'black-translucent', title: 'Mirror José' }
};

export default function RootLayout({ children }) {
  return <html lang="es"><body>{children}</body></html>;
}
