import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { ViewTransitionNameDirective } from './view-transition-name.directive';

@Component({
  standalone: true,
  imports: [ViewTransitionNameDirective],
  template: `<div [appViewTransitionName]="name"></div>`,
})
class HostComponent {
  name = 'product-grid';
}

describe('ViewTransitionNameDirective', () => {
  it('sets view-transition-name on the host element', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const div: HTMLElement = fixture.nativeElement.querySelector('div');
    expect(div.style.getPropertyValue('view-transition-name')).toBe(
      'product-grid'
    );
  });

  it('updates when the bound name changes', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    fixture.componentInstance.name = 'product-add';
    fixture.detectChanges();
    const div: HTMLElement = fixture.nativeElement.querySelector('div');
    expect(div.style.getPropertyValue('view-transition-name')).toBe(
      'product-add'
    );
  });
});
