import { ChangeDetectionStrategy, Component, ElementRef, forwardRef, signal, viewChild } from '@angular/core';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { Icon, IconName } from './icon';

interface ToolbarButton {
  icon: IconName;
  label: string;
  command: string;
  value?: string;
}

/**
 * Minimal WYSIWYG editor (contenteditable) used for product descriptions. The server sanitizes the
 * HTML against a whitelist, so this component only has to produce reasonable markup.
 */
@Component({
  selector: 'app-rich-text-editor',
  imports: [Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [{ provide: NG_VALUE_ACCESSOR, useExisting: forwardRef(() => RichTextEditor), multi: true }],
  template: `
    <div class="overflow-hidden rounded-xl border border-line bg-surface transition focus-within:border-brand-500 focus-within:ring-4 focus-within:ring-brand-500/15">
      <div class="flex flex-wrap gap-0.5 border-b border-line bg-surface-2 p-1.5">
        @for (b of buttons; track b.label) {
          <button type="button" class="grid size-8 place-items-center rounded-lg text-muted transition hover:bg-surface hover:text-fg"
                  [attr.aria-label]="b.label" [title]="b.label" (mousedown)="$event.preventDefault()" (click)="exec(b)" [disabled]="disabled()">
            <app-icon [name]="b.icon" [size]="16" />
          </button>
        }
      </div>
      <div #editor class="rich-text min-h-48 max-h-96 overflow-y-auto p-4 outline-none" contenteditable="true"
           [attr.contenteditable]="disabled() ? 'false' : 'true'" role="textbox" aria-multiline="true"
           (input)="onInput()" (blur)="onTouched()" (paste)="onPaste($event)"></div>
    </div>
  `,
})
export class RichTextEditor implements ControlValueAccessor {
  private readonly editor = viewChild.required<ElementRef<HTMLElement>>('editor');
  protected readonly disabled = signal(false);
  private onChange: (value: string) => void = () => undefined;
  protected onTouched: () => void = () => undefined;
  private pending: string | null = null;

  protected readonly buttons: ToolbarButton[] = [
    { icon: 'bold', label: 'Negrita', command: 'bold' },
    { icon: 'italic', label: 'Cursiva', command: 'italic' },
    { icon: 'underline', label: 'Subrayado', command: 'underline' },
    { icon: 'h3', label: 'Subtítulo', command: 'formatBlock', value: 'h3' },
    { icon: 'list', label: 'Lista', command: 'insertUnorderedList' },
    { icon: 'list-ordered', label: 'Lista numerada', command: 'insertOrderedList' },
  ];

  writeValue(value: string | null): void {
    const html = value ?? '';
    try {
      this.editor().nativeElement.innerHTML = html;
    } catch {
      // The view isn't ready yet (first writeValue happens before render): apply it afterwards.
      this.pending = html;
      queueMicrotask(() => this.flushPending());
    }
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled.set(isDisabled);
  }

  protected exec(button: ToolbarButton): void {
    this.editor().nativeElement.focus();
    document.execCommand(button.command, false, button.value);
    this.onInput();
  }

  protected onInput(): void {
    const el = this.editor().nativeElement;
    // An empty editor leaves "<br>" behind; treat it as empty so `required` works.
    const text = el.textContent?.trim() ?? '';
    this.onChange(text ? el.innerHTML : '');
  }

  /** Paste as plain text so no foreign styles/markup sneak in. */
  protected onPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const text = event.clipboardData?.getData('text/plain') ?? '';
    document.execCommand('insertText', false, text);
  }

  private flushPending(): void {
    if (this.pending !== null) {
      this.editor().nativeElement.innerHTML = this.pending;
      this.pending = null;
    }
  }
}
