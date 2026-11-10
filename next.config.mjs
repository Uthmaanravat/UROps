/** @type {import('next').NextConfig} */
const isProd = process.env.VERCEL_ENV === "production" || process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
const resolveProdAppUrl = (val) => {
    const clean = (val || "").trim().replace(/\/+$/, "");
    if (!clean || (isProd && /localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(clean))) {
        return "https://ur-ops.vercel.app";
    }
    return clean;
};

const nextConfig = {
    // Enable PWA if using next-pwa in the future, currently we will implement manifest manually
    reactStrictMode: true,
    env: {
        APP_URL: resolveProdAppUrl(process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL),
        NEXT_PUBLIC_APP_URL: resolveProdAppUrl(process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL),
    },
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
