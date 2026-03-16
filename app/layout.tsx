import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'TEC Treasure Hunt',
  description: 'College Treasure Hunt Competition Platform',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-brand-bg text-white min-h-screen antialiased">
        {children}
      </body>
    </html>
  )
}
