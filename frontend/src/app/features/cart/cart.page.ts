import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { CartStore } from '../../core/cart/cart.store';
import { ConfirmService } from '../../core/ui/confirm.service';
import { Icon } from '../../shared/components/icon';
import { EmptyState, ProductImage, QuantityStepper } from '../../shared/components/ui';
import { ArsPipe } from '../../shared/pipes';

@Component({
  selector: 'app-cart-page',
  imports: [RouterLink, Icon, EmptyState, ProductImage, QuantityStepper, ArsPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container-page py-10">
      <h1 class="mb-8 text-4xl font-extrabold uppercase">Tu carrito</h1>

      @if (!cart.loaded()) {
        <div class="skeleton h-64"></div>
      } @else if (cart.isEmpty()) {
        <div class="card">
          <app-empty-state icon="cart" title="Tu carrito está vacío" message="Agregá productos desde el catálogo para comprarlos.">
            <a routerLink="/productos" class="btn btn-primary">Explorar catálogo <app-icon name="arrow-right" /></a>
          </app-empty-state>
        </div>
      } @else {
        <div class="grid gap-8 lg:grid-cols-[1fr_360px]">
          <section class="card divide-y divide-line">
            @for (item of cart.cart().items; track item.productId) {
              <article class="flex gap-4 p-4 sm:p-5" [class.opacity-60]="!item.isAvailable">
                <a [routerLink]="['/productos', item.productId]" class="shrink-0">
                  <app-product-image [src]="item.imageUrl" [alt]="item.name" class="size-24 rounded-xl border border-line sm:size-28" />
                </a>
                <div class="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
                  <div class="min-w-0 flex-1">
                    <a [routerLink]="['/productos', item.productId]" class="font-semibold hover:text-brand-600">{{ item.name }}</a>
                    <p class="text-sm text-muted">{{ item.unitPrice | ars }} c/u</p>
                    @if (!item.isAvailable) {
                      <p class="mt-1 text-sm font-semibold text-red-600">No disponible: no se incluirá en la compra</p>
                    } @else if (item.exceedsStock) {
                      <p class="mt-1 text-sm font-semibold text-amber-600">Solo quedan {{ item.stock }} unidades: ajustá la cantidad</p>
                    }
                  </div>
                  @if (item.isAvailable) {
                    <app-quantity-stepper [value]="item.quantity" [max]="item.stock" [disabled]="cart.isBusy(item.productId)"
                                          (changed)="cart.setQuantity(item.productId, $event)" />
                  }
                  <p class="w-28 font-display text-2xl font-bold sm:text-right">{{ item.subtotal | ars }}</p>
                </div>
                <button class="btn-icon size-9 self-start text-muted hover:text-red-600" (click)="cart.remove(item.productId)"
                        [attr.aria-label]="'Quitar ' + item.name"><app-icon name="trash" [size]="17" /></button>
              </article>
            }
            <div class="flex justify-between p-4">
              <a routerLink="/productos" class="btn btn-ghost btn-sm"><app-icon name="arrow-left" [size]="15" /> Seguir comprando</a>
              <button class="btn btn-ghost btn-sm text-red-600" (click)="clear()"><app-icon name="trash" [size]="15" /> Vaciar carrito</button>
            </div>
          </section>

          <aside class="card h-fit space-y-4 p-6 lg:sticky lg:top-24">
            <h2 class="text-2xl font-bold uppercase">Resumen</h2>
            <dl class="space-y-2 text-sm">
              <div class="flex justify-between"><dt class="text-muted">Productos</dt><dd>{{ cart.count() }}</dd></div>
              <div class="flex justify-between"><dt class="text-muted">Retiro en el local</dt><dd class="text-emerald-600">Gratis</dd></div>
            </dl>
            <div class="flex items-end justify-between border-t border-line pt-4">
              <span class="font-semibold">Total</span>
              <span class="font-display text-4xl font-bold">{{ cart.cart().total | ars }}</span>
            </div>
            @if (cart.cart().hasUnavailableItems) {
              <p class="rounded-xl bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
                Hay productos sin stock o dados de baja: no se incluyen en el total.
              </p>
            }
            <button class="btn btn-primary w-full py-3 text-base" [disabled]="!cart.cart().canCheckout" (click)="cart.goToCheckout()">
              {{ auth.isAuthenticated() ? 'Finalizar compra' : 'Ingresar y finalizar compra' }} <app-icon name="arrow-right" />
            </button>
            <p class="flex items-center justify-center gap-1.5 text-xs text-muted"><app-icon name="lock" [size]="13" /> Compra 100% segura</p>
          </aside>
        </div>
      }
    </div>
  `,
})
export class CartPage {
  protected readonly cart = inject(CartStore);
  protected readonly auth = inject(AuthService);
  private readonly confirm = inject(ConfirmService);

  protected async clear(): Promise<void> {
    const ok = await this.confirm.confirm({
      title: '¿Vaciar el carrito?',
      message: 'Se quitarán todos los productos.',
      confirmText: 'Vaciar',
      danger: true,
    });
    if (ok) await this.cart.clear();
  }
}
