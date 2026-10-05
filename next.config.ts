import type { NextConfig } from "next"
import { authSecretDeployProblem } from "./src/infrastructure/auth/auth-secret"

// GitHub Pages: 클리커만 정적 export한다 (scripts/prepare-pages.sh가 서버 라우트를 걷어낸 뒤 빌드).
const githubPages = process.env.GITHUB_PAGES === "1"
const pagesBasePath = process.env.PAGES_BASE_PATH ?? ""

// 운영 배포에서 세션 키가 없으면 빌드를 멈춰, 이전 배포가 그대로 서비스되게 한다.
const authSecretProblem = githubPages ? null : authSecretDeployProblem(process.env)
if (authSecretProblem) {
  throw new Error(`${authSecretProblem} Vercel/Netlify 환경 변수에 AUTH_SECRET을 설정하세요 (openssl rand -base64 32).`)
}

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

// 정적 export는 headers를 적용하지 않으므로 Pages 빌드에서는 빼서 경고를 없앤다.
const pagesConfig: NextConfig = {
  ...nextConfig,
  headers: undefined,
  output: "export",
  basePath: pagesBasePath,
  trailingSlash: true,
  images: { unoptimized: true },
  // Browser bundle: skip /api/clicker/* (no server on GitHub Pages).
  env: {
    NEXT_PUBLIC_CLICKER_STATIC_HOST: "1",
  },
}

export default githubPages ? pagesConfig : nextConfig
