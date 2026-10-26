import { Pipe, PipeTransform } from '@angular/core';
import { OrderStatus, PaymentType, UserRole } from '../core/models/api.models';
import { ORDER_STATUS_LABEL, PAYMENT_LABEL, ROLE_LABEL } from '../core/models/labels';

const arsFormatter = new Intl.NumberFormat('es-AR', {
  style: 'currency',
  currency: 'ARS',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

/** Argentine pesos without decimals: 24000 -> "$ 24.000". */
@Pipe({ name: 'ars' })
export class ArsPipe implements PipeTransform {
  transform(value: number | null | undefined): string {
    return value === null || value === undefined ? '' : arsFormatter.format(value);
  }
}

@Pipe({ name: 'orderStatus' })
export class OrderStatusPipe implements PipeTransform {
  transform(value: OrderStatus): string {
    return ORDER_STATUS_LABEL[value] ?? value;
  }
}

@Pipe({ name: 'payment' })
export class PaymentPipe implements PipeTransform {
  transform(value: PaymentType): string {
    return PAYMENT_LABEL[value] ?? value;
  }
}

@Pipe({ name: 'role' })
export class RolePipe implements PipeTransform {
  transform(value: UserRole): string {
    return ROLE_LABEL[value] ?? value;
  }
}

const relative = new Intl.RelativeTimeFormat('es-AR', { numeric: 'auto' });

/** "hace 3 horas", "ayer"... for order timelines and lists. */
@Pipe({ name: 'timeAgo' })
export class TimeAgoPipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (!value) return '';
    const seconds = Math.round((new Date(value).getTime() - Date.now()) / 1000);
    const abs = Math.abs(seconds);
    if (abs < 60) return relative.format(seconds, 'second');
    if (abs < 3600) return relative.format(Math.round(seconds / 60), 'minute');
    if (abs < 86400) return relative.format(Math.round(seconds / 3600), 'hour');
    if (abs < 2592000) return relative.format(Math.round(seconds / 86400), 'day');
    return relative.format(Math.round(seconds / 2592000), 'month');
  }
}
