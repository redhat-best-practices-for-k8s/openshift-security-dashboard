import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @kubernetes/client-node is server-only; ensure it's not bundled for client
  serverExternalPackages: ["@kubernetes/client-node"],
};

export default nextConfig;
