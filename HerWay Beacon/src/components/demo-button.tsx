'use client';
import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Button, type ButtonProps } from '@/components/ui/button';
import { post, errMsg } from '@/lib/client/api';
import { useToast } from '@/components/toast';

export function DemoButton({ children = 'Try the demo', ...props }: ButtonProps) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = React.useState(false);
  return (
    <Button
      {...props}
      loading={busy}
      onClick={async () => {
        setBusy(true);
        try { await post('/api/auth/demo'); router.push('/app'); router.refresh(); }
        catch (e) { toast({ tone: 'error', title: 'Could not start the demo', body: errMsg(e) }); setBusy(false); }
      }}
    >
      {children}
    </Button>
  );
}
