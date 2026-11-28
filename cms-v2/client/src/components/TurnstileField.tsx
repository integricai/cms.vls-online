import { useEffect, useRef, useState } from 'react';
import { API_BASE } from '../api/client';

interface TurnstileApi {
  render: (element: HTMLElement, options: Record<string, unknown>) => string;
  reset: (id?: string) => void;
  remove: (id: string) => void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<void> | null = null;

function loadTurnstile(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        scriptPromise = null;
        reject(new Error('Could not load the captcha.'));
      };
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
}

export function resetTurnstile(): void {
  window.turnstile?.reset();
}

export default function TurnstileField({ onToken }: { onToken: (token: string) => void }) {
  const container = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  const [error, setError] = useState('');
  onTokenRef.current = onToken;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`${API_BASE}/turnstile-site-key`);
        const json = await response.json() as { siteKey?: string; error?: string };
        if (!response.ok || !json.siteKey) {
          throw new Error(json.error || 'Captcha is not configured.');
        }
        await loadTurnstile();
        if (cancelled || !container.current || !window.turnstile) return;
        widget.current = window.turnstile.render(container.current, {
          sitekey: json.siteKey,
          callback: (token: string) => onTokenRef.current(token),
          'expired-callback': () => onTokenRef.current(''),
          'error-callback': () => onTokenRef.current(''),
        });
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Captcha is not configured.');
      }
    })();
    return () => {
      cancelled = true;
      if (widget.current && window.turnstile) window.turnstile.remove(widget.current);
    };
  }, []);

  return (
    <div>
      <div ref={container} />
      {error ? <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
