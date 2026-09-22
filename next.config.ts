import type { NextConfig } from "next";

const isDev = process.env.NODE_ENV === "development";

// Sites allowed to embed Slotwell booking pages in an iframe (comma-separated origins).
const embedAncestors = (process.env.EMBED_ALLOWED_ORIGINS ?? "https://prashanta.dev")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean)
  .join(" ");

const baseCsp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://lh3.googleusercontent.com",
  "font-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://accounts.google.com",
  ...(isDev ? [] : ["upgrade-insecure-requests"]),
];

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [
      {
        // Everything except the embed pages may only be framed by Slotwell itself.
        source: "/((?!embed/).*)",
        headers: [
          ...securityHeaders,
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Content-Security-Policy", value: [...baseCsp, "frame-ancestors 'self'"].join("; ") },
        ],
      },
      {
        // Embed pages can be framed by the allow-listed sites (e.g. prashanta.dev).
        source: "/embed/:path*",
        headers: [
          ...securityHeaders,
          { key: "Content-Security-Policy", value: [...baseCsp, `frame-ancestors 'self' ${embedAncestors}`].join("; ") },
        ],
      },
    ];
  },
};

export default nextConfig;
