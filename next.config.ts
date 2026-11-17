import type { NextConfig } from "next";

/**
 * Static export: the same `out/` folder is deployed to the web and bundled
 * into the Android/iOS Capacitor shells. No API routes, server actions or SSR
 * are used, so the app runs fully offline from the device.
 *
 * NEXT_PUBLIC_BASE_PATH is set only for sub-path hosting such as GitHub Pages
 * ("/birthdaybook"). Native builds must leave it empty.
 */
const basePath = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/$/, "");

const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  reactStrictMode: true,
  ...(basePath ? { basePath, assetPrefix: basePath } : {}),
};

export default nextConfig;
