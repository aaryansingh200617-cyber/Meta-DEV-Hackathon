import { HistoryDetail } from '@/components/history';
export const metadata = { title: 'Journey detail' };
export default async function Page({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; return <HistoryDetail id={id} />; }
