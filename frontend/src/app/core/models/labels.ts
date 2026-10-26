import { OrderStatus, PaymentType, UserRole } from './api.models';

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  Pending: 'Pendiente',
  Prepared: 'Preparado',
  Delivered: 'Entregado',
  Cancelled: 'Cancelado',
};

/** Tailwind classes for status badges (light + dark). */
export const ORDER_STATUS_STYLE: Record<OrderStatus, string> = {
  Pending: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
  Prepared: 'bg-sky-100 text-sky-800 dark:bg-sky-500/15 dark:text-sky-300',
  Delivered: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300',
  Cancelled: 'bg-zinc-200 text-zinc-700 dark:bg-zinc-500/20 dark:text-zinc-300',
};

export const ORDER_STATUS_COLOR: Record<OrderStatus, string> = {
  Pending: '#f59e0b',
  Prepared: '#0ea5e9',
  Delivered: '#10b981',
  Cancelled: '#a1a1aa',
};

export const ORDER_STATUSES: OrderStatus[] = ['Pending', 'Prepared', 'Delivered', 'Cancelled'];

export const PAYMENT_LABEL: Record<PaymentType, string> = {
  Store: 'Pago en el local',
  Card: 'Tarjeta de crédito/débito',
  BankTransfer: 'Transferencia bancaria',
};

export const ROLE_LABEL: Record<UserRole, string> = {
  Client: 'Cliente',
  Admin: 'Administrador',
  SuperAdmin: 'Super admin',
};
