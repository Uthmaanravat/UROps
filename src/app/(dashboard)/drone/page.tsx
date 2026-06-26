import { prisma } from "@/lib/prisma";
import { ensureAuth } from "@/lib/auth-actions";
import { DroneDashboardClient } from "@/components/dashboard/DroneDashboardClient";
import { getCompanySettings } from "../settings/actions";
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

        const [leads, optOuts] = await Promise.all([
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
            })
        ]);
        
        const droneData = JSON.parse(JSON.stringify({ leads, optOuts }));
        
        return <DroneDashboardClient data={droneData} />;
    } catch (error) {
        console.error("Drone Dashboard Load Error:", error);
        redirect("/dashboard");
    }
}
