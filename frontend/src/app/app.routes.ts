import { Routes } from '@angular/router';
import { authGuard, guestOnlyGuard, staffGuard } from './core/auth/guards';
import { ShopLayout } from './layout/shop-layout';

export const routes: Routes = [
  {
    path: '',
    component: ShopLayout,
    children: [
      { path: '', loadComponent: () => import('./features/catalog/home.page').then((m) => m.HomePage) },
      { path: 'productos', title: 'Catálogo', loadComponent: () => import('./features/catalog/catalog.page').then((m) => m.CatalogPage) },
      { path: 'productos/:id', loadComponent: () => import('./features/catalog/product-detail.page').then((m) => m.ProductDetailPage) },
      { path: 'carrito', title: 'Tu carrito', loadComponent: () => import('./features/cart/cart.page').then((m) => m.CartPage) },
      {
        path: 'checkout',
        title: 'Finalizar compra',
        canActivate: [authGuard],
        loadComponent: () => import('./features/cart/checkout.page').then((m) => m.CheckoutPage),
      },
      { path: 'ingresar', title: 'Ingresar', canActivate: [guestOnlyGuard], loadComponent: () => import('./features/auth/login.page').then((m) => m.LoginPage) },
      { path: 'registro', title: 'Crear cuenta', canActivate: [guestOnlyGuard], loadComponent: () => import('./features/auth/register.page').then((m) => m.RegisterPage) },
      { path: 'cuenta', canActivate: [authGuard], loadChildren: () => import('./features/account/account.routes').then((m) => m.ACCOUNT_ROUTES) },
    ],
  },
  { path: 'admin', canActivate: [staffGuard], loadChildren: () => import('./features/admin/admin.routes').then((m) => m.ADMIN_ROUTES) },
  {
    path: '**',
    component: ShopLayout,
    children: [{ path: '', title: 'Página no encontrada', loadComponent: () => import('./features/not-found.page').then((m) => m.NotFoundPage) }],
  },
];
