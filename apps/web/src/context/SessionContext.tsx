import { createContext, useContext, useEffect, useState } from "react";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import LoadingPage from "../pages/LoadingPage";
import { getUserProfile } from "@/api/queries";
import { useQuery } from "@tanstack/react-query";

export interface AppUser {
  id: string;
  email: string | null;
  user_metadata: { first_name?: string };
}

export interface AppSession {
  user: AppUser;
}

const SessionContext = createContext<{
  session: AppSession | null;
  defaultBoard: string | null;
  setDefaultBoard: (boardId: string | null) => void;
  signOutUser: () => Promise<void>;
}>({
  session: null,
  defaultBoard: null,
  setDefaultBoard: () => { },
  signOutUser: async () => { },
});

// eslint-disable-next-line react-refresh/only-export-components
export const useSession = () => {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used within a SessionProvider");
  }
  return context;
};

type Props = { children: React.ReactNode };

export const SessionProvider = ({ children }: Props) => {
  const [session, setSession] = useState<AppSession | null>(null);
  const [defaultBoard, setDefaultBoard] = useState<string | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setSession(
        user
          ? {
              user: {
                id: user.uid,
                email: user.email,
                user_metadata: { first_name: user.displayName ?? undefined },
              },
            }
          : null
      );
      setIsAuthLoading(false);
    });

    return unsubscribe;
  }, []);

  const {
    data: userProfile,
    isLoading: isProfileLoading
  } = useQuery({
    queryKey: ['userProfile', session?.user.id],
    queryFn: () => getUserProfile(),
    enabled: !!session?.user.id,
  });

  useEffect(() => {
    if (userProfile) {
      setDefaultBoard(userProfile.default_board_id);
    } else if (!session) {
      setDefaultBoard(null);
    }
  }, [userProfile, session]);

  const signOutUser = async () => {
    await signOut(auth);
  };

  // The app is "loading" if we are waiting for Auth, OR if Auth is done (and logged in) but we are still fetching the Profile.
  const isAppLoading = isAuthLoading || (!!session?.user.id && isProfileLoading);

  return (
    <SessionContext.Provider value={{ session, defaultBoard, setDefaultBoard, signOutUser }}>
      {isAppLoading ? <LoadingPage /> : children}
    </SessionContext.Provider>
  );
};
