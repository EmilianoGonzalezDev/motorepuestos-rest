import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DemoStatus } from '../models/api.models';
import { DemoStore } from './demo.store';

const status = (enabled: boolean): DemoStatus => ({
  enabled,
  password: enabled ? 'Demo1234!' : null,
  accounts: enabled ? [{ label: 'Cliente', email: 'cliente@motorepuestos.com' }] : [],
  lastResetAt: enabled ? '2026-10-26T12:00:00Z' : null,
  nextResetAt: enabled ? '2026-10-27T12:00:00Z' : null,
  resetIntervalHours: 24,
});

describe('DemoStore', () => {
  let http: HttpTestingController;
  let demo: DemoStore;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    http = TestBed.inject(HttpTestingController);
    demo = TestBed.inject(DemoStore);
  });

  afterEach(() => http.verify());

  it('recognizes demo accounts ignoring case', async () => {
    const loaded = demo.load();
    http.expectOne('/api/demo').flush(status(true));
    await loaded;

    expect(demo.enabled()).toBe(true);
    expect(demo.isDemoAccount('CLIENTE@motorepuestos.com')).toBe(true);
    expect(demo.isDemoAccount('otro@example.com')).toBe(false);
  });

  it('exposes nothing when demo mode is off', async () => {
    const loaded = demo.load();
    http.expectOne('/api/demo').flush(status(false));
    await loaded;

    expect(demo.enabled()).toBe(false);
    expect(demo.accounts()).toEqual([]);
    expect(demo.isDemoAccount('cliente@motorepuestos.com')).toBe(false);
  });

  it('stays disabled when the status cannot be loaded', async () => {
    const loaded = demo.load();
    http.expectOne('/api/demo').flush(null, { status: 503, statusText: 'Service Unavailable' });
    await loaded;

    expect(demo.enabled()).toBe(false);
  });
});
