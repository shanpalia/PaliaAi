import { UserProfile } from '../types';
import { storageService } from './storageService';

export interface AuthState {
  user: UserProfile | null;
  isAuthenticated: boolean;
  isGuest: boolean;
}

type AuthListener = (state: AuthState) => void;

class AuthManager {
  private user: UserProfile;
  private isGuest: boolean = true;
  private listeners: Set<AuthListener> = new Set();

  constructor() {
    this.user = storageService.getUserProfile();
    this.isGuest = this.user.id === 'guest_user';
  }

  subscribe(listener: AuthListener): () => void {
    this.listeners.add(listener);
    listener({
      user: this.user,
      isAuthenticated: !this.isGuest,
      isGuest: this.isGuest,
    });
    return () => this.listeners.delete(listener);
  }

  private notify() {
    storageService.saveUserProfile(this.user);
    for (const listener of this.listeners) {
      listener({
        user: this.user,
        isAuthenticated: !this.isGuest,
        isGuest: this.isGuest,
      });
    }
  }

  getUser(): UserProfile {
    return this.user;
  }

  getCurrentUser(): UserProfile {
    return this.user;
  }

  async login(email: string, _password?: string): Promise<{ success: boolean; error?: string }> {
    const name = email.split('@')[0];
    this.user = {
      id: 'usr_' + Date.now(),
      name: name.charAt(0).toUpperCase() + name.slice(1),
      email,
      avatarUrl: '',
      tier: 'Pro',
      plan: 'Palia Pro',
      credits: 850,
      createdAt: Date.now(),
    };
    this.isGuest = false;
    this.notify();
    return { success: true };
  }

  async signup(name: string, email: string, _password?: string): Promise<{ success: boolean; error?: string }> {
    this.user = {
      id: 'usr_' + Date.now(),
      name: name || email.split('@')[0],
      email,
      avatarUrl: '',
      tier: 'Pro',
      plan: 'Palia Pro',
      credits: 850,
      createdAt: Date.now(),
    };
    this.isGuest = false;
    this.notify();
    return { success: true };
  }

  async loginWithGoogle(): Promise<{ success: boolean; error?: string }> {
    const mockEmail = 'shanpalia786@gmail.com';
    this.user = {
      id: 'google_usr_' + Date.now(),
      name: 'Shan Palia',
      email: mockEmail,
      avatarUrl: '',
      tier: 'Pro',
      plan: 'Palia Pro',
      credits: 850,
      createdAt: Date.now(),
    };
    this.isGuest = false;
    this.notify();
    return { success: true };
  }

  logout(): void {
    this.user = {
      id: 'guest_user',
      name: 'Shan Palia',
      email: 'shanpalia786@gmail.com',
      avatarUrl: '',
      tier: 'Free',
      plan: 'Free Tier',
      credits: 850,
      createdAt: Date.now(),
    };
    this.isGuest = true;
    this.notify();
  }

  updateProfile(updates: Partial<UserProfile>): void {
    this.user = { ...this.user, ...updates };
    this.notify();
  }
}

export const authService = new AuthManager();
