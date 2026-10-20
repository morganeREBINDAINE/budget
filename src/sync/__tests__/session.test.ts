import { AuthRetryableFetchError, AuthApiError } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';
import { requireSession, SessionError } from '@/sync/session';

jest.mock('@/lib/supabase', () => ({ supabase: { auth: { getSession: jest.fn() } } }));

const getSession = jest.mocked(supabase.auth.getSession);

const USER = 'user-a';

const respond = (session: { user: { id: string } } | null, error: Error | null = null) =>
  getSession.mockResolvedValue({ data: { session }, error } as Awaited<
    ReturnType<typeof supabase.auth.getSession>
  >);

describe('requireSession', () => {
  it('accepte une session du compte', async () => {
    respond({ user: { id: USER } });
    await expect(requireSession(USER)).resolves.toBeUndefined();
  });

  it('session absente (rafraîchissement refusé) : erreur de session', async () => {
    respond(null);
    await expect(requireSession(USER)).rejects.toBeInstanceOf(SessionError);
  });

  it('session d’un autre compte : erreur de session', async () => {
    respond({ user: { id: 'user-b' } });
    await expect(requireSession(USER)).rejects.toBeInstanceOf(SessionError);
  });

  it('rafraîchissement impossible faute de réseau : erreur passagère', async () => {
    respond(null, new AuthRetryableFetchError('Failed to fetch', 0));
    const error = await requireSession(USER).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(SessionError);
  });

  it('autre erreur d’authentification : erreur de session', async () => {
    respond(null, new AuthApiError('Invalid Refresh Token', 400, 'refresh_token_not_found'));
    await expect(requireSession(USER)).rejects.toBeInstanceOf(SessionError);
  });
});
