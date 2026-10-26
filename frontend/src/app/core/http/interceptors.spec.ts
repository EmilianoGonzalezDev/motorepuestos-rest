import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ToastService } from '../ui/toast.service';
import { errorToastInterceptor, warmupInterceptor } from './interceptors';
import { ServerStatus } from './server-status';

const warming = { status: 503, statusText: 'Service Unavailable', headers: { 'Retry-After': '5' } };

describe('warmupInterceptor', () => {
  let http: HttpClient;
  let backend: HttpTestingController;
  let status: ServerStatus;
  let toast: ToastService;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([warmupInterceptor, errorToastInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpClient);
    backend = TestBed.inject(HttpTestingController);
    status = TestBed.inject(ServerStatus);
    toast = TestBed.inject(ToastService);
    vi.spyOn(toast, 'error');
  });

  afterEach(() => {
    backend.verify();
    vi.useRealTimers();
  });

  it('retries while the server warms up and then delivers the response', () => {
    let result: unknown;
    http.get('/api/catalog/categories').subscribe((r) => (result = r));

    backend.expectOne('/api/catalog/categories').flush({ code: 'app.warming_up' }, warming);
    expect(status.state()).toBe('warming');

    vi.advanceTimersByTime(5000);
    backend.expectOne('/api/catalog/categories').flush([{ id: 1 }]);

    expect(result).toEqual([{ id: 1 }]);
    expect(status.state()).toBe('ready');
    expect(toast.error).not.toHaveBeenCalled();
  });

  it('does not retry other server errors', () => {
    http.get('/api/catalog/categories').subscribe({ error: () => undefined });

    backend.expectOne('/api/catalog/categories').flush(null, { status: 503, statusText: 'Service Unavailable' });
    vi.advanceTimersByTime(15_000);

    backend.expectNone('/api/catalog/categories');
    expect(toast.error).toHaveBeenCalled();
  });

  it('reports an unavailable server without a toast', () => {
    http.get('/api/catalog/categories').subscribe({ error: () => undefined });

    backend.expectOne('/api/catalog/categories').flush({ code: 'app.unavailable' }, { status: 503, statusText: 'Service Unavailable' });

    expect(status.state()).toBe('unavailable');
    expect(toast.error).not.toHaveBeenCalled();
  });
});
