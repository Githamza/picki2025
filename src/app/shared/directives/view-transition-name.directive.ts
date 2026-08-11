import { Directive, ElementRef, effect, inject, input } from '@angular/core';

/**
 * Assigns a `view-transition-name` to the host element (SPEC.md FR3).
 *
 * Replaces inline `style="view-transition-name: ..."` so names are
 * declared uniformly and greppable. Setting the property where the View
 * Transitions API is unsupported is inert — navigation simply doesn't
 * animate, which is the required fallback.
 */
@Directive({
  selector: '[appViewTransitionName]',
  standalone: true,
})
export class ViewTransitionNameDirective {
  private readonly el = inject<ElementRef<HTMLElement>>(ElementRef);

  readonly appViewTransitionName = input.required<string>();

  constructor() {
    effect(() => {
      this.el.nativeElement.style.setProperty(
        'view-transition-name',
        this.appViewTransitionName()
      );
    });
  }
}
