import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { AppShell } from '@/components/app-shell';

export const dynamic = 'force-dynamic';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  if (!user) redirect('/login');
  return <AppShell user={{ name: user.name, email: user.email, demo: user.demo, emergencyNumber: user.settings.emergencyNumber }}>{children}</AppShell>;
}
