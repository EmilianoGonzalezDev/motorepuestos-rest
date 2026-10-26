import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { FavoritesApi } from '../api/store.api';
import { AuthService } from '../auth/auth.service';
import { ToastService } from '../ui/toast.service';

/** Wish list ids, kept in memory so every product card can paint its heart instantly. */
@Injectable({ providedIn: 'root' })
export class FavoritesStore {
  private readonly api = inject(FavoritesApi);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);

  readonly ids = signal<ReadonlySet<number>>(new Set());

  constructor() {
    this.auth.events$.subscribe((event) => {
      if (event === 'logout') this.ids.set(new Set());
      else if (this.auth.isAuthenticated()) void this.load();
    });
  }

  has(productId: number): boolean {
    return this.ids().has(productId);
  }

  async load(): Promise<void> {
    try {
      this.ids.set(new Set(await firstValueFrom(this.api.ids())));
    } catch {
      this.ids.set(new Set());
    }
  }

  /** Optimistic toggle: the heart changes immediately and is reverted if the API fails. */
  async toggle(productId: number): Promise<void> {
    if (!this.auth.isAuthenticated()) {
      this.toast.info('Iniciá sesión', 'Necesitás una cuenta para guardar favoritos.');
      void this.router.navigate(['/ingresar'], { queryParams: { returnUrl: this.router.url } });
      return;
    }

    const wasFavorite = this.has(productId);
    this.setFavorite(productId, !wasFavorite);
    try {
      await firstValueFrom(wasFavorite ? this.api.remove(productId) : this.api.add(productId));
    } catch {
      this.setFavorite(productId, wasFavorite);
      this.toast.error('No se pudo actualizar tus favoritos');
    }
  }

  private setFavorite(productId: number, favorite: boolean): void {
    this.ids.update((ids) => {
      const next = new Set(ids);
      if (favorite) next.add(productId);
      else next.delete(productId);
      return next;
    });
  }
}
