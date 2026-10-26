import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ConfirmDialog, ToastHost } from './shared/components/overlays';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ToastHost, ConfirmDialog],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <router-outlet />
    <app-toast-host />
    <app-confirm-dialog />
  `,
})
export class App {}
