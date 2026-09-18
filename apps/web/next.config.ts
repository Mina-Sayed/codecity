import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@codecity/city-layout", "@codecity/graph-core", "@codecity/repository-ingestion"],
  serverExternalPackages: ["oxc-parser"],
};

export default nextConfig;
