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
    experimental: {
        serverActions: {
            bodySizeLimit: "50mb",
        },
    },
    async redirects() {
        return [
            {
                source: "/drone",
                destination: "/prospects",
                permanent: false,
            },
        ];
    },
};

export default nextConfig;
