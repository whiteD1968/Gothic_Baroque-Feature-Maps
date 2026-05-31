/** @type {import('next').NextConfig} */
const isGhPages = process.env.GITHUB_PAGES === "true";
const ghBasePath = process.env.GH_PAGES_BASE_PATH || "/Gothic_Baroque-Feature-Maps";

const nextConfig = {
  reactStrictMode: true,
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
  ...(isGhPages
    ? {
      basePath: ghBasePath,
      assetPrefix: `${ghBasePath}/`,
    }
    : {}),
};

module.exports = nextConfig;
