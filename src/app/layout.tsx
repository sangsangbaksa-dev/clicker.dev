import type { Metadata, Viewport } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "PROJECT CLICKER",
  description: "AURELIA CORE 광산에서 코어를 채굴하는 프로토콜",
  icons: { icon: "/clicker/icon/icon_core.png", apple: "/clicker/icon/icon_core.png" },
  appleWebApp: { capable: true, title: "Aurelia Core", statusBarStyle: "black-translucent" },
}

/** Phone play: edge-to-edge under the notch, no pinch-zoom fighting rapid taps. */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#070B12",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="ko" className="h-full antialiased">
      <head>
        {/* CDN fallback: next/font/google is currently broken under this Turbopack build. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* This is the root layout, so the font reaches every page (the rule targets pages/). */}
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className="h-full min-h-full bg-[#070B12] font-sans text-[#EAF4FF]"
        style={{ fontFamily: '"Noto Sans KR", "Apple SD Gothic Neo", sans-serif' }}
      >
        {children}
      </body>
    </html>
  )
}
