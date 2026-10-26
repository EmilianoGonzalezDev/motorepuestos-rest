import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CartStore } from '../core/cart/cart.store';
import { Icon } from '../shared/components/icon';
import { ProductImage, QuantityStepper } from '../shared/components/ui';
import { ArsPipe } from '../shared/pipes';

/** Slide-over mini cart opened from the header or after adding a product. */
@Component({
  selector: 'app-cart-drawer',
  imports: [RouterLink, Icon, ProductImage, QuantityStepper, ArsPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:keydown.escape)': 'cart.drawerOpen.set(false)' },
  template: `
    @if (cart.drawerOpen()) {
      <div class="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] animate-fade-in" (click)="cart.drawerOpen.set(false)"></div>
      <aside class="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col bg-surface shadow-pop animate-slide-in-right"
             role="dialog" aria-modal="true" aria-label="Carrito">
        <header class="flex items-center justify-between border-b border-line px-5 py-4">
          <h2 class="flex items-center gap-2 text-2xl font-bold">
            <app-icon name="cart" [size]="22" /> Tu carrito
            <span class="badge bg-surface-2 text-muted">{{ cart.count() }}</span>
          </h2>
          <button class="btn-icon" (click)="cart.drawerOpen.set(false)" aria-label="Cerrar carrito"><app-icon name="x" /></button>
        </header>

        @if (cart.isEmpty()) {
          <div class="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
            <div class="grid size-16 place-items-center rounded-2xl bg-brand-500/10 text-brand-600"><app-icon name="cart" [size]="30" /></div>
            <p class="text-lg font-semibold">Tu carrito está vacío</p>
            <a routerLink="/productos" class="btn btn-primary" (click)="cart.drawerOpen.set(false)">Ver productos</a>
          </div>
        } @else {
          <ul class="flex-1 divide-y divide-line overflow-y-auto px-5">
            @for (item of cart.cart().items; track item.productId) {
              <li class="flex gap-3 py-4" [class.opacity-60]="!item.isAvailable">
                <app-product-image [src]="item.imageUrl" [alt]="item.name" class="size-20 shrink-0 rounded-xl border border-line" />
                <div class="min-w-0 flex-1">
                  <a [routerLink]="['/productos', item.productId]" (click)="cart.drawerOpen.set(false)"
                     class="line-clamp-2 text-sm font-medium hover:text-brand-600">{{ item.name }}</a>
                  @if (!item.isAvailable) {
                    <p class="mt-1 text-xs font-semibold text-red-600">No disponible</p>
                  } @else if (item.exceedsStock) {
                    <p class="mt-1 text-xs font-semibold text-amber-600">Solo quedan {{ item.stock }}</p>
                  }
                  <div class="mt-2 flex items-center justify-between">
                    @if (item.isAvailable) {
                      <app-quantity-stepper [value]="item.quantity" [max]="item.stock" [disabled]="cart.isBusy(item.productId)"
                                            (changed)="cart.setQuantity(item.productId, $event)" />
                    }
                    <span class="ml-auto font-semibold">{{ item.subtotal | ars }}</span>
                  </div>
                </div>
                <button class="btn-icon size-8 text-muted hover:text-red-600" (click)="cart.remove(item.productId)"
                        [attr.aria-label]="'Quitar ' + item.name"><app-icon name="trash" [size]="16" /></button>
              </li>
            }
          </ul>

          <footer class="space-y-3 border-t border-line p-5">
            @if (cart.cart().hasUnavailableItems) {
              <p class="rounded-xl bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                Los productos no disponibles no se incluyen en el total.
              </p>
            }
            <div class="flex items-center justify-between">
              <span class="text-muted">Total</span>
              <span class="font-display text-3xl font-bold">{{ cart.cart().total | ars }}</span>
            </div>
            <button class="btn btn-primary w-full py-3" [disabled]="!cart.cart().canCheckout" (click)="cart.goToCheckout()">
              Finalizar compra <app-icon name="arrow-right" />
            </button>
            <a routerLink="/carrito" class="btn btn-secondary w-full" (click)="cart.drawerOpen.set(false)">Ver carrito completo</a>
          </footer>
        }
      </aside>
    }
  `,
})
export class CartDrawer {
  protected readonly cart = inject(CartStore);
}
