import type { NextConfig } from "next"

const staticCache = [
  { key: "CDN-Cache-Control", value: "public, max-age=31536000, immutable" },
]

const nextConfig: NextConfig = {
  devIndicators: false,
  // HMR WebSocket failures in proxied/cloud dev must not block React hydration.
  experimental: {
    reactDebugChannel: false,
    optimizePackageImports: ["lucide-react"],
  },
  allowedDevOrigins: ["127.0.0.1", "localhost", "0.0.0.0"],
  async headers() {
    return [
      {
        source: "/_next/static/:path*",
        headers: staticCache,
      },
      {
        source: "/:path*.woff2",
        headers: staticCache,
      },
    ]
  },
}

export default nextConfig
