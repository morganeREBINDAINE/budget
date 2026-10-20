import { useEffect, useRef, useSyncExternalStore } from 'react';

import { useAuth, useUserId } from '@/features/auth/AuthProvider';
import { showToast } from '@/lib/toast';
import { getSyncRunState, subscribeSyncRun } from '@/sync/syncNow';

import { useInitialPull } from './useInitialPull';

const MESSAGE = 'Synchronisation en pause : reconnecte-toi dans Mon compte.';

// Prévient une fois par lancement (montage) que la synchronisation est en pause faute de session
// valide (synchro ou pull initial) ; le détail et le bouton « Se reconnecter avec Google » sont sur la carte Compte.
export function ReauthNotifier() {
  const { needsReauth } = useAuth();
  const userId = useUserId();
  const run = useSyncExternalStore(subscribeSyncRun, () => getSyncRunState(userId));
  const { status: pullStatus } = useInitialPull();
  const required = needsReauth || (run?.sessionRefused ?? false) || pullStatus === 'reauth';
  const notified = useRef(false);

  useEffect(() => {
    if (!required || notified.current) return;
    notified.current = true;
    showToast({ message: MESSAGE, variant: 'error', key: 'sync:reauth' });
  }, [required]);

  return null;
}
