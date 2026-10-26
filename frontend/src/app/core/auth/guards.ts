import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ToastService } from '../ui/toast.service';
import { AuthService } from './auth.service';

/** Requires a signed-in user; otherwise sends to login and comes back afterwards. */
export const authGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  return auth.isAuthenticated()
    ? true
    : inject(Router).createUrlTree(['/ingresar'], { queryParams: { returnUrl: state.url } });
};

export const staffGuard: CanActivateFn = (_route, state) => {
  const auth = inject(AuthService);
  const router = inject(Router);
  if (!auth.isAuthenticated()) return router.createUrlTree(['/ingresar'], { queryParams: { returnUrl: state.url } });
  if (auth.isStaff()) return true;

  inject(ToastService).warning('Acceso denegado', 'Tu cuenta no tiene permisos de administración.');
  return router.createUrlTree(['/']);
};

export const superAdminGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  if (auth.isSuperAdmin()) return true;
  inject(ToastService).warning('Acceso denegado', 'Solo el super administrador puede acceder.');
  return inject(Router).createUrlTree(['/admin']);
};

/** Login/register are pointless when already signed in. */
export const guestOnlyGuard: CanActivateFn = () =>
  inject(AuthService).isAuthenticated() ? inject(Router).createUrlTree(['/']) : true;
