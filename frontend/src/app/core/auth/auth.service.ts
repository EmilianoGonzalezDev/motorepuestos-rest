import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, Subject, catchError, finalize, map, of, shareReplay, tap } from 'rxjs';
import { AuthApi } from '../api/store.api';
import { AuthResponse, User } from '../models/api.models';

interface Session {
  token: string;
  expiresAt: number;
  user: User;
}

const SESSION_MARKER = 'mr_session';

export type AuthEvent = 'login' | 'logout' | 'restored';

/**
 * Holds the session in memory only: the access token never touches localStorage (XSS-safe) and
 * the refresh token lives in an HttpOnly cookie. On reload the session is restored with /refresh.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(AuthApi);
  private readonly session = signal<Session | null>(null);
  private readonly events = new Subject<AuthEvent>();
  private refreshTimer: ReturnType<typeof setTimeout> | undefined;
  private refreshInFlight: Observable<string | null> | null = null;

  readonly events$ = this.events.asObservable();
  readonly user = computed(() => this.session()?.user ?? null);
  readonly isAuthenticated = computed(() => this.session() !== null);
  readonly isStaff = computed(() => ['Admin', 'SuperAdmin'].includes(this.session()?.user.role ?? ''));
  readonly isSuperAdmin = computed(() => this.session()?.user.role === 'SuperAdmin');
  readonly firstName = computed(() => this.user()?.fullName.split(' ')[0] ?? '');

  get accessToken(): string | null {
    return this.session()?.token ?? null;
  }

  /** Runs once at startup (app initializer): silently signs in using the refresh cookie. */
  restoreSession(): Promise<void> {
    // First-time visitors have no refresh cookie: skip the call instead of logging a 401 in the console.
    if (!this.hadSession()) {
      this.events.next('restored');
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      this.api.refresh().subscribe({
        next: (res) => {
          this.setSession(res);
          this.events.next('restored');
          resolve();
        },
        error: () => {
          this.events.next('restored');
          resolve();
        },
      });
    });
  }

  login(email: string, password: string): Observable<User> {
    return this.api.login(email, password).pipe(
      tap((res) => {
        this.setSession(res);
        this.events.next('login');
      }),
      map((res) => res.user),
    );
  }

  register(fullName: string, email: string, password: string): Observable<User> {
    return this.api.register(fullName, email, password).pipe(
      tap((res) => {
        this.setSession(res);
        this.events.next('login');
      }),
      map((res) => res.user),
    );
  }

  logout(): Observable<void> {
    return this.api.logout().pipe(
      catchError(() => of(undefined)),
      finalize(() => this.endSession()),
      map(() => undefined),
    );
  }

  /** Clears the local session (e.g. when the refresh token is rejected). */
  endSession(): void {
    if (!this.session()) return;
    clearTimeout(this.refreshTimer);
    this.session.set(null);
    this.markSession(false);
    this.events.next('logout');
  }

  updateUser(user: User): void {
    this.session.update((s) => (s ? { ...s, user } : s));
  }

  /**
   * Single-flight refresh: concurrent 401s share one /refresh call. Emits the new access token
   * or null when the session can't be renewed.
   */
  refreshAccessToken(): Observable<string | null> {
    this.refreshInFlight ??= this.api.refresh().pipe(
      tap((res) => this.setSession(res)),
      map((res) => res.accessToken),
      catchError(() => {
        this.endSession();
        return of(null);
      }),
      finalize(() => (this.refreshInFlight = null)),
      shareReplay(1),
    );
    return this.refreshInFlight;
  }

  private setSession(res: AuthResponse): void {
    const expiresAt = new Date(res.expiresAt).getTime();
    this.session.set({ token: res.accessToken, expiresAt, user: res.user });
    this.markSession(true);
    this.scheduleRefresh(expiresAt);
  }

  /** Non-sensitive flag ("a refresh cookie probably exists"); the tokens themselves never touch storage. */
  private markSession(active: boolean): void {
    try {
      if (active) localStorage.setItem(SESSION_MARKER, '1');
      else localStorage.removeItem(SESSION_MARKER);
    } catch {
      /* storage unavailable */
    }
  }

  private hadSession(): boolean {
    try {
      return localStorage.getItem(SESSION_MARKER) === '1';
    } catch {
      return true;
    }
  }

  /** Renews the access token one minute before it expires so requests rarely hit a 401. */
  private scheduleRefresh(expiresAt: number): void {
    clearTimeout(this.refreshTimer);
    const delay = Math.max(expiresAt - Date.now() - 60_000, 5_000);
    this.refreshTimer = setTimeout(() => this.refreshAccessToken().subscribe(), delay);
  }
}
