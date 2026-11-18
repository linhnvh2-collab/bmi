import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { onAuthStateChanged, signOut, type User } from 'firebase/auth';
import { auth } from '@/src/lib/firebase/config';
import { formatFirestoreUiErrorVi } from '@/src/lib/firebase/errors';
import {
  addFavoriteFood,
  removeFavoriteFood,
  subscribeFavorites,
} from '@/src/lib/firebase/favoritesService';
import { subscribeCurrentGoal } from '@/src/lib/firebase/goalsService';
import { subscribeHealthRecords } from '@/src/lib/firebase/healthRecordsService';
import { getUserProfile } from '@/src/lib/firebase/profileService';
import type { FavoriteFood } from '@/src/types/food';
import type { HealthRecord, UserProfile } from '@/src/types/health';
import type { UserGoal } from '@/src/types/stage3';

interface AuthContextValue {
  user: User | null;
  authLoading: boolean;
  isAdmin: boolean;
  profile: UserProfile | null;
  profileLoading: boolean;
  profileError: string | null;
  healthRecords: HealthRecord[];
  recordsLoading: boolean;
  recordsError: string | null;
  favorites: FavoriteFood[];
  favoriteIds: Set<string>;
  favoritesLoading: boolean;
  favoritesError: string | null;
  currentGoal: UserGoal | null;
  goalLoading: boolean;
  goalError: string | null;
  toggleFavorite: (foodId: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
  signOutUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [healthRecords, setHealthRecords] = useState<HealthRecord[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [recordsError, setRecordsError] = useState<string | null>(null);

  const [favorites, setFavorites] = useState<FavoriteFood[]>([]);
  const [favoritesLoading, setFavoritesLoading] = useState(false);
  const [favoritesError, setFavoritesError] = useState<string | null>(null);

  const [currentGoal, setCurrentGoal] = useState<UserGoal | null>(null);
  const [goalLoading, setGoalLoading] = useState(false);
  const [goalError, setGoalError] = useState<string | null>(null);

  const loadProfile = useCallback(async (uid: string) => {
    setProfileLoading(true);
    setProfileError(null);
    try {
      const data = await getUserProfile(uid);
      setProfile(data);
    } catch (err) {
      setProfileError(formatFirestoreUiErrorVi(err));
    } finally {
      setProfileLoading(false);
    }
  }, []);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (!firebaseUser) {
        setIsAdmin(false);
        setProfile(null);
        setProfileError(null);
        setHealthRecords([]);
        setRecordsError(null);
        setFavorites([]);
        setFavoritesError(null);
        setCurrentGoal(null);
        setGoalError(null);
        setAuthLoading(false);
        return;
      }

      try {
        const tokenResult = await firebaseUser.getIdTokenResult();
        setIsAdmin(tokenResult.claims.admin === true);
      } catch {
        setIsAdmin(false);
      } finally {
        setAuthLoading(false);
      }
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) return;
    void loadProfile(user.uid);
  }, [user, loadProfile]);

  useEffect(() => {
    if (!user) {
      setRecordsLoading(false);
      setFavoritesLoading(false);
      setGoalLoading(false);
      return;
    }

    setRecordsLoading(true);
    setRecordsError(null);

    const unsubscribeRecords = subscribeHealthRecords(
      user.uid,
      (records) => {
        setHealthRecords(records);
        setRecordsLoading(false);
      },
      (err) => {
        setRecordsError(formatFirestoreUiErrorVi(err));
        setRecordsLoading(false);
      }
    );

    setFavoritesLoading(true);
    setFavoritesError(null);

    const unsubscribeFavorites = subscribeFavorites(
      user.uid,
      (items) => {
        setFavorites(items);
        setFavoritesLoading(false);
      },
      (err) => {
        setFavoritesError(formatFirestoreUiErrorVi(err));
        setFavoritesLoading(false);
      }
    );

    setGoalLoading(true);
    setGoalError(null);

    const unsubscribeGoal = subscribeCurrentGoal(
      user.uid,
      (goal) => {
        setCurrentGoal(goal);
        setGoalLoading(false);
      },
      (err) => {
        setGoalError(formatFirestoreUiErrorVi(err));
        setGoalLoading(false);
      }
    );

    return () => {
      unsubscribeRecords();
      unsubscribeFavorites();
      unsubscribeGoal();
    };
  }, [user]);

  const favoriteIds = useMemo(
    () => new Set(favorites.map((item) => item.foodId)),
    [favorites]
  );

  const toggleFavorite = useCallback(
    async (foodId: string) => {
      if (!user) {
        throw new Error('Vui lòng đăng nhập để lưu món yêu thích.');
      }
      if (favoriteIds.has(foodId)) {
        await removeFavoriteFood(user.uid, foodId);
      } else {
        await addFavoriteFood(user.uid, foodId);
      }
    },
    [user, favoriteIds]
  );

  const refreshProfile = useCallback(async () => {
    if (user) {
      await loadProfile(user.uid);
    }
  }, [user, loadProfile]);

  const signOutUser = useCallback(async () => {
    await signOut(auth);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        authLoading,
        isAdmin,
        profile,
        profileLoading,
        profileError,
        healthRecords,
        recordsLoading,
        recordsError,
        favorites,
        favoriteIds,
        favoritesLoading,
        favoritesError,
        currentGoal,
        goalLoading,
        goalError,
        toggleFavorite,
        refreshProfile,
        signOutUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
