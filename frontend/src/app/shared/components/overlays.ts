import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ConfirmService } from '../../core/ui/confirm.service';
import { ToastKind, ToastService } from '../../core/ui/toast.service';
import { Icon, IconName } from './icon';

const TOAST_ICON: Record<ToastKind, IconName> = {
  success: 'circle-check',
  error: 'circle-x',
  info: 'info',
  warning: 'alert',
};

const TOAST_COLOR: Record<ToastKind, string> = {
  success: 'text-emerald-500',
  error: 'text-red-500',
  info: 'text-sky-500',
  warning: 'text-amber-500',
};

@Component({
  selector: 'app-toast-host',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4 sm:inset-x-auto sm:right-4 sm:items-end"
         aria-live="polite">
      @for (toast of toasts.toasts(); track toast.id) {
        <div class="card pointer-events-auto flex w-full max-w-sm items-start gap-3 p-4 shadow-pop animate-pop-in">
          <app-icon [name]="icon[toast.kind]" [size]="20" [class]="color[toast.kind]" />
          <div class="min-w-0 flex-1">
            <p class="text-sm font-semibold">{{ toast.title }}</p>
            @if (toast.message) {
              <p class="mt-0.5 line-clamp-2 text-sm text-muted">{{ toast.message }}</p>
            }
            @if (toast.action; as action) {
              <button class="mt-2 text-sm font-semibold text-brand-600 hover:underline"
                      (click)="action.run(); toasts.dismiss(toast.id)">{{ action.label }}</button>
            }
          </div>
          <button class="text-muted hover:text-fg" (click)="toasts.dismiss(toast.id)" aria-label="Cerrar">
            <app-icon name="x" [size]="16" />
          </button>
        </div>
      }
    </div>
  `,
})
export class ToastHost {
  protected readonly toasts = inject(ToastService);
  protected readonly icon = TOAST_ICON;
  protected readonly color = TOAST_COLOR;
}

@Component({
  selector: 'app-confirm-dialog',
  imports: [Icon, FormsModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'cancel()' },
  template: `
    @if (confirm.pending(); as dialog) {
      <div class="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-fade-in"
           (click)="cancel()">
        <div class="card w-full max-w-md p-6 animate-pop-in" (click)="$event.stopPropagation()" role="alertdialog" aria-modal="true">
          <div class="flex gap-4">
            <div class="grid size-11 shrink-0 place-items-center rounded-full"
                 [class]="dialog.danger ? 'bg-red-500/10 text-red-600' : 'bg-brand-500/10 text-brand-600'">
              <app-icon [name]="dialog.danger ? 'alert' : 'info'" [size]="22" />
            </div>
            <div class="flex-1">
              <h2 class="text-xl font-bold">{{ dialog.title }}</h2>
              @if (dialog.message) {
                <p class="mt-1 text-sm text-muted">{{ dialog.message }}</p>
              }
              @if (dialog.withNote; as noteCfg) {
                <label class="label mt-4">{{ noteCfg.label }}</label>
                <textarea class="input min-h-20" [placeholder]="noteCfg.placeholder ?? ''" maxlength="500"
                          [(ngModel)]="note"></textarea>
              }
            </div>
          </div>
          <div class="mt-6 flex justify-end gap-2">
            <button class="btn btn-secondary" (click)="cancel()">{{ dialog.cancelText ?? 'Cancelar' }}</button>
            <button class="btn" [class]="dialog.danger ? 'btn-danger' : 'btn-primary'" (click)="accept()">
              {{ dialog.confirmText ?? 'Confirmar' }}
            </button>
          </div>
        </div>
      </div>
    }
  `,
})
export class ConfirmDialog {
  protected readonly confirm = inject(ConfirmService);
  protected note = '';
  protected readonly open = signal(false);

  constructor() {
    effect(() => {
      if (this.confirm.pending()) this.note = '';
    });
  }

  protected cancel(): void {
    if (this.confirm.pending()) this.confirm.close({ confirmed: false, note: null });
  }

  protected accept(): void {
    this.confirm.close({ confirmed: true, note: this.note.trim() || null });
  }
}
