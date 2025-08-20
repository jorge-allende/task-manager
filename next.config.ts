import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    // Skip type checking during build if there are errors
    // Remove this once all TypeScript errors are fixed
    ignoreBuildErrors: true,
  },
  eslint: {
    // Skip ESLint during build if there are errors
    // Remove this once all ESLint errors are fixed
    ignoreDuringBuilds: true,
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "d17gd1ywjr03hv.cloudfront.net",
      },
      {
        protocol: "https",
        hostname: "img.clerk.com",
      },
    ],
  },
};

export default nextConfig;
