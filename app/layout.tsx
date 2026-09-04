import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'Inklume',
  description: 'A quiet desk for thinking out loud. Reflective journaling and dialogue with Gemini, featuring owner-scoped Firestore persistence and notebook craftsmanship.',
  icons: {
    icon: '/icon.svg',
  },
  openGraph: {
    title: 'Inklume',
    description: 'A quiet desk for thinking out loud. Reflective journaling and dialogue with Gemini, featuring owner-scoped Firestore persistence and notebook craftsmanship.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Inklume',
    description: 'A quiet desk for thinking out loud. Reflective journaling and dialogue with Gemini, featuring owner-scoped Firestore persistence and notebook craftsmanship.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
