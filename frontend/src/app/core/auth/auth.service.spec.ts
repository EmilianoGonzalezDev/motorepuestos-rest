import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { AuthResponse } from '../models/api.models';
import { AuthService } from './auth.service';

const response = (role: 'Client' | 'Admin' | 'SuperAdmin' = 'Client'): AuthResponse => ({
  accessToken: 'token-123',
  expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
  user: { id: 1, fullName: 'Juan Pérez', email: 'juan@example.com', role },
});

describe('AuthService', () => {
  let http: HttpTestingController;
  let auth: AuthService;

  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    auth = TestBed.inject(AuthService);
  });

  afterEach(() => {
    auth.endSession();
    http.verify();
  });

  it('does not call /refresh for first-time visitors', async () => {
    await auth.restoreSession();
    http.expectNone('/api/auth/refresh');
    expect(auth.isAuthenticated()).toBe(false);
  });

  it('restores the session through the refresh cookie when one existed', async () => {
    localStorage.setItem('mr_session', '1');

    const restored = auth.restoreSession();
    http.expectOne('/api/auth/refresh').flush(response());
    await restored;

    expect(auth.isAuthenticated()).toBe(true);
    expect(auth.accessToken).toBe('token-123');
  });

  it('keeps the token in memory only', () => {
    auth.login('juan@example.com', 'Demo1234!').subscribe();
    http.expectOne('/api/auth/login').flush(response());

    expect(JSON.stringify({ ...localStorage })).not.toContain('token-123');
    expect(auth.firstName()).toBe('Juan');
  });

  it('exposes role helpers', () => {
    auth.login('a@b.com', 'x').subscribe();
    http.expectOne('/api/auth/login').flush(response('SuperAdmin'));

    expect(auth.isStaff()).toBe(true);
    expect(auth.isSuperAdmin()).toBe(true);
  });

  it('clears the session on logout even if the API call fails', () => {
    auth.login('a@b.com', 'x').subscribe();
    http.expectOne('/api/auth/login').flush(response());

    auth.logout().subscribe();
    http.expectOne('/api/auth/logout').flush(null, { status: 500, statusText: 'Server Error' });

    expect(auth.isAuthenticated()).toBe(false);
    expect(localStorage.getItem('mr_session')).toBeNull();
  });

  it('shares a single refresh call between concurrent 401s', () => {
    auth.login('a@b.com', 'x').subscribe();
    http.expectOne('/api/auth/login').flush(response());

    const results: (string | null)[] = [];
    auth.refreshAccessToken().subscribe((t) => results.push(t));
    auth.refreshAccessToken().subscribe((t) => results.push(t));

    http.expectOne('/api/auth/refresh').flush({ ...response(), accessToken: 'token-456' });
    expect(results).toEqual(['token-456', 'token-456']);
  });
});
