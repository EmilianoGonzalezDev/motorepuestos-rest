import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { OrderDetail, OrderStatus } from '../../core/models/api.models';
import { ORDER_STATUS_LABEL } from '../../core/models/labels';
import { Icon, IconName } from './icon';

const STEPS: { status: OrderStatus; icon: IconName; hint: string }[] = [
  { status: 'Pending', icon: 'receipt', hint: 'Recibimos tu pedido' },
  { status: 'Prepared', icon: 'package-check', hint: 'Listo para retirar' },
  { status: 'Delivered', icon: 'circle-check', hint: 'Retirado en el local' },
];

/** Tracking stepper (Pending → Prepared → Delivered) plus the full status history. */
@Component({
  selector: 'app-order-timeline',
  imports: [DatePipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (order().status === 'Cancelled') {
      <div class="flex items-center gap-3 rounded-2xl bg-zinc-500/10 p-4">
        <app-icon name="ban" [size]="22" class="text-zinc-500" />
        <div><p class="font-semibold">Pedido cancelado</p><p class="text-sm text-muted">El stock de los productos fue repuesto.</p></div>
      </div>
    } @else {
      <ol class="grid grid-cols-3">
        @for (step of steps; track step.status; let i = $index) {
          <li class="relative flex flex-col items-center text-center">
            @if (i > 0) {
              <span class="absolute top-5 right-1/2 h-1 w-full -translate-y-1/2 rounded"
                    [class]="i <= currentIndex() ? 'bg-brand-500' : 'bg-surface-2'"></span>
            }
            <span class="relative z-10 grid size-10 place-items-center rounded-full border-2 transition"
                  [class]="i <= currentIndex() ? 'border-brand-500 bg-brand-500 text-white' : 'border-line bg-surface text-muted'">
              <app-icon [name]="step.icon" [size]="18" />
            </span>
            <span class="mt-2 text-sm font-semibold" [class.text-muted]="i > currentIndex()">{{ label[step.status] }}</span>
            <span class="text-xs text-muted">{{ step.hint }}</span>
          </li>
        }
      </ol>
    }

    <h3 class="mt-8 mb-3 text-lg font-bold uppercase">Historial</h3>
    <ol class="relative space-y-4 border-l-2 border-line pl-6">
      @for (h of history(); track $index) {
        <li class="relative">
          <span class="absolute top-1 -left-[31px] size-3.5 rounded-full border-2 border-surface bg-brand-500"></span>
          <p class="text-sm font-semibold">{{ label[h.status] }}
            <span class="font-normal text-muted">· {{ h.changedAt | date: 'dd/MM/yyyy HH:mm' }}</span></p>
          @if (h.note || h.changedBy) {
            <p class="text-sm text-muted">{{ h.note }}@if (h.note && h.changedBy) { · }@if (h.changedBy) { por {{ h.changedBy }} }</p>
          }
        </li>
      }
    </ol>
  `,
})
export class OrderTimeline {
  readonly order = input.required<OrderDetail>();
  protected readonly steps = STEPS;
  protected readonly label = ORDER_STATUS_LABEL;
  protected readonly currentIndex = computed(() => STEPS.findIndex((s) => s.status === this.order().status));
  protected readonly history = computed(() => [...this.order().history].reverse());
}
