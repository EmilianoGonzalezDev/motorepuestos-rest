import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { CatalogApi } from '../../core/api/store.api';
import { Icon, IconName } from '../../shared/components/icon';
import { ProductCard, ProductCardSkeleton } from '../../shared/components/product-card';

/** Visual hint per category (falls back to a wrench). */
const CATEGORY_ICON: Record<string, IconName> = {
  Motor: 'gauge', Transmisión: 'settings', Frenos: 'ban', Suspensión: 'arrow-up-down', Dirección: 'bike',
  'Sistema Eléctrico': 'zap', Baterías: 'zap', Iluminación: 'sparkles', Escapes: 'wrench', Filtros: 'filter',
  Aceites: 'package', Neumáticos: 'circle-user', Llantas: 'circle-check', Carenado: 'shield', Espejos: 'eye',
  Cascos: 'shield', Indumentaria: 'user', Baúles: 'boxes', Seguridad: 'lock',
};

@Component({
  selector: 'app-home-page',
  imports: [RouterLink, Icon, ProductCard, ProductCardSkeleton],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <!-- Hero -->
    <section class="relative overflow-hidden bg-zinc-950 text-white">
      <div class="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,var(--color-brand-600)_0%,transparent_55%)] opacity-60"></div>
      <div class="absolute -right-24 -bottom-24 size-[28rem] rounded-full border-[40px] border-white/5"></div>
      <div class="absolute -right-6 -bottom-6 size-64 rounded-full border-[24px] border-brand-500/20"></div>
      <div class="container-page relative grid gap-10 py-16 md:grid-cols-2 md:py-24">
        <div class="animate-pop-in">
          <span class="badge bg-white/10 text-brand-300 ring-1 ring-white/15"><app-icon name="zap" [size]="14" /> Nuevos ingresos todas las semanas</span>
          <h1 class="mt-5 text-5xl leading-[0.95] font-extrabold uppercase sm:text-6xl lg:text-7xl">
            Todo para que tu moto <span class="text-brand-500">siga rodando</span>
          </h1>
          <p class="mt-5 max-w-lg text-lg text-zinc-300">
            Repuestos originales y alternativos, cascos e indumentaria. Comprá online y retirá en el local.
          </p>
          <div class="mt-8 flex flex-wrap gap-3">
            <a routerLink="/productos" class="btn btn-primary px-6 py-3 text-base">Ver catálogo <app-icon name="arrow-right" /></a>
            <a routerLink="/productos" [queryParams]="{ q: 'casco' }" class="btn border border-white/20 px-6 py-3 text-base text-white hover:bg-white/10">Cascos</a>
          </div>
        </div>
        <div class="hidden grid-cols-2 gap-4 self-center md:grid">
          @for (b of benefits; track b.title) {
            <div class="rounded-2xl border border-white/10 bg-white/5 p-5 backdrop-blur">
              <app-icon [name]="b.icon" [size]="26" class="text-brand-400" />
              <p class="mt-3 font-semibold">{{ b.title }}</p>
              <p class="text-sm text-zinc-400">{{ b.text }}</p>
            </div>
          }
        </div>
      </div>
    </section>

    <!-- Categories -->
    <section class="container-page py-12">
      <div class="mb-6 flex items-end justify-between">
        <div>
          <h2 class="text-3xl font-bold uppercase">Categorías</h2>
          <p class="text-muted">Encontrá rápido lo que necesitás</p>
        </div>
        <a routerLink="/productos" class="text-sm font-semibold text-brand-600 hover:underline">Ver todo</a>
      </div>
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        @for (c of categories(); track c.id) {
          <a [routerLink]="['/productos']" [queryParams]="{ categoria: c.id }"
             class="card group flex items-center gap-3 p-4 transition hover:-translate-y-0.5 hover:border-brand-500/50">
            <span class="grid size-10 shrink-0 place-items-center rounded-xl bg-brand-500/10 text-brand-600 transition group-hover:bg-brand-600 group-hover:text-white">
              <app-icon [name]="iconFor(c.name)" [size]="20" />
            </span>
            <span class="min-w-0">
              <span class="block truncate text-sm font-semibold">{{ c.name }}</span>
              <span class="text-xs text-muted">{{ c.productCount }} producto{{ c.productCount === 1 ? '' : 's' }}</span>
            </span>
          </a>
        } @empty {
          @for (i of placeholders; track i) { <div class="skeleton h-[74px]"></div> }
        }
      </div>
    </section>

    <!-- Newest products -->
    <section class="container-page pb-6">
      <div class="mb-6 flex items-end justify-between">
        <div>
          <h2 class="text-3xl font-bold uppercase">Recién llegados</h2>
          <p class="text-muted">Lo último que sumamos al catálogo</p>
        </div>
        <a routerLink="/productos" class="btn btn-secondary btn-sm">Ver catálogo <app-icon name="arrow-right" [size]="14" /></a>
      </div>
      <div class="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        @if (newest(); as products) {
          @for (p of products; track p.id) { <app-product-card [product]="p" /> }
        } @else {
          @for (i of placeholders.slice(0, 8); track i) { <app-product-card-skeleton /> }
        }
      </div>
    </section>

    <!-- Benefits (mobile) -->
    <section class="container-page grid grid-cols-2 gap-3 pt-8 md:hidden">
      @for (b of benefits; track b.title) {
        <div class="card p-4">
          <app-icon [name]="b.icon" [size]="22" class="text-brand-600" />
          <p class="mt-2 text-sm font-semibold">{{ b.title }}</p>
        </div>
      }
    </section>
  `,
})
export class HomePage {
  private readonly api = inject(CatalogApi);

  protected readonly categories = toSignal(this.api.categories().pipe(catchError(() => of([]))), { initialValue: [] });
  protected readonly newest = toSignal(
    this.api.products({ pageSize: 8, sort: 'Newest' }).pipe(
      map((page) => page.items),
      catchError(() => of([])),
    ),
  );

  protected readonly placeholders = Array.from({ length: 12 }, (_, i) => i);
  protected readonly benefits: { icon: IconName; title: string; text: string }[] = [
    { icon: 'store', title: 'Retiro en el local', text: 'Comprá online y retirá sin esperas.' },
    { icon: 'credit-card', title: 'Pagá como quieras', text: 'Tarjeta, transferencia o en el local.' },
    { icon: 'shield', title: 'Compra segura', text: 'Tus datos siempre protegidos.' },
    { icon: 'headset', title: 'Asesoramiento', text: 'Te ayudamos a elegir el repuesto.' },
  ];

  protected iconFor(name: string): IconName {
    return CATEGORY_ICON[name] ?? 'wrench';
  }
}
