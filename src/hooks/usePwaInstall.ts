import { useState, useEffect, useCallback, useRef } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

// Check standalone mode outside of React to avoid setState-in-effect
const isStandalone = typeof window !== 'undefined' && window.matchMedia('(display-mode: standalone)').matches;

export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(isStandalone);
  const installedRef = useRef(isStandalone);

  useEffect(() => {
    if (installedRef.current) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const installedHandler = () => {
      installedRef.current = true;
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handler);
    window.addEventListener('appinstalled', installedHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  const install = useCallback(async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    return outcome === 'accepted';
  }, [deferredPrompt]);

  return {
    canInstall: !!deferredPrompt && !isInstalled,
    isInstalled,
    install,
  };
}
