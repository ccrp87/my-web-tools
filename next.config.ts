import type { NextConfig } from "next";

const browserNodeStub: string = "./browser-node-stub.js";

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: {
      fs: { browser: browserNodeStub },
      path: { browser: browserNodeStub },
    },
  },
  async redirects() {
    return [
      {
        source: "/farmacia",
        destination: "/masbarato",
        permanent: true,
      },
      {
        source: "/farmacia/:path*",
        destination: "/masbarato/:path*",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
