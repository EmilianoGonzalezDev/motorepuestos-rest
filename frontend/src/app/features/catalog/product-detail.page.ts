import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { Title } from '@angular/platform-browser';
import { RouterLink } from '@angular/router';
import { catchError, map, of, startWith, switchMap } from 'rxjs';
import { CatalogApi } from '../../core/api/store.api';
import { CartStore } from '../../core/cart/cart.store';
import { FavoritesStore } from '../../core/favorites/favorites.store';
import { ProductDetail } from '../../core/models/api.models';
import { Icon } from '../../shared/components/icon';
import { ProductCard } from '../../shared/components/product-card';
import { EmptyState, ProductImage, QuantityStepper, Spinner } from '../../shared/components/ui';
import { ArsPipe } from '../../shared/pipes';

type DetailState = { status: 'loading' } | { status: 'error' } | { status: 'ok'; product: ProductDetail };

@Component({
  selector: 'app-product-detail-page',
  imports: [RouterLink, Icon, ProductCard, EmptyState, ProductImage, QuantityStepper, Spinner, ArsPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container-page py-8">
      @switch (state().status) {
        @case ('loading') {
          <div class="grid gap-10 md:grid-cols-2">
            <div class="skeleton aspect-square rounded-3xl"></div>
            <div class="space-y-4"><div class="skeleton h-4 w-24"></div><div class="skeleton h-10 w-3/4"></div><div class="skeleton h-12 w-40"></div><div class="skeleton h-40 w-full"></div></div>
          </div>
        }
        @case ('error') {
          <div class="card">
            <app-empty-state icon="package-x" title="Producto no disponible" message="El producto no existe o fue dado de baja.">
              <a routerLink="/productos" class="btn btn-primary">Volver al catálogo</a>
            </app-empty-state>
          </div>
        }
        @case ('ok') {
          @if (product(); as p) {
            <nav class="mb-6 flex flex-wrap items-center gap-1 text-xs text-muted">
              <a routerLink="/" class="hover:text-fg">Inicio</a> <app-icon name="chevron-right" [size]="12" />
              <a routerLink="/productos" class="hover:text-fg">Catálogo</a> <app-icon name="chevron-right" [size]="12" />
              <a routerLink="/productos" [queryParams]="{ categoria: p.category.id }" class="hover:text-fg">{{ p.category.name }}</a>
            </nav>

            <div class="grid gap-10 md:grid-cols-2">
              <div class="card relative overflow-hidden p-2">
                <app-product-image [src]="p.imageUrl" [alt]="p.name" class="aspect-square rounded-2xl" />
                @if (p.isLowStock) {
                  <span class="badge absolute top-5 left-5 bg-brand-600 text-white"><app-icon name="zap" [size]="13" /> Últimas unidades</span>
                }
              </div>

              <div class="flex flex-col">
                <a routerLink="/productos" [queryParams]="{ categoria: p.category.id }"
                   class="text-xs font-semibold tracking-widest text-brand-600 uppercase">{{ p.category.name }}</a>
                <h1 class="mt-2 text-4xl leading-tight font-extrabold">{{ p.name }}</h1>
                <p class="mt-4 font-display text-5xl font-bold">{{ p.price | ars }}</p>

                <div class="mt-4 flex items-center gap-2 text-sm">
                  @if (p.isAvailable) {
                    <span class="size-2 rounded-full bg-emerald-500"></span>
                    <span>En stock <span class="text-muted">({{ p.stock }} disponible{{ p.stock === 1 ? '' : 's' }})</span></span>
                  } @else {
                    <span class="size-2 rounded-full bg-red-500"></span> <span>Sin stock por el momento</span>
                  }
                </div>

                @if (p.isAvailable) {
                  <div class="mt-6 flex flex-wrap items-center gap-3">
                    <app-quantity-stepper [(value)]="quantity" [max]="maxQuantity()" />
                    <button class="btn btn-primary flex-1 py-3 text-base sm:flex-none sm:px-8" (click)="addToCart(p)"
                            [disabled]="cart.isBusy(p.id) || maxQuantity() < 1">
                      @if (cart.isBusy(p.id)) { <app-spinner /> } @else { <app-icon name="cart" /> }
                      Agregar al carrito
                    </button>
                    <button class="btn btn-secondary py-3" (click)="favorites.toggle(p.id)"
                            [attr.aria-label]="isFavorite() ? 'Quitar de favoritos' : 'Agregar a favoritos'">
                      <app-icon name="heart" [class.fill-current]="isFavorite()" [class.text-red-500]="isFavorite()" />
                    </button>
                  </div>
                  @if (inCart() > 0) {
                    <p class="mt-3 text-sm text-muted">Ya tenés {{ inCart() }} en tu carrito.
                      <button class="font-semibold text-brand-600 hover:underline" (click)="cart.drawerOpen.set(true)">Ver carrito</button>
                    </p>
                  }
                }

                <ul class="mt-8 grid gap-3 rounded-2xl border border-line p-4 text-sm sm:grid-cols-3">
                  <li class="flex items-center gap-2"><app-icon name="store" class="text-brand-600" /> Retiro en el local</li>
                  <li class="flex items-center gap-2"><app-icon name="shield" class="text-brand-600" /> Garantía oficial</li>
                  <li class="flex items-center gap-2"><app-icon name="credit-card" class="text-brand-600" /> Pagá con tarjeta</li>
                </ul>

                <section class="mt-8">
                  <h2 class="mb-3 text-2xl font-bold uppercase">Descripción</h2>
                  <div class="rich-text" [innerHTML]="p.description"></div>
                </section>
              </div>
            </div>

            @defer (on viewport) {
              @if (related().length) {
                <section class="mt-16">
                  <h2 class="mb-6 text-3xl font-bold uppercase">También te puede interesar</h2>
                  <div class="grid grid-cols-2 gap-4 md:grid-cols-4">
                    @for (r of related(); track r.id) { <app-product-card [product]="r" /> }
                  </div>
                </section>
              }
            } @placeholder {
              <div class="h-40"></div>
            }
          }
        }
      }
    </div>
  `,
})
export class ProductDetailPage {
  private readonly api = inject(CatalogApi);
  private readonly title = inject(Title);
  protected readonly cart = inject(CartStore);
  protected readonly favorites = inject(FavoritesStore);

  /** Route param :id (component input binding). */
  readonly id = input.required<string>();
  protected readonly quantity = signal(1);

  protected readonly state = toSignal(
    toObservable(this.id).pipe(
      switchMap((id) =>
        this.api.product(Number(id)).pipe(
          map((product): DetailState => ({ status: 'ok', product })),
          catchError(() => of<DetailState>({ status: 'error' })),
          startWith<DetailState>({ status: 'loading' }),
        ),
      ),
    ),
    { initialValue: { status: 'loading' } as DetailState },
  );

  protected readonly product = computed(() => {
    const s = this.state();
    return s.status === 'ok' ? s.product : null;
  });

  protected readonly related = toSignal(
    toObservable(this.id).pipe(switchMap((id) => this.api.related(Number(id), 4).pipe(catchError(() => of([]))))),
    { initialValue: [] },
  );

  protected readonly isFavorite = computed(() => this.favorites.ids().has(Number(this.id())));
  protected readonly inCart = computed(() => {
    const p = this.product();
    return p ? (this.cart.cart().items.find((i) => i.productId === p.id)?.quantity ?? 0) : 0;
  });
  /** The stepper never lets you exceed what's left after what is already in the cart. */
  protected readonly maxQuantity = computed(() => Math.max(0, (this.product()?.stock ?? 0) - this.inCart()));

  constructor() {
    effect(() => {
      const p = this.product();
      if (p) this.title.setTitle(`${p.name} | MotoRepuestos`);
      this.quantity.set(1);
    });
  }

  protected async addToCart(p: ProductDetail): Promise<void> {
    if (await this.cart.add(p.id, this.quantity(), p.name)) this.quantity.set(1);
  }
}
