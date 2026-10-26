import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, map, of, startWith, switchMap } from 'rxjs';
import { OrdersApi } from '../../core/api/store.api';
import { OrderStatus, OrderSummary, Paged } from '../../core/models/api.models';
import { ORDER_STATUSES } from '../../core/models/labels';
import { Icon } from '../../shared/components/icon';
import { EmptyState, Pagination, ProductImage, StatusBadge } from '../../shared/components/ui';
import { ArsPipe, OrderStatusPipe, PaymentPipe } from '../../shared/pipes';

@Component({
  selector: 'app-my-orders-page',
  imports: [RouterLink, DatePipe, Icon, EmptyState, Pagination, ProductImage, StatusBadge, ArsPipe, OrderStatusPipe, PaymentPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-5 flex flex-wrap gap-2">
      <button class="chip" [class.chip-active]="!status()" (click)="setStatus(null)">Todos</button>
      @for (s of statuses; track s) {
        <button class="chip" [class.chip-active]="status() === s" (click)="setStatus(s)">{{ s | orderStatus }}</button>
      }
    </div>

    @if (result(); as page) {
      @if (page === 'error') {
        <app-empty-state icon="circle-alert" title="No pudimos cargar tus pedidos" />
      } @else if (page.items.length === 0) {
        <div class="card">
          <app-empty-state icon="package" title="Todavía no hay pedidos" message="Cuando compres algo lo vas a ver acá.">
            <a routerLink="/productos" class="btn btn-primary">Ir al catálogo</a>
          </app-empty-state>
        </div>
      } @else {
        <div class="space-y-4">
          @for (order of page.items; track order.id) {
            <a [routerLink]="['/cuenta/pedidos', order.id]" class="card block p-5 transition hover:border-brand-500/40 hover:shadow-pop">
              <div class="flex flex-wrap items-center gap-x-4 gap-y-2">
                <span class="font-display text-2xl font-bold">#{{ order.id }}</span>
                <app-status-badge [status]="order.status" />
                <span class="text-sm text-muted">{{ order.createdAt | date: "d 'de' MMMM yyyy, HH:mm" }}</span>
                <span class="ml-auto font-display text-2xl font-bold">{{ order.total | ars }}</span>
              </div>
              <div class="mt-4 flex items-center gap-3">
                <div class="flex -space-x-3">
                  @for (item of order.items.slice(0, 4); track item.productId) {
                    <app-product-image [src]="item.imageUrl" [alt]="item.productName" [padded]="false"
                                       class="size-12 rounded-xl border-2 border-surface" />
                  }
                </div>
                <p class="min-w-0 flex-1 truncate text-sm text-muted">
                  {{ order.itemCount }} unidad{{ order.itemCount === 1 ? '' : 'es' }} · {{ order.paymentType | payment }} ·
                  {{ itemNames(order) }}
                </p>
                <app-icon name="chevron-right" class="text-muted" />
              </div>
            </a>
          }
        </div>
        <div class="mt-8"><app-pagination [page]="page.page" [totalPages]="page.totalPages" (pageChange)="pageNumber.set($event)" /></div>
      }
    } @else {
      <div class="space-y-4">@for (i of [1, 2, 3]; track i) { <div class="skeleton h-32"></div> }</div>
    }
  `,
  styles: `
    .chip { border-radius: 9999px; border: 1px solid var(--color-line); padding: 0.35rem 0.9rem; font-size: 0.8rem; font-weight: 600; }
    .chip:hover { background: var(--color-surface-2); }
    .chip-active { background: var(--color-fg); color: var(--color-bg); border-color: var(--color-fg); }
    .chip-active:hover { background: var(--color-fg); }
  `,
})
export class MyOrdersPage {
  private readonly api = inject(OrdersApi);
  protected readonly statuses = ORDER_STATUSES;
  protected readonly status = signal<OrderStatus | null>(null);
  protected readonly pageNumber = signal(1);
  private readonly query = computed(() => ({ page: this.pageNumber(), status: this.status() }));

  protected readonly result = toSignal(
    toObservable(this.query).pipe(
      switchMap((q) =>
        this.api.mine(q.page, 5, q.status).pipe(
          map((page): Paged<OrderSummary> | 'error' => page),
          catchError(() => of('error' as const)),
          startWith(undefined),
        ),
      ),
    ),
  );

  protected setStatus(status: OrderStatus | null): void {
    this.status.set(status);
    this.pageNumber.set(1);
  }

  protected itemNames(order: OrderSummary): string {
    return order.items.map((i) => i.productName).join(', ');
  }
}
