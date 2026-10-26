import { HttpContextToken, HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { GuestCartId } from '../auth/guest-cart-id';
import { ToastService } from '../ui/toast.service';

/** Opt-out flag for requests whose errors are handled (and shown) by the caller. */
export const SILENT_ERRORS = new HttpContextToken<boolean>(() => false);

const AUTH_ENDPOINTS = ['/api/auth/login', '/api/auth/register', '/api/auth/refresh', '/api/auth/logout'];

function withAuth(req: HttpRequest<unknown>, token: string | null): HttpRequest<unknown> {
  return token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;
}

/**
 * Adds the bearer token and the guest cart id. On a 401 it refreshes the access token once
 * (shared between concurrent requests) and retries the original request.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith('/api/')) return next(req);

  const auth = inject(AuthService);
  const guestCart = inject(GuestCartId);

  // Signed-in users are identified by their token; only guests need the anonymous cart id.
  if (req.url.startsWith('/api/cart') && !auth.isAuthenticated()) {
    req = req.clone({ setHeaders: { 'X-Cart-Id': guestCart.value } });
  }

  if (AUTH_ENDPOINTS.some((url) => req.url.startsWith(url))) return next(req);

  const token = auth.accessToken;
  return next(withAuth(req, token)).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401 || !token) {
        return throwError(() => error);
      }
      return auth.refreshAccessToken().pipe(
        switchMap((newToken) => (newToken ? next(withAuth(req, newToken)) : throwError(() => error))),
      );
    }),
  );
};

/** Shows a toast for connectivity problems and server errors (4xx are handled by each screen). */
export const errorToastInterceptor: HttpInterceptorFn = (req, next) => {
  const toast = inject(ToastService);
  return next(req).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && !req.context.get(SILENT_ERRORS)) {
        if (error.status === 0) toast.error('Sin conexión', 'No se pudo contactar al servidor.');
        else if (error.status >= 500) toast.error('Error del servidor', 'Intentá nuevamente en unos minutos.');
        else if (error.status === 429) toast.warning('Demasiados intentos', 'Esperá un minuto e intentá nuevamente.');
      }
      return throwError(() => error);
    }),
  );
};
