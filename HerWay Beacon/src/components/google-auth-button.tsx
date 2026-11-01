'use client';
import * as React from 'react';
import Script from 'next/script';
import { useRouter } from 'next/navigation';
import { post, errMsg } from '@/lib/client/api';
import { Button } from '@/components/ui/button';

interface GoogleSignInProps {
  mode: 'login' | 'register';
  onError?: (msg: string) => void;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
            cancel_on_tap_outside?: boolean;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              type?: 'standard' | 'icon';
              theme?: 'outline' | 'filled_blue' | 'filled_black';
              size?: 'large' | 'medium' | 'small';
              text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin';
              shape?: 'rectangular' | 'pill' | 'circle' | 'square';
              logo_alignment?: 'left' | 'center';
              width?: number | string;
              locale?: string;
            }
          ) => void;
          prompt?: (momentListener?: (notification: unknown) => void) => void;
        };
      };
    };
  }
}

export function GoogleSignInButton({ mode, onError }: GoogleSignInProps) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);
  const [rendered, setRendered] = React.useState(false);
  const buttonRef = React.useRef<HTMLDivElement>(null);
  const clientId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID || '';

  const handleCredentialResponse = React.useCallback(
    async (response: { credential: string }) => {
      setLoading(true);
      try {
        await post('/api/auth/google', { credential: response.credential });
        router.push('/app');
        router.refresh();
      } catch (err) {
        setLoading(false);
        onError?.(errMsg(err));
      }
    },
    [router, onError]
  );

  const initGoogle = React.useCallback(() => {
    if (!clientId || !window.google || !buttonRef.current) return false;
    try {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleCredentialResponse,
      });

      const parentW = buttonRef.current.parentElement?.clientWidth;
      const btnWidth = parentW ? Math.min(380, Math.max(240, parentW)) : 340;

      buttonRef.current.innerHTML = '';
      window.google.accounts.id.renderButton(buttonRef.current, {
        theme: 'outline',
        size: 'large',
        text: mode === 'register' ? 'signup_with' : 'signin_with',
        shape: 'rectangular',
        width: btnWidth,
      });
      setRendered(true);
      return true;
    } catch (e) {
      console.warn('[GoogleAuth] Google button init error', e);
      return false;
    }
  }, [clientId, mode, handleCredentialResponse]);

  React.useEffect(() => {
    if (!clientId) return;

    if (initGoogle()) return;

    const interval = setInterval(() => {
      if (initGoogle()) {
        clearInterval(interval);
      }
    }, 100);

    const timeout = setTimeout(() => clearInterval(interval), 5000);
    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [clientId, initGoogle]);

  const buttonText = mode === 'register' ? 'Sign up with Google' : 'Sign in with Google';

  if (!clientId) {
    return (
      <div className="w-full">
        <Button
          type="button"
          variant="outline"
          className="w-full flex items-center justify-center gap-3 border-border hover:bg-surface-elevated text-sm font-semibold h-11"
          onClick={() => {
            onError?.('Google Login requires NEXT_PUBLIC_GOOGLE_CLIENT_ID in your .env file.');
          }}
        >
          <GoogleIcon />
          <span>{buttonText}</span>
        </Button>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col items-center">
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="beforeInteractive"
        onLoad={() => {
          initGoogle();
        }}
      />
      <div className="relative w-full min-h-[44px]">
        {/* Instant button visible immediately on first frame */}
        {!rendered && (
          <Button
            type="button"
            variant="outline"
            className="w-full flex items-center justify-center gap-3 border-border hover:bg-surface-elevated text-sm font-semibold h-11 shadow-xs"
            loading={loading}
            onClick={() => {
              if (window.google?.accounts?.id?.prompt) {
                window.google.accounts.id.prompt();
              } else {
                setLoading(true);
              }
            }}
          >
            <GoogleIcon />
            <span>{buttonText}</span>
          </Button>
        )}
        {/* Google's official rendered button */}
        <div
          ref={buttonRef}
          className={rendered ? 'w-full flex items-center justify-center' : 'absolute inset-0 opacity-0 pointer-events-none'}
        />
      </div>
      {loading && (
        <p className="mt-2 text-xs text-muted-foreground animate-pulse">
          Verifying Google account...
        </p>
      )}
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
      />
    </svg>
  );
}
