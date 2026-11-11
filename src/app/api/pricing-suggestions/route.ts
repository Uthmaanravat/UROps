import { NextRequest, NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-actions";
import { getPricingSuggestions } from "@/app/actions/ai";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
    try {
        const authUser = await getAuthUser();
        if (!authUser || !authUser.companyId) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const body = await request.json().catch(() => ({}));
        const items = Array.isArray(body?.items) ? body.items : [];
        if (items.length === 0) {
            return NextResponse.json({ suggestions: {} });
        }

        const suggestions = await getPricingSuggestions(items);
        return NextResponse.json({ suggestions });
    } catch (err: any) {
        console.error("API /api/pricing-suggestions error:", err);
        return NextResponse.json({ error: err.message || "Internal error" }, { status: 500 });
    }
}
