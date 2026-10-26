import { ChangeDetectionStrategy, Component, inject, signal, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { OrdersApi } from '../../core/api/store.api';
import { AuthService } from '../../core/auth/auth.service';
import { CartStore } from '../../core/cart/cart.store';
import { errorMessage } from '../../core/http/http-utils';
import { OrderDetail, PaymentType } from '../../core/models/api.models';
import { Icon, IconName } from '../../shared/components/icon';
import { EmptyState, ProductImage, Spinner } from '../../shared/components/ui';
import { ArsPipe, PaymentPipe } from '../../shared/pipes';
import { CardPaymentForm } from './card-payment-form';

const PAYMENTS: { value: PaymentType; icon: IconName; title: string; text: string }[] = [
  { value: 'Card', icon: 'credit-card', title: 'Tarjeta', text: 'Crédito o débito. Pago simulado, sin cobro real.' },
  { value: 'BankTransfer', icon: 'bank', title: 'Transferencia', text: 'CBU/alias al confirmar el pedido.' },
  { value: 'Store', icon: 'store', title: 'En el local', text: 'Pagás cuando retirás tu pedido.' },
];

const SIMULATED_PAYMENT_MS = 2000;

@Component({
  selector: 'app-checkout-page',
  imports: [FormsModule, RouterLink, Icon, EmptyState, ProductImage, Spinner, ArsPipe, PaymentPipe, CardPaymentForm],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container-page py-10">
      @if (placed(); as order) {
        <!-- Success -->
        <div class="card mx-auto max-w-2xl p-8 text-center animate-pop-in">
          <div class="mx-auto grid size-20 place-items-center rounded-full bg-emerald-500/15 text-emerald-600">
            <app-icon name="circle-check" [size]="44" />
          </div>
          <h1 class="mt-5 text-4xl font-extrabold uppercase">¡Gracias por tu compra!</h1>
          <p class="mt-2 text-muted">Recibimos tu pedido <strong class="text-fg">#{{ order.id }}</strong> por <strong class="text-fg">{{ order.total | ars }}</strong>.</p>
          <p class="mt-1 text-sm text-muted">Medio de pago: {{ order.paymentType | payment }}@if (order.paymentType === 'Card') { (pago simulado)}. Te avisaremos cuando esté listo para retirar.</p>
          <div class="mt-8 flex flex-wrap justify-center gap-3">
            <a [routerLink]="['/cuenta/pedidos', order.id]" class="btn btn-primary"><app-icon name="package" /> Seguir mi pedido</a>
            <a routerLink="/productos" class="btn btn-secondary">Seguir comprando</a>
          </div>
        </div>
      } @else if (cart.loaded() && !cart.cart().canCheckout && !placing()) {
        <div class="card">
          <app-empty-state icon="cart" title="No hay productos para comprar" message="Tu carrito está vacío o tiene productos sin stock.">
            <a routerLink="/carrito" class="btn btn-primary">Revisar carrito</a>
          </app-empty-state>
        </div>
      } @else {
        <h1 class="mb-8 text-4xl font-extrabold uppercase">Finalizar compra</h1>
        <div class="grid gap-8 lg:grid-cols-[1fr_380px]">
          <form class="space-y-6" (ngSubmit)="place()">
            <section class="card p-6">
              <h2 class="mb-1 text-2xl font-bold uppercase">1. Tus datos</h2>
              @if (auth.user(); as user) {
                <p class="text-sm text-muted">Comprás como <strong class="text-fg">{{ user.fullName }}</strong> ({{ user.email }}).</p>
              }
            </section>

            <section class="card p-6">
              <h2 class="mb-4 text-2xl font-bold uppercase">2. Medio de pago</h2>
              <div class="grid gap-3 sm:grid-cols-3">
                @for (p of payments; track p.value) {
                  <label class="relative flex cursor-pointer flex-col gap-2 rounded-2xl border-2 p-4 transition"
                         [class]="paymentType() === p.value ? 'border-brand-500 bg-brand-500/5' : 'border-line hover:border-muted/40'">
                    <input type="radio" name="payment" class="sr-only" [value]="p.value" [ngModel]="paymentType()" (ngModelChange)="paymentType.set($event)" />
                    <app-icon [name]="p.icon" [size]="24" [class]="paymentType() === p.value ? 'text-brand-600' : 'text-muted'" />
                    <span class="font-semibold">{{ p.title }}</span>
                    <span class="text-xs text-muted">{{ p.text }}</span>
                    @if (paymentType() === p.value) {
                      <span class="absolute top-3 right-3 grid size-5 place-items-center rounded-full bg-brand-600 text-white"><app-icon name="check" [size]="13" /></span>
                    }
                  </label>
                }
              </div>
              @if (paymentType() === 'Card') {
                <app-card-payment-form />
              }
            </section>

            <section class="card p-6">
              <h2 class="mb-4 text-2xl font-bold uppercase">3. Retiro</h2>
              <div class="flex items-start gap-3 rounded-2xl bg-surface-2 p-4 text-sm">
                <app-icon name="map-pin" class="mt-0.5 text-brand-600" />
                <div><p class="font-semibold">Retiro en el local · Gratis</p><p class="text-muted">Av. Rivadavia 1234, CABA · Lun a Sáb de 9 a 19 h</p></div>
              </div>
              <label class="label mt-4" for="notes">Notas para la tienda (opcional)</label>
              <textarea id="notes" name="notes" class="input min-h-24" maxlength="500" placeholder="Ej: retiro el sábado por la mañana"
                        [ngModel]="notes()" (ngModelChange)="notes.set($event)"></textarea>
            </section>

            @if (error()) {
              <div class="flex gap-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-700 dark:text-red-300">
                <app-icon name="circle-alert" class="mt-0.5" />
                <div><p class="font-semibold">No pudimos confirmar tu pedido</p><p>{{ error() }}</p>
                  <a routerLink="/carrito" class="mt-1 inline-block font-semibold underline">Revisar carrito</a></div>
              </div>
            }

            <button type="submit" class="btn btn-primary w-full py-3.5 text-base lg:hidden" [disabled]="placing()">
              @if (processingPayment()) { <app-spinner /> Procesando pago… }
              @else { @if (placing()) { <app-spinner /> } Confirmar pedido · {{ cart.cart().total | ars }} }
            </button>
          </form>

          <aside class="card h-fit p-6 lg:sticky lg:top-24">
            <h2 class="mb-4 text-2xl font-bold uppercase">Tu pedido</h2>
            <ul class="-m-2 max-h-80 space-y-3 overflow-y-auto p-2">
              @for (item of cart.cart().items; track item.productId) {
                @if (item.isAvailable) {
                  <li class="flex items-center gap-3">
                    <div class="relative">
                      <app-product-image [src]="item.imageUrl" [alt]="item.name" [padded]="false" class="size-14 rounded-lg border border-line" />
                      <span class="absolute -top-2 -right-2 grid size-5 place-items-center rounded-full bg-zinc-800 text-[11px] font-bold text-white">{{ item.quantity }}</span>
                    </div>
                    <span class="line-clamp-2 flex-1 text-sm">{{ item.name }}</span>
                    <span class="text-sm font-semibold">{{ item.subtotal | ars }}</span>
                  </li>
                }
              }
            </ul>
            <div class="mt-5 flex items-end justify-between border-t border-line pt-4">
              <span class="font-semibold">Total</span>
              <span class="font-display text-4xl font-bold">{{ cart.cart().total | ars }}</span>
            </div>
            <button class="btn btn-primary mt-5 hidden w-full py-3.5 text-base lg:flex" [disabled]="placing()" (click)="place()">
              @if (processingPayment()) { <app-spinner /> Procesando pago… }
              @else { @if (placing()) { <app-spinner /> } Confirmar pedido }
            </button>
          </aside>
        </div>
      }
    </div>
  `,
})
export class CheckoutPage {
  private readonly ordersApi = inject(OrdersApi);
  protected readonly cart = inject(CartStore);
  protected readonly auth = inject(AuthService);

  protected readonly payments = PAYMENTS;
  protected readonly paymentType = signal<PaymentType>('Card');
  protected readonly notes = signal('');
  protected readonly placing = signal(false);
  protected readonly processingPayment = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly placed = signal<OrderDetail | null>(null);
  private readonly cardForm = viewChild(CardPaymentForm);

  protected async place(): Promise<void> {
    if (this.placing()) return;
    const payingByCard = this.paymentType() === 'Card';
    if (payingByCard && !this.cardForm()?.validate()) return;

    this.placing.set(true);
    this.error.set(null);

    if (payingByCard) {
      // Simulated gateway: a short pause so the flow feels like a real payment. No card data is sent.
      this.processingPayment.set(true);
      await new Promise((resolve) => setTimeout(resolve, SIMULATED_PAYMENT_MS));
      this.processingPayment.set(false);
    }

    this.ordersApi.place(this.paymentType(), this.notes().trim() || null).subscribe({
      next: (order) => {
        this.placed.set(order);
        this.placing.set(false);
        void this.cart.refreshAfterCheckout();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      },
      error: (err) => {
        this.error.set(errorMessage(err, 'Intentá nuevamente en unos segundos.'));
        this.placing.set(false);
        void this.cart.load();
      },
    });
  }

}
