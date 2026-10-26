import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, input, signal } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, of, switchMap } from 'rxjs';
import { OrdersApi } from '../../core/api/store.api';
import { CartStore } from '../../core/cart/cart.store';
import { errorMessage } from '../../core/http/http-utils';
import { OrderDetail } from '../../core/models/api.models';
import { ConfirmService } from '../../core/ui/confirm.service';
import { ToastService } from '../../core/ui/toast.service';
import { Icon } from '../../shared/components/icon';
import { OrderTimeline } from '../../shared/components/order-timeline';
import { EmptyState, ProductImage, StatusBadge } from '../../shared/components/ui';
import { ArsPipe, PaymentPipe } from '../../shared/pipes';

@Component({
  selector: 'app-order-detail-page',
  imports: [RouterLink, DatePipe, Icon, OrderTimeline, EmptyState, ProductImage, StatusBadge, ArsPipe, PaymentPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a routerLink="/cuenta/pedidos" class="mb-4 inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-fg">
      <app-icon name="arrow-left" [size]="15" /> Mis pedidos
    </a>

    @if (loading()) {
      <div class="skeleton h-96"></div>
    } @else if (order(); as o) {
      <div class="grid gap-6 lg:grid-cols-[1fr_340px]">
        <section class="space-y-6">
          <div class="card p-6">
            <div class="mb-6 flex flex-wrap items-center gap-3">
              <h2 class="text-3xl font-extrabold">Pedido #{{ o.id }}</h2>
              <app-status-badge [status]="o.status" />
              <span class="text-sm text-muted">{{ o.createdAt | date: "d 'de' MMMM yyyy, HH:mm" }}</span>
            </div>
            <app-order-timeline [order]="o" />
          </div>

          <div class="card divide-y divide-line">
            @for (item of o.items; track item.productId) {
              <div class="flex items-center gap-4 p-4">
                <app-product-image [src]="item.imageUrl" [alt]="item.productName" class="size-16 rounded-xl border border-line" />
                <div class="min-w-0 flex-1">
                  <a [routerLink]="['/productos', item.productId]" class="font-medium hover:text-brand-600">{{ item.productName }}</a>
                  <p class="text-sm text-muted">{{ item.quantity }} × {{ item.unitPrice | ars }}</p>
                </div>
                <span class="font-semibold">{{ item.subtotal | ars }}</span>
              </div>
            }
          </div>
        </section>

        <aside class="card h-fit space-y-4 p-6">
          <h3 class="text-xl font-bold uppercase">Resumen</h3>
          <dl class="space-y-2 text-sm">
            <div class="flex justify-between"><dt class="text-muted">Medio de pago</dt><dd class="text-right">{{ o.paymentType | payment }}</dd></div>
            <div class="flex justify-between"><dt class="text-muted">Entrega</dt><dd>Retiro en el local</dd></div>
          </dl>
          @if (o.notes) {
            <p class="rounded-xl bg-surface-2 p-3 text-sm"><span class="font-semibold">Notas:</span> {{ o.notes }}</p>
          }
          <div class="flex items-end justify-between border-t border-line pt-4">
            <span class="font-semibold">Total</span><span class="font-display text-4xl font-bold">{{ o.total | ars }}</span>
          </div>
          <button class="btn btn-secondary w-full" (click)="buyAgain(o)"><app-icon name="refresh" [size]="16" /> Volver a comprar</button>
          @if (o.canCancel) {
            <button class="btn w-full text-red-600 hover:bg-red-500/10" (click)="cancel(o)" [disabled]="busy()">
              <app-icon name="ban" [size]="16" /> Cancelar pedido
            </button>
          }
        </aside>
      </div>
    } @else {
      <div class="card"><app-empty-state icon="package-x" title="Pedido no encontrado" /></div>
    }
  `,
})
export class OrderDetailPage {
  private readonly api = inject(OrdersApi);
  private readonly confirm = inject(ConfirmService);
  private readonly toast = inject(ToastService);
  private readonly cart = inject(CartStore);

  readonly id = input.required<string>();
  protected readonly order = signal<OrderDetail | null>(null);
  protected readonly loading = signal(true);
  protected readonly busy = signal(false);

  constructor() {
    toObservable(this.id)
      .pipe(switchMap((id) => this.api.get(Number(id)).pipe(catchError(() => of(null)))))
      .subscribe((order) => {
        this.order.set(order);
        this.loading.set(false);
      });
  }

  protected async cancel(order: OrderDetail): Promise<void> {
    const result = await this.confirm.ask({
      title: `¿Cancelar el pedido #${order.id}?`,
      message: 'Los productos vuelven a quedar disponibles para otros clientes.',
      confirmText: 'Sí, cancelar',
      cancelText: 'Volver',
      danger: true,
      withNote: { label: 'Motivo (opcional)', placeholder: 'Contanos por qué cancelás' },
    });
    if (!result.confirmed) return;

    this.busy.set(true);
    this.api.cancel(order.id, result.note).subscribe({
      next: (updated) => {
        this.order.set(updated);
        this.busy.set(false);
        this.toast.success('Pedido cancelado');
      },
      error: (err) => {
        this.busy.set(false);
        this.toast.error('No se pudo cancelar', errorMessage(err));
      },
    });
  }

  /** Adds every product of the order back to the cart (skipping the ones out of stock). */
  protected async buyAgain(order: OrderDetail): Promise<void> {
    let added = 0;
    for (const item of order.items) {
      if (await this.cart.add(item.productId, item.quantity)) added++;
    }
    if (added > 0) this.cart.drawerOpen.set(true);
  }
}
