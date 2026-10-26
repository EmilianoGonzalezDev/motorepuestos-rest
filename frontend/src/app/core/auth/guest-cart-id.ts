import { Injectable } from '@angular/core';

const STORAGE_KEY = 'mr_cart_id';

/** Anonymous cart identifier, sent to the API in the X-Cart-Id header. */
@Injectable({ providedIn: 'root' })
export class GuestCartId {
  private memoryFallback: string | null = null;

  get value(): string {
    try {
      let id = localStorage.getItem(STORAGE_KEY);
      if (!id) {
        id = crypto.randomUUID();
        localStorage.setItem(STORAGE_KEY, id);
      }
      return id;
    } catch {
      this.memoryFallback ??= crypto.randomUUID();
      return this.memoryFallback;
    }
  }

  /** The current id if a guest cart was ever started on this browser (never creates one). */
  peek(): string | null {
    try {
      return localStorage.getItem(STORAGE_KEY) ?? this.memoryFallback;
    } catch {
      return this.memoryFallback;
    }
  }

  /** Starts a fresh guest cart (after merging into a user cart, or on logout). */
  reset(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      this.memoryFallback = null;
    }
  }
}
