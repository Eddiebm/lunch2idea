import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'idea2Lunch — Your Idea, Fully Cooked.',
  description: 'Paste your idea. Get a complete product brief in 60 seconds.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
