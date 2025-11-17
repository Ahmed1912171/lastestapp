import { createContext, useContext, useEffect, useState } from "react";

// ✅ Enhanced user data type
type UserData = {
  ADMIN_ID: string;
  GR_EMPLOYER_LOGIN: string;
  pinNumber: string | null;
  branch?: string;
  ADMIN_FIRST_NAME?: string | null;
  ADMIN_LAST_NAME?: string | null;
  manager_status?: number | null;
};

type Session = { user: UserData } | null;

type AuthContextType = {
  session: Session;
  isLoading: boolean;
  signIn: (userData: UserData) => void;
  signOut: () => void;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadSession = async () => {
      setIsLoading(true);
      // TODO: Load saved session from AsyncStorage
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
        signIn: (userData: UserData) => setSession({ user: userData }),
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
