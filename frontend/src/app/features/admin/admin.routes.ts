import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router, RouterLink, RouterLinkActive, RouterOutlet, Routes } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { ThemeService } from '../../core/ui/theme.service';
import { Logo } from '../../layout/shop-layout';
import { Icon, IconName } from '../../shared/components/icon';
import { RolePipe } from '../../shared/pipes';

interface NavItem {
  path: string;
  label: string;
  icon: IconName;
  exact?: boolean;
}

@Component({
  selector: 'app-admin-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon, Logo, RolePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex min-h-dvh">
      <!-- Sidebar -->
      <aside class="fixed inset-y-0 left-0 z-40 flex w-64 -translate-x-full flex-col border-r border-line bg-surface transition-transform lg:translate-x-0"
             [class.translate-x-0!]="menuOpen()">
        <div class="flex h-16 items-center border-b border-line px-5"><app-logo /></div>
        <nav class="flex-1 space-y-1 overflow-y-auto p-3">
          <p class="px-3 pt-2 pb-1 text-[11px] font-semibold tracking-widest text-muted uppercase">Gestión</p>
          @for (item of nav; track item.path) {
            <a [routerLink]="item.path" routerLinkActive="bg-brand-500/10 text-brand-700! dark:text-brand-300!"
               [routerLinkActiveOptions]="{ exact: !!item.exact }" (click)="menuOpen.set(false)"
               class="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-fg/80 transition hover:bg-surface-2">
              <app-icon [name]="item.icon" [size]="18" /> {{ item.label }}
            </a>
          }
        </nav>
        <div class="border-t border-line p-3">
          <a routerLink="/" class="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium hover:bg-surface-2">
            <app-icon name="store" [size]="18" /> Ver tienda
          </a>
        </div>
      </aside>
      @if (menuOpen()) {
        <div class="fixed inset-0 z-30 bg-black/40 lg:hidden" (click)="menuOpen.set(false)"></div>
      }

      <div class="flex min-w-0 flex-1 flex-col lg:pl-64">
        <header class="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-line bg-surface/85 px-4 backdrop-blur-lg sm:px-6">
          <button class="btn-icon lg:hidden" (click)="menuOpen.set(true)" aria-label="Abrir menú"><app-icon name="menu" /></button>
          <span class="badge bg-brand-500/10 text-brand-700 dark:text-brand-300"><app-icon name="shield" [size]="13" /> Back office</span>
          <div class="ml-auto flex items-center gap-2">
            <button class="btn-icon" (click)="theme.toggle()" aria-label="Cambiar tema"><app-icon [name]="theme.dark() ? 'sun' : 'moon'" /></button>
            @if (auth.user(); as user) {
              <div class="hidden text-right sm:block">
                <p class="text-sm leading-tight font-semibold">{{ user.fullName }}</p>
                <p class="text-xs text-muted">{{ user.role | role }}</p>
              </div>
            }
            <button class="btn-icon" (click)="logout()" aria-label="Cerrar sesión"><app-icon name="log-out" /></button>
          </div>
        </header>
        <main class="flex-1 p-4 sm:p-6 lg:p-8"><router-outlet /></main>
      </div>
    </div>
  `,
})
export class AdminLayout {
  protected readonly auth = inject(AuthService);
  protected readonly theme = inject(ThemeService);
  private readonly router = inject(Router);
  protected readonly menuOpen = signal(false);

  protected readonly nav: NavItem[] = [
    { path: '/admin', label: 'Dashboard', icon: 'dashboard', exact: true },
    { path: '/admin/pedidos', label: 'Pedidos', icon: 'clipboard' },
    { path: '/admin/productos', label: 'Productos', icon: 'boxes' },
    { path: '/admin/categorias', label: 'Categorías', icon: 'tags' },
    { path: '/admin/usuarios', label: 'Usuarios', icon: 'users' },
    { path: '/admin/configuracion', label: 'Configuración', icon: 'settings' },
  ];

  protected logout(): void {
    this.auth.logout().subscribe(() => void this.router.navigate(['/']));
  }
}

export const ADMIN_ROUTES: Routes = [
  {
    path: '',
    component: AdminLayout,
    children: [
      { path: '', title: 'Dashboard', loadComponent: () => import('./dashboard.page').then((m) => m.DashboardPage) },
      { path: 'pedidos', title: 'Pedidos', loadComponent: () => import('./orders.page').then((m) => m.AdminOrdersPage) },
      { path: 'productos', title: 'Productos', loadComponent: () => import('./products.page').then((m) => m.AdminProductsPage) },
      { path: 'productos/nuevo', title: 'Nuevo producto', loadComponent: () => import('./product-form.page').then((m) => m.ProductFormPage) },
      { path: 'productos/:id', title: 'Editar producto', loadComponent: () => import('./product-form.page').then((m) => m.ProductFormPage) },
      { path: 'categorias', title: 'Categorías', loadComponent: () => import('./categories.page').then((m) => m.AdminCategoriesPage) },
      { path: 'usuarios', title: 'Usuarios', loadComponent: () => import('./users.page').then((m) => m.AdminUsersPage) },
      { path: 'configuracion', title: 'Configuración', loadComponent: () => import('./settings.page').then((m) => m.AdminSettingsPage) },
    ],
  },
];
