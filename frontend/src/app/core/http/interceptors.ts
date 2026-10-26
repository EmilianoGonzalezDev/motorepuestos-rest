import { HttpContextToken, HttpErrorResponse, HttpInterceptorFn, HttpRequest, HttpResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, retry, switchMap, tap, throwError, timer } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { GuestCartId } from '../auth/guest-cart-id';
import { ToastService } from '../ui/toast.service';
import { ServerStatus } from './server-status';

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

const MAX_WARMUP_RETRIES = 40;

function problemCode(error: unknown): string | undefined {
  return error instanceof HttpErrorResponse && error.status === 503 ? (error.error as { code?: string } | null)?.code : undefined;
}

/** The server is starting (database resuming): the request was not processed and can be retried. */
export const isWarmingUp = (error: unknown): boolean => problemCode(error) === 'app.warming_up';

/** The server gave up waiting for the database (e.g. the free monthly quota is exhausted). */
export const isUnavailable = (error: unknown): boolean => problemCode(error) === 'app.unavailable';

/** Retry-After in milliseconds, kept between 2 and 15 seconds. */
export function retryDelayMs(error: HttpErrorResponse): number {
  const seconds = Number(error.headers.get('Retry-After'));
  return Math.min(Math.max(Number.isFinite(seconds) && seconds > 0 ? seconds : 5, 2), 15) * 1000;
}

/**
 * While the API is waking up it answers 503 "app.warming_up" before running anything, so the request
 * is retried transparently (writes included) and the warm-up overlay is shown in the meantime.
 */
export const warmupInterceptor: HttpInterceptorFn = (req, next) => {
  if (!req.url.startsWith('/api/')) return next(req);

  const status = inject(ServerStatus);
  return next(req).pipe(
    retry({
      count: MAX_WARMUP_RETRIES,
      delay: (error: unknown) => {
        if (!isWarmingUp(error)) return throwError(() => error);
        status.markWarming();
        return timer(retryDelayMs(error as HttpErrorResponse));
      },
    }),
    tap({
      next: (event) => {
        if (event instanceof HttpResponse) status.markReady();
      },
      error: (error: unknown) => {
        if (isUnavailable(error)) status.markUnavailable();
        else if (error instanceof HttpErrorResponse && error.status !== 0 && !isWarmingUp(error)) status.markReady();
      },
    }),
  );
};

/** Shows a toast for connectivity problems and server errors (4xx are handled by each screen). */
export const errorToastInterceptor: HttpInterceptorFn = (req, next) => {
  const toast = inject(ToastService);
  return next(req).pipe(
    catchError((error: unknown) => {
      // Warm-up states have their own full-screen notice.
      if (isWarmingUp(error) || isUnavailable(error)) return throwError(() => error);
      if (error instanceof HttpErrorResponse && !req.context.get(SILENT_ERRORS)) {
        if (error.status === 0) toast.error('Sin conexión', 'No se pudo contactar al servidor.');
        else if (error.status >= 500) toast.error('Error del servidor', 'Intentá nuevamente en unos minutos.');
        else if (error.status === 429) toast.warning('Demasiados intentos', 'Esperá un minuto e intentá nuevamente.');
      }
      return throwError(() => error);
    }),
  );
};
