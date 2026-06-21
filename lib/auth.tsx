import {
  createContext,
  useContext,
  useEffect,
  useState,
  type PropsWithChildren,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import {
  enterGuestMode,
  exitGuestMode,
  getPendingMigrationEmail,
  hydrateGuest,
  isGuestActive,
  migrateGuestDataToUser,
  setPendingMigrationEmail,
} from './guest';
import { syncNow } from './sync';
import { setSessionUserId } from './db/user';

type SignResult = { error: string | null };

type AuthContextValue = {
  session: Session | null;
  isGuest: boolean;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<SignResult>;
  signUp: (
    email: string,
    password: string,
  ) => Promise<SignResult & { needsConfirmation: boolean }>;
  signOut: () => Promise<void>;
  updatePassword: (password: string) => Promise<SignResult>;
  continueAsGuest: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth harus dipakai di dalam <AuthProvider>');
  }
  return ctx;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    (async () => {
      // Muat status tamu + sesi tersimpan saat app dibuka.
      await hydrateGuest();
      if (!mounted) return;
      setIsGuest(isGuestActive());
      const { data } = await supabase.auth.getSession();
      if (!mounted) return;
      setSessionUserId(data.session?.user.id ?? null);
      setSession(data.session);
      setIsLoading(false);
    })();

    // Pantau perubahan auth: login, logout, refresh token.
    const { data: listener } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        setSessionUserId(newSession?.user.id ?? null);
        setSession(newSession);

        if (newSession) {
          // Punya sesi asli sekarang -> bukan tamu lagi.
          const pendingEmail = await getPendingMigrationEmail();
          const email = newSession.user.email ?? '';
          if (pendingEmail && email.toLowerCase() === pendingEmail.toLowerCase()) {
            // Tamu yang baru DAFTAR & sesinya kini terbentuk -> migrasi datanya.
            await migrateGuestDataToUser(newSession.user.id);
            void syncNow(); // push data hasil migrasi
          }
          if (pendingEmail) await setPendingMigrationEmail(null);
          await exitGuestMode();
          setIsGuest(false);
        }
      },
    );

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function signIn(email: string, password: string): Promise<SignResult> {
    // Login = PISAH. Kalau email yang dipakai kebetulan sama dengan yang baru
    // didaftarkan tamu, migrasi tetap jalan (dicocokkan di onAuthStateChange);
    // kalau beda akun, niat migrasi dibatalkan di sana.
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }

  async function signUp(email: string, password: string) {
    // Kalau pendaftar adalah tamu, tandai email-nya supaya datanya dimigrasi
    // begitu sesi akun ini terbentuk (langsung, atau setelah konfirmasi email).
    if (isGuestActive()) await setPendingMigrationEmail(email);
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) await setPendingMigrationEmail(null);
    return {
      error: error?.message ?? null,
      needsConfirmation: !error && !data.session,
    };
  }

  async function signOut() {
    // Keluar mode tamu tidak menyentuh Supabase; data tamu tetap di HP.
    if (isGuestActive()) {
      await exitGuestMode();
      setIsGuest(false);
      return;
    }
    await supabase.auth.signOut();
  }

  async function continueAsGuest() {
    await enterGuestMode();
    setIsGuest(true);
  }

  async function updatePassword(password: string): Promise<SignResult> {
    const { error } = await supabase.auth.updateUser({ password });
    return { error: error?.message ?? null };
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        isGuest,
        isLoading,
        signIn,
        signUp,
        signOut,
        updatePassword,
        continueAsGuest,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
