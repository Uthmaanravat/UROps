import { getSubmissionsByType } from "@/lib/submission-logger";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, ExternalLink } from "lucide-react";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";

export const dynamic = 'force-dynamic';

function formatDate(date: Date) {
    return formatDistanceToNow(new Date(date), { addSuffix: true });
}

export default async function SOWSubmissionsPage() {
    const submissions = await getSubmissionsByType('SOW');

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">SOW Submissions</h1>
                <p className="text-muted-foreground">All Scope of Work submissions</p>
            </div>

            <div className="grid gap-4">
                {submissions.length === 0 ? (
                    <Card>
                        <CardContent className="py-8 text-center text-muted-foreground">
                            No SOW submissions yet.
                        </CardContent>
                    </Card>
                ) : (
                    submissions.map((submission: any) => (
                        <Card key={submission.id} className="hover:bg-muted/50 transition-colors">
                            <CardContent className="p-6">
                                <div className="flex items-start justify-between">
                                    <div className="flex gap-4 flex-1">
                                        <div className="bg-primary/10 p-3 rounded-full">
                                            <FileText className="h-6 w-6 text-primary" />
                                        </div>
                                        <div className="flex-1 space-y-2">
                                            <div className="flex items-center gap-2">
                                                <h3 className="font-semibold text-lg">{submission.message}</h3>
                                                <Badge variant="outline" className="text-xs">
                                                    {submission.submittedBy}
                                                </Badge>
                                            </div>

                                            {submission.documentRef && (
                                                <div className="text-sm text-muted-foreground">
                                                    Document: <span className="font-medium">{submission.documentRef}</span>
                                                </div>
                                            )}

                                            {submission.metadata?.site && (
                                                <div className="text-sm text-muted-foreground">
                                                    Site: <span className="font-medium">{submission.metadata.site}</span>
                                                </div>
                                            )}

                                            {submission.project && (
                                                <div className="flex items-center gap-2 text-sm">
                                                    <span className="text-muted-foreground">Project:</span>
                                                    <Link
                                                        href={`/projects/${submission.project.id}`}
                                                        className="text-primary hover:underline flex items-center gap-1"
                                                    >
                                                        {submission.project.name}
                                                        <ExternalLink className="h-3 w-3" />
                                                    </Link>
                                                </div>
                                            )}

                                            {submission.client && (
                                                <div className="text-sm text-muted-foreground">
                                                    Client: <span className="font-medium">{submission.client.name}</span>
                                                </div>
                                            )}

                                            {submission.metadata?.wbpId && (
                                                <div className="flex items-center gap-2 text-sm">
                                                    <span className="text-muted-foreground">WB&P:</span>
                                                    <Link
                                                        href={`/work-breakdown-pricing/${submission.metadata.wbpId}`}
                                                        className="text-primary hover:underline flex items-center gap-1"
                                                    >
                                                        View Work Breakdown & Pricing
                                                        <ExternalLink className="h-3 w-3" />
                                                    </Link>
                                                </div>
                                            )}

                                            <div className="text-xs text-muted-foreground pt-2">
                                                {formatDate(submission.createdAt)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    ))
                )}
            </div>
        </div>
    );
}
