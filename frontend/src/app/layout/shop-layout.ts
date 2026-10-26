import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthService } from '../core/auth/auth.service';
import { CartStore } from '../core/cart/cart.store';
import { ThemeService } from '../core/ui/theme.service';
import { ToastService } from '../core/ui/toast.service';
import { Icon } from '../shared/components/icon';
import { CartDrawer } from './cart-drawer';
import { SearchBox } from './search-box';

@Component({
  selector: 'app-logo',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <a routerLink="/" class="flex items-center gap-2" aria-label="MotoRepuestos, inicio">
      <span class="grid size-9 place-items-center rounded-xl bg-brand-600 text-white shadow-sm">
        <svg viewBox="0 0 64 64" class="size-6" fill="none" stroke="currentColor" stroke-width="5" stroke-linecap="round">
          <circle cx="32" cy="32" r="17" /><circle cx="32" cy="32" r="4" fill="currentColor" />
          <path d="M32 9v6M32 49v6M9 32h6M49 32h6" />
        </svg>
      </span>
      <span class="font-display text-2xl leading-none font-extrabold tracking-wide uppercase">
        Moto<span class="text-brand-600">Repuestos</span>
      </span>
    </a>
  `,
})
export class Logo {}

@Component({
  selector: 'app-shop-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon, SearchBox, CartDrawer, Logo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '(document:click)': 'userMenuOpen.set(false)' },
  template: `
    <div class="flex min-h-dvh flex-col">
      <div class="bg-zinc-950 text-zinc-300">
        <div class="container-page flex h-9 items-center justify-between text-xs">
          <span class="flex items-center gap-1.5"><app-icon name="truck" [size]="14" /> Retiro en el local · Pagos con tarjeta o transferencia</span>
          <span class="hidden items-center gap-1.5 sm:flex"><app-icon name="phone" [size]="14" /> (011) 4555-0000 · Lun a Sáb 9 a 19 h</span>
        </div>
      </div>

      <header class="sticky top-0 z-40 border-b border-line bg-surface/85 backdrop-blur-lg">
        <div class="container-page flex h-16 items-center gap-4">
          <app-logo />
          <app-search-box class="hidden flex-1 md:block md:max-w-xl md:px-4 lg:mx-auto" />

          <nav class="ml-auto flex items-center gap-1">
            <a routerLink="/productos" routerLinkActive="text-brand-600" class="btn btn-ghost hidden lg:inline-flex">Catálogo</a>
            <button class="btn-icon" (click)="theme.toggle()" [attr.aria-label]="theme.dark() ? 'Modo claro' : 'Modo oscuro'">
              <app-icon [name]="theme.dark() ? 'sun' : 'moon'" />
            </button>

            @if (auth.isAuthenticated()) {
              <a routerLink="/cuenta/favoritos" class="btn-icon hidden sm:inline-flex" aria-label="Favoritos"><app-icon name="heart" /></a>
            }

            <button class="btn-icon relative" (click)="cart.drawerOpen.set(true)" aria-label="Abrir carrito">
              <app-icon name="cart" />
              @if (cart.count() > 0) {
                <span class="absolute -top-0.5 -right-0.5 grid min-w-5 place-items-center rounded-full bg-brand-600 px-1 text-[11px] font-bold text-white animate-pop-in">
                  {{ cart.count() }}
                </span>
              }
            </button>

            @if (auth.user(); as user) {
              <div class="relative" (click)="$event.stopPropagation()">
                <button class="btn btn-ghost px-2.5" (click)="userMenuOpen.set(!userMenuOpen())" [attr.aria-expanded]="userMenuOpen()">
                  <span class="grid size-8 place-items-center rounded-full bg-brand-500/15 text-sm font-bold text-brand-700 dark:text-brand-300">
                    {{ user.fullName.charAt(0) }}
                  </span>
                  <span class="hidden max-w-28 truncate sm:inline">{{ auth.firstName() }}</span>
                  <app-icon name="chevron-down" [size]="16" />
                </button>
                @if (userMenuOpen()) {
                  <div class="card absolute right-0 mt-2 w-60 p-1.5 shadow-pop animate-pop-in" (click)="userMenuOpen.set(false)">
                    <div class="px-3 py-2">
                      <p class="truncate text-sm font-semibold">{{ user.fullName }}</p>
                      <p class="truncate text-xs text-muted">{{ user.email }}</p>
                    </div>
                    <hr class="my-1 border-line" />
                    @if (auth.isStaff()) {
                      <a routerLink="/admin" class="menu-item"><app-icon name="dashboard" [size]="16" /> Panel de administración</a>
                    }
                    <a routerLink="/cuenta/pedidos" class="menu-item"><app-icon name="package" [size]="16" /> Mis pedidos</a>
                    <a routerLink="/cuenta/favoritos" class="menu-item"><app-icon name="heart" [size]="16" /> Favoritos</a>
                    <a routerLink="/cuenta/perfil" class="menu-item"><app-icon name="user-cog" [size]="16" /> Mi perfil</a>
                    <hr class="my-1 border-line" />
                    <button class="menu-item w-full text-red-600" (click)="logout()"><app-icon name="log-out" [size]="16" /> Cerrar sesión</button>
                  </div>
                }
              </div>
            } @else {
              <a routerLink="/ingresar" class="btn btn-primary ml-1"><app-icon name="log-in" [size]="16" /> <span class="hidden sm:inline">Ingresar</span></a>
            }
          </nav>
        </div>
        <div class="container-page pb-3 md:hidden"><app-search-box /></div>
      </header>

      <main class="flex-1">
        <router-outlet />
      </main>

      <footer class="mt-16 border-t border-line bg-surface">
        <div class="container-page grid gap-8 py-10 sm:grid-cols-2 lg:grid-cols-4">
          <div class="space-y-3">
            <app-logo />
            <p class="text-sm text-muted">Repuestos, accesorios e indumentaria para tu moto. Calidad y precio, desde 2010.</p>
          </div>
          <div>
            <h3 class="mb-3 text-lg font-bold">Tienda</h3>
            <ul class="space-y-2 text-sm text-muted">
              <li><a routerLink="/productos" class="hover:text-fg">Catálogo completo</a></li>
              <li><a routerLink="/carrito" class="hover:text-fg">Carrito</a></li>
              <li><a routerLink="/cuenta/pedidos" class="hover:text-fg">Seguimiento de pedidos</a></li>
            </ul>
          </div>
          <div>
            <h3 class="mb-3 text-lg font-bold">Contacto</h3>
            <ul class="space-y-2 text-sm text-muted">
              <li class="flex items-center gap-2"><app-icon name="map-pin" [size]="15" /> Av. Rivadavia 1234, CABA</li>
              <li class="flex items-center gap-2"><app-icon name="phone" [size]="15" /> (011) 4555-0000</li>
              <li class="flex items-center gap-2"><app-icon name="mail" [size]="15" /> ventas&#64;motorepuestos.com</li>
            </ul>
          </div>
          <div>
            <h3 class="mb-3 text-lg font-bold">Medios de pago</h3>
            <div class="flex flex-wrap gap-2 text-xs">
              <span class="badge bg-surface-2"><app-icon name="credit-card" [size]="14" /> Tarjetas</span>
              <span class="badge bg-surface-2"><app-icon name="bank" [size]="14" /> Transferencia</span>
              <span class="badge bg-surface-2"><app-icon name="store" [size]="14" /> En el local</span>
            </div>
          </div>
        </div>
        <div class="border-t border-line py-4 text-center text-xs text-muted">
          © {{ year }} MotoRepuestos · Demo de portfolio — ASP.NET Core 10 + Angular + SQL Server
        </div>
      </footer>
    </div>

    <app-cart-drawer />
  `,
  styles: `
    .menu-item {
      display: flex; align-items: center; gap: 0.6rem; border-radius: 0.75rem; padding: 0.5rem 0.75rem;
      font-size: 0.875rem; transition: background-color 0.15s;
    }
    .menu-item:hover { background-color: var(--color-surface-2); }
  `,
})
export class ShopLayout {
  protected readonly auth = inject(AuthService);
  protected readonly cart = inject(CartStore);
  protected readonly theme = inject(ThemeService);
  private readonly router = inject(Router);
  private readonly toast = inject(ToastService);
  protected readonly userMenuOpen = signal(false);
  protected readonly year = new Date().getFullYear();

  protected logout(): void {
    this.auth.logout().subscribe(() => {
      this.toast.info('Sesión cerrada', '¡Hasta pronto!');
      void this.router.navigate(['/']);
    });
  }
}
