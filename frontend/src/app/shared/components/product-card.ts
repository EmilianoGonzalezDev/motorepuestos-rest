import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CartStore } from '../../core/cart/cart.store';
import { FavoritesStore } from '../../core/favorites/favorites.store';
import { ProductCard as ProductCardModel } from '../../core/models/api.models';
import { ArsPipe } from '../pipes';
import { Icon } from './icon';
import { ProductImage, Spinner } from './ui';

@Component({
  selector: 'app-product-card',
  imports: [RouterLink, ArsPipe, Icon, ProductImage, Spinner],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article class="card group relative flex h-full flex-col overflow-hidden transition duration-200 hover:-translate-y-0.5 hover:shadow-pop">
      <a [routerLink]="['/productos', product().id]" class="relative block aspect-square" [attr.aria-label]="product().name">
        <app-product-image [src]="product().imageUrl" [alt]="product().name"
                           class="size-full transition duration-300 group-hover:scale-[1.03]" />
        @if (!product().isAvailable) {
          <span class="badge absolute top-3 left-3 bg-zinc-900/80 text-white">Sin stock</span>
        } @else if (product().isLowStock) {
          <span class="badge absolute top-3 left-3 bg-brand-600 text-white">¡Últimas {{ product().stock }}!</span>
        }
      </a>

      <button type="button" (click)="favorites.toggle(product().id)"
              class="absolute top-3 right-3 grid size-9 place-items-center rounded-full bg-white/90 shadow-sm backdrop-blur transition hover:scale-110 dark:bg-zinc-900/80"
              [class.text-red-500]="isFavorite()" [class.text-zinc-500]="!isFavorite()"
              [attr.aria-label]="isFavorite() ? 'Quitar de favoritos' : 'Agregar a favoritos'" [attr.aria-pressed]="isFavorite()">
        <app-icon name="heart" [size]="18" [class.fill-current]="isFavorite()" />
      </button>

      <div class="flex flex-1 flex-col gap-1 p-4">
        <span class="text-xs font-medium tracking-wide text-muted uppercase">{{ product().category.name }}</span>
        <a [routerLink]="['/productos', product().id]" class="line-clamp-2 min-h-10 text-sm font-semibold leading-snug hover:text-brand-600">
          {{ product().name }}
        </a>
        <div class="mt-auto flex items-end justify-between gap-2 pt-3">
          <span class="font-display text-2xl font-bold">{{ product().price | ars }}</span>
          <button type="button" class="btn btn-primary btn-sm" (click)="add()"
                  [disabled]="!product().isAvailable || cart.isBusy(product().id)" aria-label="Agregar al carrito">
            @if (cart.isBusy(product().id)) { <app-spinner [size]="14" /> } @else { <app-icon name="cart" [size]="16" /> }
            <span class="hidden sm:inline">Agregar</span>
          </button>
        </div>
      </div>
    </article>
  `,
})
export class ProductCard {
  readonly product = input.required<ProductCardModel>();
  protected readonly cart = inject(CartStore);
  protected readonly favorites = inject(FavoritesStore);
  protected readonly isFavorite = computed(() => this.favorites.ids().has(this.product().id));

  protected add(): void {
    void this.cart.add(this.product().id, 1, this.product().name);
  }
}

@Component({
  selector: 'app-product-card-skeleton',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="card overflow-hidden">
      <div class="skeleton aspect-square rounded-none"></div>
      <div class="space-y-2 p-4">
        <div class="skeleton h-3 w-1/3"></div>
        <div class="skeleton h-4 w-full"></div>
        <div class="skeleton h-4 w-2/3"></div>
        <div class="flex justify-between pt-3"><div class="skeleton h-7 w-24"></div><div class="skeleton h-7 w-20"></div></div>
      </div>
    </div>
  `,
})
export class ProductCardSkeleton {}
