import { prisma } from "@/lib/prisma";
import { ensureAuth } from "@/lib/auth-actions";
import { DroneWorkspace } from "@/components/dashboard/DroneWorkspace";
import { getCompanySettings } from "../settings/actions";
import { ensureFable37Seeded } from "@/lib/prospect-seed";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export const dynamic = 'force-dynamic';

export default async function DroneDashboardPage() {
    try {
        const companyId = await ensureAuth();

        // Safety check: verify drone view is enabled in settings
        const settings = await getCompanySettings();
        // @ts-ignore
        const isDroneEnabled = settings?.layoutPreferences?.dashboardView === "drone";

        if (!isDroneEnabled) {
            redirect("/dashboard");
        }

        // Import any Fable-37 seed prospects not yet in the DB (never overwrites existing ones)
        await ensureFable37Seeded(companyId);

        const supabase = createClient();
        const { data: { user } } = supabase
            ? await supabase.auth.getUser()
            : { data: { user: null } };
        const dbUser = user
            ? await prisma.user.findUnique({ where: { id: user.id }, select: { name: true, phone: true } })
            : null;

        const [leads, optOuts, prospects] = await Promise.all([
            prisma.lead.findMany({
                where: { companyId },
                include: {
                    project: {
                        include: {
                            invoices: {
                                include: {
                                    payments: true
                                }
                            }
                        }
                    }
                },
                orderBy: { createdAt: 'desc' }
            }),
            prisma.optOut.findMany({
                where: { companyId },
                orderBy: { createdAt: 'desc' }
            }),
            prisma.prospect.findMany({
                where: { companyId },
                orderBy: { createdAt: 'asc' }
            })
        ]);

        const droneData = JSON.parse(JSON.stringify({ leads, optOuts }));
        const prospectData = JSON.parse(JSON.stringify(prospects));

        const sender = {
            name: dbUser?.name || (settings as any)?.name || "Operations",
            phone: dbUser?.phone || (settings as any)?.phone || "",
            title: "Drone Operations",
            companyName: (settings as any)?.name || "UROps"
        };

        return <DroneWorkspace prospects={prospectData} sender={sender} scannerData={droneData} />;
    } catch (error) {
        console.error("Drone Dashboard Load Error:", error);
        redirect("/dashboard");
    }
}
