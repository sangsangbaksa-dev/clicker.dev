import type { NextConfig } from "next"
import { authSecretDeployProblem } from "./src/infrastructure/auth/auth-secret"

// 운영 배포에서 세션 키가 없으면 빌드를 멈춰, 이전 배포가 그대로 서비스되게 한다.
const authSecretProblem = authSecretDeployProblem(process.env)
if (authSecretProblem) {
  throw new Error(`${authSecretProblem} Vercel/Netlify 환경 변수에 AUTH_SECRET을 설정하세요 (openssl rand -base64 32).`)
}

const staticCache = [
  { key: "CDN-Cache-Control", value: "public, max-age=31536000, immutable" },
]

// Clickjacking, MIME sniffing, and referrer leaks. No full CSP yet: Next inline scripts need nonces.
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'self'" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
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
        source: "/:path*",
        headers: securityHeaders,
      },
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
