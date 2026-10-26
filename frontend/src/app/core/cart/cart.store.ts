import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, firstValueFrom } from 'rxjs';
import { CartApi } from '../api/store.api';
import { AuthService } from '../auth/auth.service';
import { GuestCartId } from '../auth/guest-cart-id';
import { errorMessage } from '../http/http-utils';
import { Cart } from '../models/api.models';
import { ToastService } from '../ui/toast.service';

const EMPTY_CART: Cart = { items: [], totalQuantity: 0, total: 0, hasUnavailableItems: false, canCheckout: false };

/**
 * Client-side state of the server cart. Guests and users share the same code path: the API
 * resolves the cart from the JWT or from the X-Cart-Id header.
 */
@Injectable({ providedIn: 'root' })
export class CartStore {
  private readonly api = inject(CartApi);
  private readonly guestCartId = inject(GuestCartId);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  readonly cart = signal<Cart>(EMPTY_CART);
  readonly loaded = signal(false);
  readonly busy = signal<ReadonlySet<number>>(new Set());
  readonly drawerOpen = signal(false);

  readonly count = computed(() => this.cart().totalQuantity);
  readonly isEmpty = computed(() => this.cart().items.length === 0);

  private readonly auth = inject(AuthService);

  constructor() {
    this.auth.events$.subscribe((event) => {
      if (event === 'logout') this.resetForGuest();
      // A page reload can interrupt the merge started at login: retry it (the endpoint is idempotent).
      else if (event === 'login' || (this.auth.isAuthenticated() && this.guestCartId.peek())) void this.mergeGuestCart();
      else void this.load();
    });
  }

  async load(): Promise<void> {
    try {
      this.cart.set(await firstValueFrom(this.api.get()));
    } catch {
      this.cart.set(EMPTY_CART);
    } finally {
      this.loaded.set(true);
    }
  }

  quantityOf(productId: number): number {
    return this.cart().items.find((i) => i.productId === productId)?.quantity ?? 0;
  }

  isBusy(productId: number): boolean {
    return this.busy().has(productId);
  }

  async add(productId: number, quantity = 1, productName?: string): Promise<boolean> {
    const ok = await this.run(productId, this.api.add(productId, quantity));
    if (ok) {
      this.toast.success('Agregado al carrito', productName, {
        label: 'Ver carrito',
        run: () => this.drawerOpen.set(true),
      });
    }
    return ok;
  }

  setQuantity(productId: number, quantity: number): Promise<boolean> {
    return this.run(productId, this.api.update(productId, quantity));
  }

  remove(productId: number): Promise<boolean> {
    return this.run(productId, this.api.remove(productId));
  }

  async clear(): Promise<void> {
    await firstValueFrom(this.api.clear());
    this.cart.set(EMPTY_CART);
  }

  /** Purchased items are removed server-side on checkout; refresh to reflect it. */
  refreshAfterCheckout(): Promise<void> {
    return this.load();
  }

  goToCheckout(): void {
    this.drawerOpen.set(false);
    void this.router.navigate(['/checkout']);
  }

  private async mergeGuestCart(): Promise<void> {
    try {
      this.cart.set(await firstValueFrom(this.api.merge(this.guestCartId.value)));
      this.guestCartId.reset();
    } catch {
      await this.load();
    }
  }

  private resetForGuest(): void {
    this.guestCartId.reset();
    this.cart.set(EMPTY_CART);
  }

  private async run(productId: number, request: Observable<Cart>): Promise<boolean> {
    this.busy.update((set) => new Set(set).add(productId));
    try {
      this.cart.set(await firstValueFrom(request));
      return true;
    } catch (error) {
      if (error instanceof HttpErrorResponse && error.status < 500 && error.status !== 0) {
        this.toast.warning('No se pudo actualizar el carrito', errorMessage(error));
        if (error.status === 409 || error.status === 404) await this.load();
      }
      return false;
    } finally {
      this.busy.update((set) => {
        const next = new Set(set);
        next.delete(productId);
        return next;
      });
    }
  }
}
