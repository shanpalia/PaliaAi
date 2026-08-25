import { CreditTransaction } from '../types';

export interface CreditState {
  credits: number;
  history: CreditTransaction[];
  isLoading: boolean;
}

type CreditListener = (state: CreditState) => void;

class CreditManager {
  private credits: number = 850;
  private history: CreditTransaction[] = [
    {
      id: 'tx_init_1',
      timestamp: new Date(Date.now() - 3600000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      operation: 'Daily Welcome Credits',
      description: 'Daily Welcome Credits',
      amount: 850,
      balanceAfter: 850,
    },
  ];
  private listeners: Set<CreditListener> = new Set();
  private isLoading: boolean = false;

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    try {
      const stored = localStorage.getItem('palia_credits_v3');
      if (stored) {
        const parsed = JSON.parse(stored);
        this.credits = parsed.credits ?? 850;
        this.history = parsed.history ?? this.history;
      }
    } catch {
      // ignore
    }
  }

  private saveToStorage() {
    try {
      localStorage.setItem(
        'palia_credits_v3',
        JSON.stringify({ credits: this.credits, history: this.history })
      );
    } catch {
      // ignore
    }
  }

  subscribe(listener: CreditListener): () => void {
    this.listeners.add(listener);
    listener({ credits: this.credits, history: this.history, isLoading: this.isLoading });
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.saveToStorage();
    for (const listener of this.listeners) {
      listener({ credits: this.credits, history: this.history, isLoading: this.isLoading });
    }
  }

  getBalance(): number {
    return this.credits;
  }

  getCredits(): number {
    return this.credits;
  }

  getTransactions(): CreditTransaction[] {
    return this.history;
  }

  addCredits(amount: number, description: string = 'Credit Top-up'): void {
    this.credits += amount;
    this.history.unshift({
      id: `tx_${Date.now()}`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      operation: description,
      description,
      amount,
      balanceAfter: this.credits,
    });
    this.notify();
  }

  async deductCredits(description: string, amount: number): Promise<boolean> {
    if (this.credits >= amount) {
      this.credits -= amount;
      this.history.unshift({
        id: `tx_${Date.now()}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        operation: description,
        description,
        amount: -amount,
        balanceAfter: this.credits,
      });
      this.notify();
      return true;
    }
    return false;
  }
}

export const creditService = new CreditManager();
