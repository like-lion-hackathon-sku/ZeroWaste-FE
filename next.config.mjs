/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    const be = (process.env.BE_ORIGIN || "").replace(/\/$/, "")
    return be
      ? [
          // /_be/*  ->  {BE_ORIGIN}/*  (여기서 /api를 절대 추가하지 않음!)
          { source: "/_be/:path*", destination: `${be}/api/:path*` },
        ]
      : []
  },
  images: { unoptimized: true },
  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
  reactStrictMode: true,
  poweredByHeader: false,
}
export default nextConfig