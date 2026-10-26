import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, of, startWith, switchMap } from 'rxjs';
import { AdminApi } from '../../core/api/admin.api';
import { Dashboard } from '../../core/models/api.models';
import { ORDER_STATUS_COLOR, ORDER_STATUS_LABEL } from '../../core/models/labels';
import { BarChart, BarDatum, DonutChart, DonutSlice } from '../../shared/components/charts';
import { Icon, IconName } from '../../shared/components/icon';
import { EmptyState, ProductImage, StatusBadge } from '../../shared/components/ui';
import { ArsPipe } from '../../shared/pipes';

const ars = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 });
const shortDate = new Intl.DateTimeFormat('es-AR', { day: '2-digit', month: 'short' });

@Component({
  selector: 'app-dashboard-page',
  imports: [RouterLink, DatePipe, Icon, BarChart, DonutChart, EmptyState, ProductImage, StatusBadge, ArsPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 class="text-4xl font-extrabold uppercase">Dashboard</h1>
        <p class="text-sm text-muted">Resumen de la actividad de la tienda</p>
      </div>
      <div class="inline-flex rounded-xl border border-line bg-surface p-1">
        @for (d of ranges; track d) {
          <button class="rounded-lg px-3 py-1.5 text-sm font-semibold transition" [class]="days() === d ? 'bg-brand-600 text-white' : 'text-muted hover:text-fg'"
                  (click)="days.set(d)">{{ d }} días</button>
        }
      </div>
    </div>

    @if (data(); as d) {
      @if (d === 'error') {
        <div class="card"><app-empty-state icon="circle-alert" title="No pudimos cargar el dashboard" /></div>
      } @else {
        <!-- KPIs -->
        <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          @for (k of kpis(); track k.label) {
            <div class="card p-5">
              <div class="flex items-center justify-between">
                <span class="text-sm font-medium text-muted">{{ k.label }}</span>
                <span class="grid size-9 place-items-center rounded-xl" [class]="k.tone"><app-icon [name]="k.icon" [size]="18" /></span>
              </div>
              <p class="mt-3 font-display text-4xl font-bold">{{ k.value }}</p>
              @if (k.delta !== null) {
                <p class="mt-1 flex items-center gap-1 text-xs font-semibold" [class]="k.delta >= 0 ? 'text-emerald-600' : 'text-red-600'">
                  <app-icon [name]="k.delta >= 0 ? 'trending-up' : 'trending-down'" [size]="14" />
                  {{ k.delta >= 0 ? '+' : '' }}{{ k.delta }}% vs. mismo período del mes anterior
                </p>
              } @else if (k.sub) {
                <p class="mt-1 text-xs text-muted">{{ k.sub }}</p>
              }
            </div>
          }
        </div>

        <div class="mt-6 grid gap-6 xl:grid-cols-3">
          <section class="card p-5 xl:col-span-2">
            <h2 class="mb-4 text-xl font-bold uppercase">Ventas por día</h2>
            <app-bar-chart [data]="salesBars()" [format]="formatArs" ariaLabel="Ventas por día" />
          </section>
          <section class="card p-5">
            <h2 class="mb-4 text-xl font-bold uppercase">Pedidos por estado</h2>
            <app-donut-chart [data]="statusSlices()" />
          </section>
        </div>

        <div class="mt-6 grid gap-6 xl:grid-cols-3">
          <section class="card p-5">
            <h2 class="mb-4 text-xl font-bold uppercase">Más vendidos</h2>
            @if (d.topProducts.length === 0) {
              <p class="py-6 text-center text-sm text-muted">Sin ventas en el período.</p>
            }
            <ol class="space-y-3">
              @for (p of d.topProducts; track p.productId; let i = $index) {
                <li class="flex items-center gap-3">
                  <span class="grid size-7 place-items-center rounded-full bg-brand-500/10 text-xs font-bold text-brand-700 dark:text-brand-300">{{ i + 1 }}</span>
                  <a [routerLink]="['/productos', p.productId]" class="line-clamp-1 flex-1 text-sm font-medium hover:text-brand-600">{{ p.name }}</a>
                  <span class="text-right text-xs text-muted">{{ p.quantity }} u.<br /><span class="font-semibold text-fg">{{ p.revenue | ars }}</span></span>
                </li>
              }
            </ol>
          </section>

          <section class="card p-5">
            <div class="mb-4 flex items-center justify-between">
              <h2 class="text-xl font-bold uppercase">Stock bajo</h2>
              <a routerLink="/admin/productos" [queryParams]="{ stockBajo: 1 }" class="text-sm font-semibold text-brand-600 hover:underline">Ver todos</a>
            </div>
            @if (d.lowStock.length === 0) {
              <p class="py-6 text-center text-sm text-muted">Todo el stock está en orden 🎉</p>
            }
            <ul class="space-y-3">
              @for (p of d.lowStock; track p.id) {
                <li class="flex items-center gap-3">
                  <app-product-image [src]="p.imageUrl" [alt]="p.name" [padded]="false" class="size-10 rounded-lg border border-line" />
                  <a [routerLink]="['/admin/productos', p.id]" class="line-clamp-1 flex-1 text-sm font-medium hover:text-brand-600">{{ p.name }}</a>
                  <span class="badge" [class]="p.stock === 0 ? 'bg-red-500/15 text-red-700 dark:text-red-300' : 'bg-amber-500/15 text-amber-700 dark:text-amber-300'">
                    {{ p.stock === 0 ? 'Agotado' : p.stock + ' u.' }}
                  </span>
                </li>
              }
            </ul>
          </section>

          <section class="card p-5">
            <div class="mb-4 flex items-center justify-between">
              <h2 class="text-xl font-bold uppercase">Últimos pedidos</h2>
              <a routerLink="/admin/pedidos" class="text-sm font-semibold text-brand-600 hover:underline">Ver todos</a>
            </div>
            <ul class="space-y-3">
              @for (o of d.recentOrders; track o.id) {
                <li>
                  <a [routerLink]="['/admin/pedidos']" [queryParams]="{ q: o.id }" class="flex items-center gap-3 rounded-xl p-1 transition hover:bg-surface-2">
                    <span class="font-display text-lg font-bold">#{{ o.id }}</span>
                    <span class="min-w-0 flex-1">
                      <span class="block truncate text-sm font-medium">{{ o.customerName }}</span>
                      <span class="text-xs text-muted">{{ o.createdAt | date: 'dd/MM HH:mm' }}</span>
                    </span>
                    <span class="text-right"><span class="block text-sm font-semibold">{{ o.total | ars }}</span><app-status-badge [status]="o.status" /></span>
                  </a>
                </li>
              }
            </ul>
          </section>
        </div>
      }
    } @else {
      <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">@for (i of [1, 2, 3, 4]; track i) { <div class="skeleton h-32"></div> }</div>
      <div class="skeleton mt-6 h-72"></div>
    }
  `,
})
export class DashboardPage {
  private readonly api = inject(AdminApi);

  protected readonly ranges = [7, 30, 90];
  protected readonly days = signal(30);
  protected readonly formatArs = (v: number) => ars.format(v);

  protected readonly data = toSignal(
    toObservable(this.days).pipe(
      switchMap((days) =>
        this.api.dashboard(days).pipe(
          catchError(() => of('error' as const)),
          startWith(undefined),
        ),
      ),
    ),
  );

  private readonly dashboard = computed(() => {
    const d = this.data();
    return d && d !== 'error' ? (d as Dashboard) : null;
  });

  protected readonly kpis = computed(() => {
    const d = this.dashboard();
    if (!d) return [];
    const k = d.kpis;
    const delta = k.revenuePreviousMonth > 0 ? Math.round(((k.revenueThisMonth - k.revenuePreviousMonth) / k.revenuePreviousMonth) * 100) : null;
    const items: { label: string; value: string; icon: IconName; tone: string; delta: number | null; sub?: string }[] = [
      { label: 'Ventas del mes', value: ars.format(k.revenueThisMonth), icon: 'wallet', tone: 'bg-emerald-500/10 text-emerald-600', delta },
      { label: 'Pedidos del mes', value: String(k.ordersThisMonth), icon: 'receipt', tone: 'bg-sky-500/10 text-sky-600', delta: null, sub: `Ticket promedio ${ars.format(k.averageTicket)}` },
      { label: 'Por atender', value: String(k.pendingOrders + k.preparedOrders), icon: 'clock', tone: 'bg-amber-500/10 text-amber-600', delta: null, sub: `${k.pendingOrders} pendientes · ${k.preparedOrders} preparados` },
      { label: 'Stock bajo', value: String(k.lowStockProducts), icon: 'alert', tone: 'bg-red-500/10 text-red-600', delta: null, sub: `de ${k.activeProducts} productos activos` },
    ];
    return items;
  });

  protected readonly salesBars = computed<BarDatum[]>(() =>
    (this.dashboard()?.salesByDay ?? []).map((s) => ({
      label: shortDate.format(new Date(s.date + 'T12:00:00')),
      value: s.revenue,
      hint: `${shortDate.format(new Date(s.date + 'T12:00:00'))} · ${s.orders} pedido${s.orders === 1 ? '' : 's'}`,
    })),
  );

  protected readonly statusSlices = computed<DonutSlice[]>(() =>
    (this.dashboard()?.ordersByStatus ?? []).map((s) => ({ label: ORDER_STATUS_LABEL[s.status], value: s.count, color: ORDER_STATUS_COLOR[s.status] })),
  );
}
