import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'WhatChanged - SEC Filing Monitor',
  description: 'Monitor SEC filings and get instant insights on material changes',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}