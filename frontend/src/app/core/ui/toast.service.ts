import { Injectable, signal } from '@angular/core';

export type ToastKind = 'success' | 'error' | 'info' | 'warning';

export interface ToastAction {
  label: string;
  run: () => void;
}

export interface Toast {
  id: number;
  kind: ToastKind;
  title: string;
  message?: string;
  action?: ToastAction;
}

/** Lightweight toast notifications rendered by <app-toast-host>. */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private nextId = 1;
  readonly toasts = signal<Toast[]>([]);

  success(title: string, message?: string, action?: ToastAction): void {
    this.show({ kind: 'success', title, message, action });
  }

  error(title: string, message?: string): void {
    this.show({ kind: 'error', title, message }, 6000);
  }

  info(title: string, message?: string, action?: ToastAction): void {
    this.show({ kind: 'info', title, message, action });
  }

  warning(title: string, message?: string): void {
    this.show({ kind: 'warning', title, message }, 5000);
  }

  dismiss(id: number): void {
    this.toasts.update((list) => list.filter((t) => t.id !== id));
  }

  private show(toast: Omit<Toast, 'id'>, durationMs = 3500): void {
    const id = this.nextId++;
    this.toasts.update((list) => [...list.slice(-3), { ...toast, id }]);
    setTimeout(() => this.dismiss(id), durationMs);
  }
}
