import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';

export interface BarDatum {
  label: string;
  value: number;
  hint?: string;
}

/** Dependency-free responsive bar chart (SVG) with hover tooltip. */
@Component({
  selector: 'app-bar-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'relative block' },
  template: `
    <svg [attr.viewBox]="'0 0 ' + width + ' ' + height" class="h-auto w-full overflow-visible" role="img" [attr.aria-label]="ariaLabel()">
      @for (g of gridLines(); track g.y) {
        <line [attr.x1]="0" [attr.x2]="width" [attr.y1]="g.y" [attr.y2]="g.y" class="stroke-line" stroke-dasharray="3 4" />
        <text [attr.x]="0" [attr.y]="g.y - 4" class="fill-muted text-[10px]">{{ g.label }}</text>
      }
      @for (b of bars(); track b.label; let i = $index) {
        <rect [attr.x]="b.x" [attr.y]="b.y" [attr.width]="b.w" [attr.height]="b.h" rx="3"
              class="cursor-pointer transition-opacity" [class]="active() === i ? 'fill-brand-600' : 'fill-brand-500/70'"
              (mouseenter)="active.set(i)" (mouseleave)="active.set(-1)" />
        @if (b.showLabel) {
          <text [attr.x]="b.x + b.w / 2" [attr.y]="height + 14" text-anchor="middle" class="fill-muted text-[10px]">{{ b.label }}</text>
        }
      }
    </svg>
    @if (active() >= 0) {
      @let d = data()[active()];
      <div class="pointer-events-none absolute -top-2 rounded-lg bg-zinc-900 px-2.5 py-1.5 text-xs text-white shadow-lg"
           [style.left.%]="(bars()[active()].x + bars()[active()].w / 2) / width * 100" style="transform: translate(-50%, -100%)">
        <p class="font-semibold">{{ d.hint ?? d.label }}</p>
        <p>{{ format()(d.value) }}</p>
      </div>
    }
  `,
})
export class BarChart {
  readonly data = input.required<BarDatum[]>();
  readonly format = input<(value: number) => string>((v) => v.toLocaleString('es-AR'));
  readonly ariaLabel = input('Gráfico de barras');

  protected readonly width = 600;
  protected readonly height = 180;
  protected readonly active = signal(-1);

  private readonly max = computed(() => Math.max(1, ...this.data().map((d) => d.value)));

  protected readonly bars = computed(() => {
    const data = this.data();
    const slot = this.width / Math.max(1, data.length);
    const every = Math.ceil(data.length / 10);
    return data.map((d, i) => {
      const h = (d.value / this.max()) * (this.height - 10);
      return {
        label: d.label,
        x: i * slot + slot * 0.15,
        w: slot * 0.7,
        h: Math.max(h, d.value > 0 ? 2 : 0),
        y: this.height - Math.max(h, d.value > 0 ? 2 : 0),
        showLabel: i % every === 0,
      };
    });
  });

  protected readonly gridLines = computed(() =>
    [0.5, 1].map((f) => ({ y: this.height - f * (this.height - 10), label: this.format()(Math.round(this.max() * f)) })),
  );
}

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

@Component({
  selector: 'app-donut-chart',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="flex items-center gap-6">
      <svg viewBox="0 0 42 42" class="size-36 shrink-0 -rotate-90">
        <circle cx="21" cy="21" r="15.915" fill="none" stroke-width="6" class="stroke-surface-2" />
        @for (s of segments(); track s.label) {
          <circle cx="21" cy="21" r="15.915" fill="none" stroke-width="6" [attr.stroke]="s.color"
                  [attr.stroke-dasharray]="s.dash" [attr.stroke-dashoffset]="s.offset" />
        }
      </svg>
      <ul class="space-y-2 text-sm">
        @for (s of data(); track s.label) {
          <li class="flex items-center gap-2">
            <span class="size-2.5 rounded-full" [style.background]="s.color"></span>
            <span class="text-muted">{{ s.label }}</span>
            <span class="font-semibold">{{ s.value }}</span>
          </li>
        }
      </ul>
    </div>
  `,
})
export class DonutChart {
  readonly data = input.required<DonutSlice[]>();

  protected readonly segments = computed(() => {
    const total = this.data().reduce((sum, s) => sum + s.value, 0) || 1;
    let accumulated = 0;
    return this.data()
      .filter((s) => s.value > 0)
      .map((s) => {
        const pct = (s.value / total) * 100;
        const segment = { label: s.label, color: s.color, dash: `${pct} ${100 - pct}`, offset: -accumulated };
        accumulated += pct;
        return segment;
      });
  });
}
