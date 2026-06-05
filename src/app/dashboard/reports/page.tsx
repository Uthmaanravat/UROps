import { redirect } from 'next/navigation';

// Forward `/dashboard/reports` to the real reports page
export default function DashboardReportsRedirect() {
  redirect('/reports');
}
