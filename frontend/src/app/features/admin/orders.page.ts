import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { catchError, debounceTime, map, of, startWith, switchMap } from 'rxjs';
import { AdminApi, AdminOrdersQuery } from '../../core/api/admin.api';
import { errorMessage } from '../../core/http/http-utils';
import { OrderDetail, OrderStatus, OrderSummary, Paged } from '../../core/models/api.models';
import { ORDER_STATUSES, ORDER_STATUS_LABEL } from '../../core/models/labels';
import { ConfirmService } from '../../core/ui/confirm.service';
import { ToastService } from '../../core/ui/toast.service';
import { Icon } from '../../shared/components/icon';
import { OrderTimeline } from '../../shared/components/order-timeline';
import { EmptyState, Modal, Pagination, ProductImage, Spinner, StatusBadge } from '../../shared/components/ui';
import { ArsPipe, PaymentPipe } from '../../shared/pipes';

const DEFAULT_STATUSES: OrderStatus[] = ['Pending', 'Prepared'];

@Component({
  selector: 'app-admin-orders-page',
  imports: [DatePipe, FormsModule, Icon, Modal, OrderTimeline, EmptyState, Pagination, ProductImage, Spinner, StatusBadge, ArsPipe, PaymentPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div><h1 class="text-4xl font-extrabold uppercase">Pedidos</h1><p class="text-sm text-muted">Seguimiento y cambio de estado</p></div>
      <button class="btn btn-secondary" (click)="exportCsv()" [disabled]="exporting()">
        @if (exporting()) { <app-spinner [size]="15" /> } @else { <app-icon name="download" [size]="16" /> } Exportar CSV
      </button>
    </div>

    <!-- Filters -->
    <div class="card mb-5 space-y-4 p-4">
      <div class="flex flex-wrap gap-2">
        @for (s of allStatuses; track s) {
          <button class="chip" [class.chip-active]="statuses().includes(s)" (click)="toggleStatus(s)">
            <span class="size-2 rounded-full" [class]="dot[s]"></span> {{ labels[s] }}
          </button>
        }
      </div>
      <div class="grid gap-3 sm:grid-cols-[1fr_auto_auto]">
        <div class="relative">
          <app-icon name="search" class="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" />
          <input class="input pl-10" placeholder="Buscar por N° de pedido, cliente o email" [ngModel]="search()" (ngModelChange)="search.set($event); page.set(1)" />
        </div>
        <label class="flex items-center gap-2 text-sm text-muted">Desde
          <input type="date" class="input w-auto" [ngModel]="from()" (ngModelChange)="from.set($event); page.set(1)" /></label>
        <label class="flex items-center gap-2 text-sm text-muted">Hasta
          <input type="date" class="input w-auto" [ngModel]="to()" (ngModelChange)="to.set($event); page.set(1)" /></label>
      </div>
    </div>

    @if (result(); as r) {
      @if (r === 'error') {
        <div class="card"><app-empty-state icon="circle-alert" title="No pudimos cargar los pedidos" /></div>
      } @else if (r.items.length === 0) {
        <div class="card"><app-empty-state icon="clipboard" title="No hay pedidos" message="Probá cambiando los filtros." /></div>
      } @else {
        <div class="card overflow-x-auto">
          <table class="table-base min-w-[760px]">
            <thead><tr><th>Pedido</th><th>Cliente</th><th>Fecha</th><th>Pago</th><th>Estado</th><th class="text-right">Total</th><th></th></tr></thead>
            <tbody>
              @for (o of r.items; track o.id) {
                <tr class="cursor-pointer transition hover:bg-surface-2/60" (click)="open(o.id)">
                  <td class="font-display text-lg font-bold">#{{ o.id }}</td>
                  <td><p class="font-medium">{{ o.customer.fullName }}</p><p class="text-xs text-muted">{{ o.customer.email }}</p></td>
                  <td class="text-muted">{{ o.createdAt | date: 'dd/MM/yy HH:mm' }}</td>
                  <td class="text-muted">{{ o.paymentType | payment }}</td>
                  <td><app-status-badge [status]="o.status" /></td>
                  <td class="text-right font-semibold">{{ o.total | ars }}</td>
                  <td class="text-right text-muted"><app-icon name="chevron-right" [size]="16" /></td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <p class="mt-3 text-center text-xs text-muted">{{ r.totalItems }} pedido{{ r.totalItems === 1 ? '' : 's' }}</p>
        <div class="mt-4"><app-pagination [page]="r.page" [totalPages]="r.totalPages" (pageChange)="page.set($event)" /></div>
      }
    } @else {
      <div class="space-y-2">@for (i of [1, 2, 3, 4, 5]; track i) { <div class="skeleton h-14"></div> }</div>
    }

    <!-- Detail modal -->
    @if (selected(); as o) {
      <app-modal [title]="'Pedido #' + o.id" width="max-w-3xl" (closed)="selected.set(null)">
        <div class="grid gap-6 md:grid-cols-[1fr_260px]">
          <div class="space-y-5">
            <div class="flex flex-wrap items-center gap-3">
              <app-status-badge [status]="o.status" />
              <span class="text-sm text-muted">{{ o.createdAt | date: "d 'de' MMMM yyyy, HH:mm" }}</span>
            </div>
            <ul class="divide-y divide-line rounded-xl border border-line">
              @for (item of o.items; track item.productId) {
                <li class="flex items-center gap-3 p-3">
                  <app-product-image [src]="item.imageUrl" [alt]="item.productName" [padded]="false" class="size-12 rounded-lg border border-line" />
                  <span class="min-w-0 flex-1"><span class="line-clamp-1 text-sm font-medium">{{ item.productName }}</span>
                    <span class="text-xs text-muted">{{ item.quantity }} × {{ item.unitPrice | ars }}</span></span>
                  <span class="text-sm font-semibold">{{ item.subtotal | ars }}</span>
                </li>
              }
            </ul>
            <app-order-timeline [order]="o" />
          </div>

          <aside class="space-y-4 text-sm">
            <div class="rounded-xl bg-surface-2 p-4">
              <p class="font-semibold">{{ o.customer.fullName }}</p>
              <p class="text-muted">{{ o.customer.email }}</p>
              <p class="mt-2 text-muted">Pago: {{ o.paymentType | payment }}</p>
              @if (o.notes) { <p class="mt-2"><span class="font-semibold">Notas:</span> {{ o.notes }}</p> }
            </div>
            <div class="flex items-end justify-between"><span class="font-semibold">Total</span><span class="font-display text-3xl font-bold">{{ o.total | ars }}</span></div>

            @if (o.allowedNextStatuses.length) {
              <div class="space-y-2 border-t border-line pt-4">
                <p class="text-xs font-semibold tracking-wide text-muted uppercase">Cambiar estado</p>
                @for (next of o.allowedNextStatuses; track next) {
                  <button class="btn w-full" [class]="next === 'Cancelled' ? 'btn-danger' : next === 'Pending' ? 'btn-secondary' : 'btn-primary'"
                          [disabled]="busy()" (click)="changeStatus(o, next)">
                    @if (busy()) { <app-spinner [size]="14" /> } {{ actionLabel(next) }}
                  </button>
                }
              </div>
            } @else {
              <p class="border-t border-line pt-4 text-xs text-muted">Estado final: el pedido no admite más cambios.</p>
            }
          </aside>
        </div>
      </app-modal>
    }
  `,
  styles: `
    .chip { display: inline-flex; align-items: center; gap: 0.45rem; border-radius: 9999px; border: 1px solid var(--color-line); padding: 0.35rem 0.9rem; font-size: 0.8rem; font-weight: 600; color: var(--color-muted); }
    .chip:hover { background: var(--color-surface-2); }
    .chip-active { background: var(--color-surface-2); color: var(--color-fg); border-color: var(--color-fg); }
  `,
})
export class AdminOrdersPage {
  private readonly api = inject(AdminApi);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  /** Optional ?q= (order number) coming from the dashboard links. */
  readonly q = input<string>();

  protected readonly allStatuses = ORDER_STATUSES;
  protected readonly labels = ORDER_STATUS_LABEL;
  protected readonly dot: Record<OrderStatus, string> = { Pending: 'bg-amber-500', Prepared: 'bg-sky-500', Delivered: 'bg-emerald-500', Cancelled: 'bg-zinc-400' };

  protected readonly statuses = signal<OrderStatus[]>(DEFAULT_STATUSES);
  protected readonly search = signal('');
  protected readonly from = signal('');
  protected readonly to = signal('');
  protected readonly page = signal(1);
  protected readonly selected = signal<OrderDetail | null>(null);
  protected readonly busy = signal(false);
  protected readonly exporting = signal(false);
  private readonly reload = signal(0);

  private readonly query = computed<AdminOrdersQuery>(() => ({
    page: this.page(),
    pageSize: 10,
    statuses: this.statuses(),
    search: (this.search() || this.q() || '').trim() || null,
    from: this.from() || null,
    to: this.to() || null,
  }));

  protected readonly result = toSignal(
    toObservable(computed(() => ({ query: this.query(), reload: this.reload() }))).pipe(
      debounceTime(250),
      switchMap(({ query }) =>
        this.api.orders(query).pipe(
          map((p): Paged<OrderSummary> | 'error' => p),
          catchError(() => of('error' as const)),
          startWith(undefined),
        ),
      ),
    ),
  );

  constructor() {
    if (this.q()) this.statuses.set([...ORDER_STATUSES]);
  }

  protected toggleStatus(status: OrderStatus): void {
    this.statuses.update((list) => (list.includes(status) ? list.filter((s) => s !== status) : [...list, status]));
    this.page.set(1);
  }

  protected open(id: number): void {
    this.api.order(id).subscribe({
      next: (order) => this.selected.set(order),
      error: (err) => this.toast.error('No se pudo abrir el pedido', errorMessage(err)),
    });
  }

  protected actionLabel(next: OrderStatus): string {
    return { Pending: 'Volver a pendiente', Prepared: 'Marcar como preparado', Delivered: 'Marcar como entregado', Cancelled: 'Cancelar pedido' }[next];
  }

  protected async changeStatus(order: OrderDetail, next: OrderStatus): Promise<void> {
    const cancelling = next === 'Cancelled';
    const result = await this.confirm.ask({
      title: cancelling ? `¿Cancelar el pedido #${order.id}?` : `Pasar el pedido #${order.id} a "${ORDER_STATUS_LABEL[next]}"`,
      message: cancelling ? 'El stock de los productos se repone automáticamente.' : undefined,
      confirmText: cancelling ? 'Cancelar pedido' : 'Confirmar',
      danger: cancelling,
      withNote: { label: 'Nota para el historial (opcional)' },
    });
    if (!result.confirmed) return;

    this.busy.set(true);
    this.api.changeOrderStatus(order.id, next, result.note).subscribe({
      next: (updated) => {
        this.selected.set(updated);
        this.busy.set(false);
        this.reload.update((n) => n + 1);
        this.toast.success(`Pedido #${order.id}: ${ORDER_STATUS_LABEL[next]}`);
      },
      error: (err) => {
        this.busy.set(false);
        this.toast.error('No se pudo cambiar el estado', errorMessage(err));
        this.open(order.id);
      },
    });
  }

  protected exportCsv(): void {
    this.exporting.set(true);
    const { page: _page, pageSize: _size, ...filters } = this.query();
    this.api.exportOrders(filters).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pedidos_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        this.exporting.set(false);
      },
      error: () => {
        this.exporting.set(false);
        this.toast.error('No se pudo exportar');
      },
    });
  }
}
