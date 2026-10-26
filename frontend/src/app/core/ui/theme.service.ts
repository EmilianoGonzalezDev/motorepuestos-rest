import { DOCUMENT } from '@angular/common';
import { Injectable, effect, inject, signal } from '@angular/core';

const STORAGE_KEY = 'mr_theme';

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  readonly dark = signal(this.document.documentElement.classList.contains('dark'));

  constructor() {
    effect(() => {
      const dark = this.dark();
      this.document.documentElement.classList.toggle('dark', dark);
      try {
        localStorage.setItem(STORAGE_KEY, dark ? 'dark' : 'light');
      } catch {
        /* storage unavailable (private mode) */
      }
    });
  }

  toggle(): void {
    this.dark.update((d) => !d);
  }
}
