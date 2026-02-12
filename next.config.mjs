/** @type {import('next').NextConfig} */
const nextConfig = {
    // Enable PWA if using next-pwa in the future, currently we will implement manifest manually
    reactStrictMode: true,
    eslint: {
        ignoreDuringBuilds: true,
    },
    typescript: {
        ignoreBuildErrors: true,
    },
};

export default nextConfig;
