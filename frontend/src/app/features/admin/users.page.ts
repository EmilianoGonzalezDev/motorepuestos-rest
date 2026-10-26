import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { catchError, debounceTime, of, startWith, switchMap } from 'rxjs';
import { AdminApi } from '../../core/api/admin.api';
import { AuthService } from '../../core/auth/auth.service';
import { DemoStore } from '../../core/demo/demo.store';
import { applyServerErrors, errorMessage } from '../../core/http/http-utils';
import { UserAdmin, UserRole } from '../../core/models/api.models';
import { ConfirmService } from '../../core/ui/confirm.service';
import { ToastService } from '../../core/ui/toast.service';
import { Icon } from '../../shared/components/icon';
import { EmptyState, FieldError, Modal, Pagination, Spinner } from '../../shared/components/ui';
import { RolePipe, TimeAgoPipe } from '../../shared/pipes';
import { passwordStrength } from '../../shared/validators';

@Component({
  selector: 'app-admin-users-page',
  imports: [DatePipe, FormsModule, ReactiveFormsModule, Icon, Modal, EmptyState, FieldError, Pagination, Spinner, RolePipe, TimeAgoPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div><h1 class="text-4xl font-extrabold uppercase">Usuarios</h1><p class="text-sm text-muted">Clientes y administradores</p></div>
      @if (auth.isSuperAdmin()) {
        <button class="btn btn-primary" (click)="openForm()"><app-icon name="user-plus" [size]="16" /> Nuevo administrador</button>
      }
    </div>

    <div class="card mb-5 grid gap-3 p-4 sm:grid-cols-[1fr_200px]">
      <div class="relative">
        <app-icon name="search" class="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-muted" />
        <input class="input pl-10" placeholder="Buscar por nombre o email…" [ngModel]="search()" (ngModelChange)="search.set($event); page.set(1)" />
      </div>
      <select class="input" [ngModel]="role()" (ngModelChange)="role.set($event); page.set(1)">
        <option [ngValue]="null">Todos los roles</option><option value="Client">Clientes</option>
        <option value="Admin">Administradores</option><option value="SuperAdmin">Super admin</option>
      </select>
    </div>

    @if (result(); as r) {
      @if (r === 'error') {
        <div class="card"><app-empty-state icon="circle-alert" title="No pudimos cargar los usuarios" /></div>
      } @else if (r.items.length === 0) {
        <div class="card"><app-empty-state icon="users" title="No hay usuarios" /></div>
      } @else {
        <div class="card overflow-x-auto">
          <table class="table-base min-w-[760px]">
            <thead><tr><th>Usuario</th><th>Rol</th><th class="text-center">Pedidos</th><th>Alta</th><th>Último acceso</th><th>Estado</th><th></th></tr></thead>
            <tbody>
              @for (u of r.items; track u.id) {
                <tr [class.opacity-60]="!u.isActive">
                  <td>
                    <div class="flex items-center gap-3">
                      <span class="grid size-9 place-items-center rounded-full bg-brand-500/15 text-sm font-bold text-brand-700 dark:text-brand-300">{{ u.fullName.charAt(0) }}</span>
                      <div>
                        <p class="font-medium">
                          {{ u.fullName }}
                          @if (demo.isDemoAccount(u.email)) { <span class="badge ml-1 bg-amber-500/15 text-amber-700 dark:text-amber-300" title="Cuenta demo protegida">Demo</span> }
                        </p>
                        <p class="text-xs text-muted">{{ u.email }}</p>
                      </div>
                    </div>
                  </td>
                  <td><span class="badge" [class]="u.role === 'Client' ? 'bg-surface-2' : 'bg-brand-500/10 text-brand-700 dark:text-brand-300'">{{ u.role | role }}</span></td>
                  <td class="text-center text-muted">{{ u.ordersCount }}</td>
                  <td class="text-muted">{{ u.createdAt | date: 'dd/MM/yy' }}</td>
                  <td class="text-muted">{{ u.lastLoginAt ? (u.lastLoginAt | timeAgo) : 'Nunca' }}</td>
                  <td><span class="badge" [class]="u.isActive ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'bg-red-500/10 text-red-700 dark:text-red-300'">{{ u.isActive ? 'Activo' : 'Deshabilitado' }}</span></td>
                  <td class="text-right">
                    @if (auth.isSuperAdmin() && u.role !== 'SuperAdmin' && u.id !== auth.user()?.id && !(u.isActive && demo.isDemoAccount(u.email))) {
                      <button class="btn-icon size-9" (click)="toggle(u)" [attr.aria-label]="u.isActive ? 'Deshabilitar' : 'Habilitar'"><app-icon [name]="u.isActive ? 'ban' : 'check'" [size]="16" /></button>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
        <div class="mt-4"><app-pagination [page]="r.page" [totalPages]="r.totalPages" (pageChange)="page.set($event)" /></div>
      }
    } @else {
      <div class="space-y-2">@for (i of [1, 2, 3, 4, 5]; track i) { <div class="skeleton h-14"></div> }</div>
    }

    @if (formOpen()) {
      <app-modal title="Nuevo administrador" (closed)="formOpen.set(false)">
        <form [formGroup]="form" (ngSubmit)="save()" class="space-y-4">
          <div><label class="label" for="a-name">Nombre completo</label><input id="a-name" class="input" formControlName="fullName" maxlength="150" /><app-field-error [control]="form.controls.fullName" /></div>
          <div><label class="label" for="a-email">Email</label><input id="a-email" type="email" class="input" formControlName="email" maxlength="150" /><app-field-error [control]="form.controls.email" /></div>
          <div><label class="label" for="a-pass">Contraseña inicial</label><input id="a-pass" type="password" class="input" formControlName="password" autocomplete="new-password" /><app-field-error [control]="form.controls.password" /></div>
          <div class="flex justify-end gap-2">
            <button type="button" class="btn btn-secondary" (click)="formOpen.set(false)">Cancelar</button>
            <button class="btn btn-primary" [disabled]="saving()">@if (saving()) { <app-spinner [size]="15" /> } Crear administrador</button>
          </div>
        </form>
      </app-modal>
    }
  `,
})
export class AdminUsersPage {
  private readonly api = inject(AdminApi);
  private readonly toast = inject(ToastService);
  private readonly confirm = inject(ConfirmService);
  protected readonly auth = inject(AuthService);
  protected readonly demo = inject(DemoStore);

  protected readonly search = signal('');
  protected readonly role = signal<UserRole | null>(null);
  protected readonly page = signal(1);
  private readonly reload = signal(0);
  protected readonly formOpen = signal(false);
  protected readonly saving = signal(false);

  protected readonly form = inject(NonNullableFormBuilder).group({
    fullName: ['', [Validators.required, Validators.maxLength(150)]],
    email: ['', [Validators.required, Validators.email, Validators.maxLength(150)]],
    password: ['', [Validators.required, passwordStrength]],
  });

  private readonly query = computed(() => ({ page: this.page(), pageSize: 10, search: this.search().trim() || null, role: this.role(), reload: this.reload() }));

  protected readonly result = toSignal(
    toObservable(this.query).pipe(
      debounceTime(250),
      switchMap(({ reload: _reload, ...q }) =>
        this.api.users(q).pipe(
          catchError(() => of('error' as const)),
          startWith(undefined),
        ),
      ),
    ),
  );

  protected openForm(): void {
    this.form.reset();
    this.formOpen.set(true);
  }

  protected save(): void {
    if (this.form.invalid) return this.form.markAllAsTouched();
    this.saving.set(true);
    const { fullName, email, password } = this.form.getRawValue();

    this.api.createAdmin(fullName, email, password).subscribe({
      next: () => {
        this.saving.set(false);
        this.formOpen.set(false);
        this.reload.update((n) => n + 1);
        this.toast.success('Administrador creado');
      },
      error: (err) => {
        this.saving.set(false);
        if (!applyServerErrors(this.form, err)) this.toast.error('No se pudo crear', errorMessage(err));
        else if (err?.error?.code === 'auth.email_taken') this.form.controls.email.setErrors({ server: errorMessage(err) });
      },
    });
  }

  protected async toggle(u: UserAdmin): Promise<void> {
    const next = !u.isActive;
    if (!next && !(await this.confirm.confirm({
      title: `¿Deshabilitar a ${u.fullName}?`,
      message: 'No podrá iniciar sesión y se cerrarán sus sesiones activas.',
      confirmText: 'Deshabilitar',
      danger: true,
    }))) return;

    this.api.setUserStatus(u.id, next).subscribe({
      next: () => {
        this.toast.success(next ? 'Usuario habilitado' : 'Usuario deshabilitado');
        this.reload.update((n) => n + 1);
      },
      error: (err) => this.toast.error('No se pudo actualizar', errorMessage(err)),
    });
  }
}
