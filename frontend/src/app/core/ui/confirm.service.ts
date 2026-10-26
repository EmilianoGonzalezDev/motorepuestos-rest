import { Injectable, signal } from '@angular/core';

export interface ConfirmOptions {
  title: string;
  message?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
  /** When set, the dialog shows a text area and resolves with its content. */
  withNote?: { label: string; placeholder?: string };
}

export interface ConfirmResult {
  confirmed: boolean;
  note: string | null;
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (result: ConfirmResult) => void;
}

/** Promise-based confirmation dialog (replaces SweetAlert2 from the MVC version). */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  readonly pending = signal<PendingConfirm | null>(null);

  ask(options: ConfirmOptions): Promise<ConfirmResult> {
    this.pending()?.resolve({ confirmed: false, note: null });
    return new Promise((resolve) => this.pending.set({ ...options, resolve }));
  }

  async confirm(options: ConfirmOptions): Promise<boolean> {
    return (await this.ask(options)).confirmed;
  }

  close(result: ConfirmResult): void {
    const current = this.pending();
    this.pending.set(null);
    current?.resolve(result);
  }
}
