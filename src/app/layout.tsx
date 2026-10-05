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
        {/* Cold-start LCP: boot screen bg before client hydration. */}
        <link
          rel="preload"
          as="image"
          href="/clicker/bg/loading_core_awakening.webp"
          type="image/webp"
          fetchPriority="high"
        />
        {/* Next paint after boot: title / hub entrance still. */}
        <link
          rel="preload"
          as="image"
          href="/clicker/mine/mine_entrance_hub_closed_door_v2.webp"
          type="image/webp"
        />
        <link
          rel="preload"
          as="image"
          href="/clicker/mine/title_door_centered.webp"
          type="image/webp"
        />
        {/* CDN fallback: next/font/google is currently broken under this Turbopack build. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body
        className="h-full min-h-full bg-[#070B12] font-sans text-[#EAF4FF]"
        style={{ fontFamily: '"Pretendard Variable", Pretendard, "IBM Plex Sans KR", "Apple SD Gothic Neo", sans-serif' }}
      >
        {children}
      </body>
    </html>
  )
}
