import type { Metadata } from 'next';
import { AdminShell } from '@/components/admin/admin-ui';
import { VisitorRequests } from '@/components/admin/visitor-requests';
import { requireOwnerAdmin } from '@/server/auth';

export const metadata: Metadata = {
  title: 'Privacy requests',
  robots: { index: false, follow: false, nocache: true },
};

export default async function VisitorRequestsPage() {
  await requireOwnerAdmin();
  return <AdminShell
    current="/admin/visitor-requests"
    title="Privacy requests"
    description="Find a visitor-intake entry, apply a requested correction or deletion, and confirm completion."
  >
    <VisitorRequests />
  </AdminShell>;
}
