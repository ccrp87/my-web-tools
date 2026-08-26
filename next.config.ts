import type { NextConfig } from "next";

const browserNodeStub: string = "./browser-node-stub.js";

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: {
      fs: { browser: browserNodeStub },
      path: { browser: browserNodeStub },
    },
  },
};

export default nextConfig;
