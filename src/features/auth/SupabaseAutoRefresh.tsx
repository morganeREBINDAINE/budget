import { useEffect } from 'react';
import { AppState } from 'react-native';

import { supabase } from '@/lib/supabase';

// Rafraîchit le token Supabase uniquement au premier plan (recommandation Supabase pour React Native).
export function SupabaseAutoRefresh() {
  useEffect(() => {
    const apply = (state: string) => {
      if (state === 'active') void supabase.auth.startAutoRefresh();
      else void supabase.auth.stopAutoRefresh();
    };
    apply(AppState.currentState);
    const subscription = AppState.addEventListener('change', apply);
    return () => {
      subscription.remove();
      void supabase.auth.stopAutoRefresh();
    };
  }, []);
  return null;
}
