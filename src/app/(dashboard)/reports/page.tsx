// Reports page for dashboard
import { prisma } from "@/lib/prisma";
import { ensureAuth } from "@/lib/auth-actions";
import { ReportsList } from "./ReportsList";
import { redirect } from "next/navigation";
import React from "react";
import { Button } from "@/components/ui/button";



export default async function ReportsPage() {
  const companyId = await ensureAuth();
  if (!companyId) redirect('/login');

  try {
    const [reports, clients, projects] = await Promise.all([
      prisma.report.findMany({
        where: { companyId },
        select: {
          id: true,
          title: true,
          date: true,
          client: { select: { name: true, companyName: true } },
          project: { select: { name: true } },
          _count: { select: { items: true } }
        },
        orderBy: { date: 'desc' }
      }),
      prisma.client.findMany({ where: { companyId }, select: { id: true, name: true } }),
      prisma.project.findMany({ where: { companyId }, select: { id: true, name: true, clientId: true } })
    ]);

    const serializedReports = JSON.parse(JSON.stringify(reports));
    return (
      <div className="max-w-7xl mx-auto py-6">
        <ReportsList
          reports={serializedReports}
          clients={clients}
          projects={projects}
          companyId={companyId}
        />
      </div>
    );
  } catch (err) {
    console.error('Failed to load reports page:', err);
    // Fallback UI when DB is unavailable
    return (
      <div className="flex min-h-screen flex-col items-center justify-center p-4 text-center">
        <div className="max-w-md space-y-4 p-8 bg-red-50 dark:bg-red-950/20 rounded-xl border border-red-200 dark:border-red-900">
          <h1 className="text-2xl font-bold text-red-600 dark:text-red-400">Reports Error</h1>
          <p className="text-muted-foreground text-sm">Unable to load reports data at this time.</p>
          <div className="flex gap-2 justify-center mt-4">
            <Button onClick={() => window.location.reload()} variant="outline">Retry</Button>
          </div>
        </div>
      </div>
    );
  }
}
