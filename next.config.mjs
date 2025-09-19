/** @type {import('next').NextConfig} */
const PROXY_PREFIX = process.env.PROXY_PREFIX || "/_be";

const nextConfig = {
  async rewrites() {
    // 프록시 on/off 스위치
    if (process.env.PROXY_MODE !== "true") return [];

    // 끝 슬래시 제거
    const be = (process.env.BE_ORIGIN || "https://zerowaste-be-9c49.onrender.com").replace(/\/$/, "");

    // FE: /_be/:path*  ->  BE: /api/:path*
    return [{ source: `${PROXY_PREFIX}/:path*`, destination: `${be}/api/:path*` }];
  },

  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  images: { unoptimized: true },
};

export default nextConfig;