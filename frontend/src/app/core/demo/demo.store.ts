import { HttpContext } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { DemoApi } from '../api/store.api';
import { AuthService } from '../auth/auth.service';
import { SILENT_ERRORS } from '../http/interceptors';
import { DemoStatus } from '../models/api.models';

/**
 * Public demo settings: the banner, the one-click login accounts and which accounts are read-only.
 * Everything stays hidden until the API confirms demo mode is on.
 */
@Injectable({ providedIn: 'root' })
export class DemoStore {
  private readonly api = inject(DemoApi);
  private readonly auth = inject(AuthService);

  readonly status = signal<DemoStatus | null>(null);
  readonly enabled = computed(() => this.status()?.enabled ?? false);
  readonly accounts = computed(() => (this.enabled() ? this.status()!.accounts : []));
  readonly password = computed(() => this.status()?.password ?? null);
  readonly lastResetAt = computed(() => this.status()?.lastResetAt ?? null);
  readonly resetIntervalHours = computed(() => this.status()?.resetIntervalHours ?? 24);
  readonly isCurrentUserDemo = computed(() => this.isDemoAccount(this.auth.user()?.email));

  isDemoAccount(email: string | null | undefined): boolean {
    if (!email) return false;
    const normalized = email.toLowerCase();
    return this.accounts().some((a) => a.email.toLowerCase() === normalized);
  }

  /** Never throws: without the status the app simply behaves as a regular store. */
  async load(): Promise<void> {
    try {
      this.status.set(await firstValueFrom(this.api.status(new HttpContext().set(SILENT_ERRORS, true))));
    } catch {
      /* keep the previous status */
    }
  }
}
