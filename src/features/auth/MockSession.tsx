import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

type Session = { signedIn: boolean; signIn: () => void; signOut: () => void };

const SessionContext = createContext<Session | null>(null);

// Session factice (phase 2) : remplacée par la session Supabase en phase 5.
export function MockSessionProvider({ children }: { children: ReactNode }) {
  const [signedIn, setSignedIn] = useState(false);
  const value = useMemo(
    () => ({ signedIn, signIn: () => setSignedIn(true), signOut: () => setSignedIn(false) }),
    [signedIn],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession doit être utilisé dans MockSessionProvider');
  return session;
}
