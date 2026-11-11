/** @type {import('next').NextConfig} */
const resolveAppUrl = () => {
    // 1. Preview deployment on Vercel (uses its own deployment URL)
    if (process.env.VERCEL_ENV === "preview" || (process.env.VERCEL_URL && process.env.VERCEL_ENV !== "production")) {
        const customAppUrl = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "").trim().replace(/\/+$/, "");
        if (customAppUrl && !/localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(customAppUrl) && !customAppUrl.includes("ur-ops.vercel.app")) {
            return customAppUrl.startsWith("http") ? customAppUrl : `https://${customAppUrl}`;
        }
        if (process.env.VERCEL_URL) {
            const vUrl = process.env.VERCEL_URL.trim().replace(/^https?:\/\//, "").replace(/\/+$/, "");
            return `https://${vUrl}`;
        }
    }

    // 2. Production deployment
    if (process.env.VERCEL_ENV === "production") {
        const prodVal = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "").trim().replace(/\/+$/, "");
        if (prodVal && !/localhost|127\.0\.0\.1|0\.0\.0\.0/i.test(prodVal)) {
            return prodVal.startsWith("http") ? prodVal : `https://${prodVal}`;
        }
        return "https://ur-ops.vercel.app";
    }

    // 3. Local development
    const localVal = (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || "").trim().replace(/\/+$/, "");
    return localVal || "http://localhost:3000";
};

const resolvedUrl = resolveAppUrl();

const nextConfig = {
    // Enable PWA if using next-pwa in the future, currently we will implement manifest manually
    reactStrictMode: true,
    env: {
        APP_URL: resolvedUrl,
        NEXT_PUBLIC_APP_URL: resolvedUrl,
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
