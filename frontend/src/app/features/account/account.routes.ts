import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet, Routes } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';
import { Icon, IconName } from '../../shared/components/icon';

@Component({
  selector: 'app-account-layout',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="container-page py-10">
      <h1 class="text-4xl font-extrabold uppercase">Mi cuenta</h1>
      <p class="text-sm text-muted">Hola {{ auth.firstName() }}, desde acá gestionás tus compras y tus datos.</p>
      <nav class="mt-6 flex gap-1 overflow-x-auto border-b border-line">
        @for (tab of tabs; track tab.path) {
          <a [routerLink]="tab.path" routerLinkActive="border-brand-600! text-fg!"
             class="flex shrink-0 items-center gap-2 border-b-2 border-transparent px-4 py-2.5 text-sm font-semibold text-muted transition hover:text-fg">
            <app-icon [name]="tab.icon" [size]="16" /> {{ tab.label }}
          </a>
        }
      </nav>
      <div class="pt-8"><router-outlet /></div>
    </div>
  `,
})
export class AccountLayout {
  protected readonly auth = inject(AuthService);
  protected readonly tabs: { path: string; label: string; icon: IconName }[] = [
    { path: 'pedidos', label: 'Mis pedidos', icon: 'package' },
    { path: 'favoritos', label: 'Favoritos', icon: 'heart' },
    { path: 'perfil', label: 'Mi perfil', icon: 'user-cog' },
  ];
}

export const ACCOUNT_ROUTES: Routes = [
  {
    path: '',
    component: AccountLayout,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'pedidos' },
      { path: 'pedidos', title: 'Mis pedidos', loadComponent: () => import('./my-orders.page').then((m) => m.MyOrdersPage) },
      { path: 'pedidos/:id', title: 'Detalle del pedido', loadComponent: () => import('./order-detail.page').then((m) => m.OrderDetailPage) },
      { path: 'favoritos', title: 'Favoritos', loadComponent: () => import('./favorites.page').then((m) => m.FavoritesPage) },
      { path: 'perfil', title: 'Mi perfil', loadComponent: () => import('./profile.page').then((m) => m.ProfilePage) },
    ],
  },
];
