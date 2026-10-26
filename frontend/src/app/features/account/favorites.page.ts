import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FavoritesApi } from '../../core/api/store.api';
import { FavoritesStore } from '../../core/favorites/favorites.store';
import { ProductCard as ProductCardModel } from '../../core/models/api.models';
import { ProductCard, ProductCardSkeleton } from '../../shared/components/product-card';
import { EmptyState } from '../../shared/components/ui';

@Component({
  selector: 'app-favorites-page',
  imports: [RouterLink, ProductCard, ProductCardSkeleton, EmptyState],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (products(); as list) {
      @if (visible().length === 0) {
        <div class="card">
          <app-empty-state icon="heart" title="No tenés favoritos" message="Tocá el corazón en cualquier producto para guardarlo acá.">
            <a routerLink="/productos" class="btn btn-primary">Explorar catálogo</a>
          </app-empty-state>
        </div>
      } @else {
        <div class="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
          @for (p of visible(); track p.id) { <app-product-card [product]="p" /> }
        </div>
      }
    } @else {
      <div class="grid grid-cols-2 gap-4 md:grid-cols-4">@for (i of [1, 2, 3, 4]; track i) { <app-product-card-skeleton /> }</div>
    }
  `,
})
export class FavoritesPage {
  private readonly api = inject(FavoritesApi);
  private readonly store = inject(FavoritesStore);
  protected readonly products = signal<ProductCardModel[] | null>(null);

  /** Un-hearting a product hides it right away (the store is the source of truth). */
  protected readonly visible = computed(() => (this.products() ?? []).filter((p) => this.store.ids().has(p.id)));

  constructor() {
    this.api.list().subscribe({
      next: (list) => this.products.set(list),
      error: () => this.products.set([]),
    });
  }
}
