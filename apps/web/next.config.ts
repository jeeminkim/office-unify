import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@office-unify/shared-types",
    "@office-unify/shared-utils",
    "@office-unify/ai-office-engine",
    "@office-unify/supabase-access",
  ],
};

export default nextConfig;
