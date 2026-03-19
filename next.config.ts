import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["playwright"],
  async rewrites() {
    return [
      {
        source: '/uploads/:path*',
        destination: '/api/uploads?path=:path*',
      },
    ];
  },
};

export default nextConfig;
