'use client';
import { AssistantChat } from '@/components/assistant-chat';
import { Disclaimer, PageHeader } from '@/components/common';
import { api } from '@/lib/client/api';
import { usePoll } from '@/hooks/use-poll';
import type { Status } from '@/lib/client/types';
import { Badge } from '@/components/ui/badge';

export function AssistantPage() {
  const s = usePoll(() => api<Status>('/api/status'), null);
  return (
    <>
      <PageHeader title="Assistant" subtitle="Describe a trip in your own words — by typing or speaking — and I’ll prepare a plan for you to review." actions={s.data && <Badge variant={s.data.ai.provider === 'meta' ? 'success' : 'simulated'}>{s.data.ai.label}</Badge>} />
      <div className="mx-auto max-w-3xl">
        <AssistantChat suggestions={['Walk from MG Road Metro to Home, check in every 10 minutes and share with Meera', 'Take a cab from Indiranagar to Koramangala', 'What happened so far on my journey?', 'I feel unsafe']} />
        <ul className="mt-4 space-y-1.5 text-xs text-muted-foreground">
          <li>• The assistant can’t start a journey, share location or contact anyone. You confirm every step.</li>
          <li>• Route explanations cite the numbered evidence they use, and flag missing or outdated data.</li>
          <li>• If the AI service is unavailable, a built-in rules engine answers and every emergency action keeps working.</li>
        </ul>
        <Disclaimer className="mt-4" />
      </div>
    </>
  );
}
