import type { NextConfig } from "next";

// Adresse du backend Django, utilisée côté serveur par le proxy /api.
const BACKEND_URL = process.env.BACKEND_URL ?? "http://127.0.0.1:8000";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Image Docker légère : `NEXT_OUTPUT=standalone npm run build` (voir frontend/Dockerfile).
  output: process.env.NEXT_OUTPUT === "standalone" ? "standalone" : undefined,
  poweredByHeader: false,
  // Django attend des URL qui finissent par « / » : on ne laisse pas Next.js les retirer.
  skipTrailingSlashRedirect: true,
  async rewrites() {
    return [
      // Toutes les requêtes /api/... sont transmises à Django : le navigateur ne parle
      // qu'à une seule origine, ce qui permet des cookies httpOnly sans configuration CORS.
      { source: "/api/:path*/", destination: `${BACKEND_URL}/api/:path*/` },
      { source: "/api/:path*", destination: `${BACKEND_URL}/api/:path*` },
    ];
  },
};

export default nextConfig;
