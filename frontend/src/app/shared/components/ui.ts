import { ChangeDetectionStrategy, Component, computed, input, model, output, signal } from '@angular/core';
import { AbstractControl } from '@angular/forms';
import { OrderStatus } from '../../core/models/api.models';
import { ORDER_STATUS_LABEL, ORDER_STATUS_STYLE } from '../../core/models/labels';
import { controlErrorMessage } from '../../core/http/http-utils';
import { Icon, IconName } from './icon';

/** Product photo with a graceful placeholder when there is no image or it fails to load. */
@Component({
  selector: 'app-product-image',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'block overflow-hidden bg-white dark:bg-zinc-100' },
  template: `
    @if (src() && !failed()) {
      <img [src]="src()" [alt]="alt()" loading="lazy" decoding="async" (error)="failed.set(true)"
           class="size-full object-contain" [class.p-3]="padded()" />
    } @else {
      <div class="flex size-full flex-col items-center justify-center gap-1 bg-surface-2 text-muted">
        <app-icon name="image-off" [size]="28" />
        <span class="text-[11px]">Sin imagen</span>
      </div>
    }
  `,
})
export class ProductImage {
  readonly src = input<string | null>(null);
  readonly alt = input('');
  readonly padded = input(true);
  protected readonly failed = signal(false);
}

@Component({
  selector: 'app-status-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="badge" [class]="style()"><span class="size-1.5 rounded-full bg-current"></span>{{ label() }}</span>`,
})
export class StatusBadge {
  readonly status = input.required<OrderStatus>();
  protected readonly label = computed(() => ORDER_STATUS_LABEL[this.status()]);
  protected readonly style = computed(() => 'badge ' + ORDER_STATUS_STYLE[this.status()]);
}

@Component({
  selector: 'app-empty-state',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex flex-col items-center justify-center px-6 py-14 text-center">
      <div class="mb-4 grid size-16 place-items-center rounded-2xl bg-brand-500/10 text-brand-600">
        <app-icon [name]="icon()" [size]="30" />
      </div>
      <h3 class="text-2xl font-bold">{{ title() }}</h3>
      @if (message()) {
        <p class="mt-1 max-w-md text-sm text-muted">{{ message() }}</p>
      }
      <div class="mt-5"><ng-content /></div>
    </div>
  `,
})
export class EmptyState {
  readonly icon = input<IconName>('inbox');
  readonly title = input.required<string>();
  readonly message = input<string>();
}

@Component({
  selector: 'app-spinner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'inline-block', role: 'status', 'aria-label': 'Cargando' },
  template: `<span class="block animate-spin rounded-full border-2 border-current border-r-transparent" [style.width.px]="size()" [style.height.px]="size()"></span>`,
})
export class Spinner {
  readonly size = input(18);
}

/** Shows the first validation (or server) error of a form control. */
@Component({
  selector: 'app-field-error',
  changeDetection: ChangeDetectionStrategy.Default,
  template: `@if (message(); as msg) { <p class="field-error">{{ msg }}</p> }`,
})
export class FieldError {
  readonly control = input.required<AbstractControl | null>();
  protected message(): string | null {
    return controlErrorMessage(this.control());
  }
}

@Component({
  selector: 'app-quantity-stepper',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="inline-flex items-center rounded-xl border border-line bg-surface" [class.opacity-60]="disabled()">
      <button type="button" class="grid size-9 place-items-center rounded-l-xl hover:bg-surface-2 disabled:opacity-40"
              [disabled]="disabled() || value() <= min()" (click)="change(-1)" aria-label="Restar uno">
        <app-icon name="minus" [size]="16" />
      </button>
      <span class="w-10 text-center text-sm font-semibold tabular-nums">{{ value() }}</span>
      <button type="button" class="grid size-9 place-items-center rounded-r-xl hover:bg-surface-2 disabled:opacity-40"
              [disabled]="disabled() || value() >= max()" (click)="change(1)" aria-label="Sumar uno">
        <app-icon name="plus" [size]="16" />
      </button>
    </div>
  `,
})
export class QuantityStepper {
  readonly value = model(1);
  readonly min = input(1);
  readonly max = input(99);
  readonly disabled = input(false);
  readonly changed = output<number>();

  protected change(delta: number): void {
    const next = Math.min(this.max(), Math.max(this.min(), this.value() + delta));
    if (next === this.value()) return;
    this.value.set(next);
    this.changed.emit(next);
  }
}

/** Numbered pagination with ellipsis ("1 … 4 5 6 … 12"). */
@Component({
  selector: 'app-pagination',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (totalPages() > 1) {
      <nav class="flex items-center justify-center gap-1" aria-label="Paginación">
        <button class="btn-icon" [disabled]="page() <= 1" (click)="go(page() - 1)" aria-label="Página anterior">
          <app-icon name="chevron-left" />
        </button>
        @for (p of pages(); track $index) {
          @if (p === 0) {
            <span class="px-2 text-muted">…</span>
          } @else {
            <button class="size-10 rounded-xl text-sm font-semibold transition"
                    [class]="p === page() ? 'bg-brand-600 text-white' : 'hover:bg-surface-2'"
                    [attr.aria-current]="p === page() ? 'page' : null" (click)="go(p)">{{ p }}</button>
          }
        }
        <button class="btn-icon" [disabled]="page() >= totalPages()" (click)="go(page() + 1)" aria-label="Página siguiente">
          <app-icon name="chevron-right" />
        </button>
      </nav>
    }
  `,
})
export class Pagination {
  readonly page = input.required<number>();
  readonly totalPages = input.required<number>();
  readonly pageChange = output<number>();

  protected readonly pages = computed(() => {
    const total = this.totalPages();
    const current = this.page();
    const set = new Set([1, total, current - 1, current, current + 1].filter((p) => p >= 1 && p <= total));
    const sorted = [...set].sort((a, b) => a - b);
    const result: number[] = [];
    sorted.forEach((p, i) => {
      if (i > 0 && p - sorted[i - 1] > 1) result.push(0);
      result.push(p);
    });
    return result;
  });

  protected go(p: number): void {
    if (p >= 1 && p <= this.totalPages() && p !== this.page()) this.pageChange.emit(p);
  }
}

/** Generic modal dialog (backdrop + card). Close with Esc, the X or clicking outside. */
@Component({
  selector: 'app-modal',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'closed.emit()' },
  template: `
    <div class="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 backdrop-blur-sm animate-fade-in sm:items-center"
         (click)="closed.emit()">
      <div class="card w-full animate-pop-in" [class]="width()" (click)="$event.stopPropagation()" role="dialog" aria-modal="true">
        <div class="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 class="text-xl font-bold">{{ title() }}</h2>
          <button class="btn-icon size-8" (click)="closed.emit()" aria-label="Cerrar"><app-icon name="x" /></button>
        </div>
        <div class="max-h-[75dvh] overflow-y-auto p-5"><ng-content /></div>
      </div>
    </div>
  `,
})
export class Modal {
  readonly title = input.required<string>();
  readonly width = input('max-w-lg');
  readonly closed = output<void>();
}
