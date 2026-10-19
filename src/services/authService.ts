import { User as FirebaseUser, createUserWithEmailAndPassword, getAuth, GoogleAuthProvider, onAuthStateChanged, signInWithEmailAndPassword, signInWithPopup, signOut, updateProfile, getIdToken } from 'firebase/auth';
import { initializeApp } from 'firebase/app';
import { UserProfile } from '../types';
import { storageService } from './storageService';

const firebaseConfig = {
  apiKey: 'AIzaSyCn7GUkOaFO4l0x1zM5mwW4hFkW2ISxR10',
  authDomain: 'shanpalia-apk-hub.firebaseapp.com',
  projectId: 'shanpalia-apk-hub',
  storageBucket: 'shanpalia-apk-hub.firebasestorage.app',
  messagingSenderId: '270953807883',
  appId: '1:270953807883:web:2dfb539c5adecade77870e',
  measurementId: 'G-J81WH8MPJW',
};

const firebaseApp = initializeApp(firebaseConfig);
const firebaseAuth = getAuth(firebaseApp);
const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export interface AuthState {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isGuest: boolean;
}

type AuthListener = (state: AuthState) => void;

const makeGuest = (): UserProfile => ({
  id: 'guest_user',
  name: 'Guest',
  email: '',
  avatarUrl: '',
  tier: 'Free',
  plan: 'Free Tier',
  credits: 850,
  createdAt: Date.now(),
});

const toProfile = (firebaseUser: FirebaseUser): UserProfile => {
  const saved = storageService.getUserProfile();
  return {
    id: firebaseUser.uid,
    name: firebaseUser.displayName || firebaseUser.email?.split('@')[0] || 'User',
    email: firebaseUser.email || '',
    avatarUrl: firebaseUser.photoURL || '',
    tier: 'Free',
    plan: 'Free Tier',
    credits: saved.id === firebaseUser.uid ? saved.credits : 850,
    createdAt: saved.id === firebaseUser.uid ? saved.createdAt : Date.now(),
  };
};

class AuthManager {
  private user: UserProfile = storageService.getUserProfile();
  private isGuest = this.user.id === 'guest_user';
  private listeners: Set<AuthListener> = new Set();

  constructor() {
    onAuthStateChanged(firebaseAuth, (firebaseUser) => {
      if (firebaseUser) {
        this.user = toProfile(firebaseUser);
        this.isGuest = false;
      } else {
        this.user = makeGuest();
        this.isGuest = true;
      }
      this.notify();
      if (firebaseUser) void this.refreshVerifiedSubscription();
    });
  }

  subscribe(listener: AuthListener): () => void {
    this.listeners.add(listener);
    listener({ user: this.user, isAuthenticated: !this.isGuest, isGuest: this.isGuest });
    return () => this.listeners.delete(listener);
  }

  private notify() {
    storageService.saveUserProfile(this.user);
    const state = { user: this.user, isAuthenticated: !this.isGuest, isGuest: this.isGuest };
    this.listeners.forEach((listener) => listener(state));
  }

  getUser(): UserProfile { return this.user; }
  getCurrentUser(): UserProfile { return this.user; }

  async getIdToken(): Promise<string | null> {
    const current = firebaseAuth.currentUser;
    return current ? getIdToken(current) : null;
  }

  async refreshVerifiedSubscription(): Promise<void> {
    const workerUrl = (import.meta.env.VITE_PALIA_PAYMENTS_WORKER_URL || '').trim().replace(/\/$/, '');
    const current = firebaseAuth.currentUser;
    if (!workerUrl || !current) return;
    try {
      const token = await getIdToken(current);
      const response = await fetch(workerUrl + '/subscription', { headers: { authorization: 'Bearer ' + token } });
      if (!response.ok) return;
      const subscription = await response.json() as { tier?: string; plan?: string };
      this.user = { ...this.user, tier: subscription.tier === 'Pro' ? 'Pro' : 'Free', plan: subscription.tier === 'Pro' ? (subscription.plan || 'Palia Pro') : 'Free Tier' };
      this.notify();
    } catch (error) {
      console.error('Could not refresh verified PaliaAi subscription:', error);
    }
  }

  async login(email: string, password?: string): Promise<{ success: boolean; error?: string }> {
    if (!password) return { success: false, error: 'Password is required.' };
    try {
      const credential = await signInWithEmailAndPassword(firebaseAuth, email.trim(), password);
      this.user = toProfile(credential.user);
      this.isGuest = false;
      this.notify();
      return { success: true };
    } catch (error: any) {
      return { success: false, error: this.friendlyError(error) };
    }
  }

  async signup(name: string, email: string, password?: string): Promise<{ success: boolean; error?: string }> {
    if (!password) return { success: false, error: 'Password is required.' };
    try {
      const credential = await createUserWithEmailAndPassword(firebaseAuth, email.trim(), password);
      if (name.trim()) await updateProfile(credential.user, { displayName: name.trim() });
      this.user = toProfile(credential.user);
      this.user.name = name.trim() || this.user.name;
      this.isGuest = false;
      this.notify();
      return { success: true };
    } catch (error: any) {
      return { success: false, error: this.friendlyError(error) };
    }
  }

  async loginWithGoogle(): Promise<{ success: boolean; error?: string }> {
    try {
      const credential = await signInWithPopup(firebaseAuth, googleProvider);
      this.user = toProfile(credential.user);
      this.isGuest = false;
      this.notify();
      return { success: true };
    } catch (error: any) {
      return { success: false, error: this.friendlyError(error) };
    }
  }

  logout(): void {
    void signOut(firebaseAuth).catch((error) => console.error('Firebase sign-out failed:', error));
    this.user = makeGuest();
    this.isGuest = true;
    this.notify();
  }

  updateProfile(updates: Partial<UserProfile>): void {
    this.user = { ...this.user, ...updates };
    this.notify();
  }

  private friendlyError(error: any): string {
    const code = String(error?.code || '');
    const messages: Record<string, string> = {
      'auth/invalid-credential': 'Email or password is incorrect.',
      'auth/user-not-found': 'No account found for this email.',
      'auth/wrong-password': 'Email or password is incorrect.',
      'auth/email-already-in-use': 'An account already exists with this email.',
      'auth/weak-password': 'Choose a password with at least 6 characters.',
      'auth/invalid-email': 'Enter a valid email address.',
      'auth/popup-closed-by-user': 'Google sign-in was cancelled.',
      'auth/popup-blocked': 'The browser blocked the sign-in popup. Allow popups and try again.',
      'auth/unauthorized-domain': 'This website domain is not authorized in Firebase Authentication settings.',
      'auth/operation-not-allowed': 'Enable this sign-in method in Firebase Console → Authentication → Sign-in method.',
      'auth/network-request-failed': 'Network error. Check your internet connection and try again.',
    };
    return messages[code] || error?.message || 'Authentication failed. Please try again.';
  }
}

export const authService = new AuthManager();


// Return a Firebase ID token for authenticated, server-side payment requests.
export async function getFirebaseIdToken(): Promise<string | null> {
  const current = firebaseAuth.currentUser;
  if (!current) return null;
  return current.getIdToken();
}
