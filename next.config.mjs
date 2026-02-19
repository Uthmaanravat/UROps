/** @type {import('next').NextConfig} */
const nextConfig = {
    // Enable PWA if using next-pwa in the future, currently we will implement manifest manually
    reactStrictMode: true,
    eslint: {
        ignoreDuringBuilds: false,
    },
    typescript: {
        ignoreBuildErrors: false,
    },
};

export default nextConfig;
