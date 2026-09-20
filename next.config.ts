import type { NextConfig } from "next";

function getHostname(value: string | undefined) {
  const normalized = value?.trim();
  if (!normalized) return null;

  try {
    return new URL(normalized).hostname;
  } catch {
    return normalized.split("/")[0]?.split(":")[0] || null;
  }
}

const storageImageHosts = Array.from(
  new Set(
    [
      getHostname(process.env.STORAGE_PUBLIC_BASE_URL),
      getHostname(process.env.NEXT_PUBLIC_STORAGE_PUBLIC_BASE_URL),
      ...(process.env.STORAGE_IMAGE_REMOTE_HOSTS ?? "")
        .split(",")
        .map((host) => host.trim())
        .filter(Boolean)
    ].filter((host): host is string => Boolean(host))
  )
);

const serverActionAllowedOrigins = Array.from(
  new Set(
    [
      getHostname(process.env.APP_URL),
      getHostname(process.env.NEXT_PUBLIC_SITE_URL),
      ...(process.env.SERVER_ACTION_ALLOWED_ORIGINS ?? "")
        .split(",")
        .map(getHostname)
    ].filter((origin): origin is string => Boolean(origin))
  )
);

const nextConfig: NextConfig = {
  output: "standalone",
  poweredByHeader: false,
  reactStrictMode: true,
  experimental: serverActionAllowedOrigins.length
    ? { serverActions: { allowedOrigins: serverActionAllowedOrigins } }
    : undefined,
  images: storageImageHosts.length
    ? {
        remotePatterns: storageImageHosts.map((hostname) => ({
          protocol: "https" as const,
          hostname,
          pathname: "/**"
        }))
      }
    : undefined,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" }
        ]
      }
    ];
  }
};

export default nextConfig;
