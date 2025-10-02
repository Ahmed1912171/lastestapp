import { createContext, useContext, useEffect, useState } from "react";

type Session = { user: string } | null;

type AuthContextType = {
  session: Session;
  isLoading: boolean;
  signIn: () => void;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSession = async () => {
      setIsLoading(true);
      await new Promise((r) => setTimeout(r, 1000));
      setIsLoading(false);
    };
    loadSession();
  }, []);

  return (
    <AuthContext.Provider
      value={{
        session,
        isLoading,
        signIn: () => setSession({ user: "demo-user" }),
        signOut: () => setSession(null),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useSession() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useSession must be used inside SessionProvider");
  return ctx;
}
