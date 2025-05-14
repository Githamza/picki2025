import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { materialComponents } from '../../material.components';
import { BannerComponent } from '../banner/banner.component';
import { CategoryMenuComponent } from '../category-menu/category-menu.component';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { map } from 'rxjs/operators';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    ...materialComponents,
    BannerComponent,
    CategoryMenuComponent,
  ],
  templateUrl: './main-layout.component.html',
  styleUrls: ['./main-layout.component.scss'],
})
export class MainLayoutComponent {
  private breakpointObserver = inject(BreakpointObserver);

  // Use BreakpointObserver for responsive design (material design 3 way)
  isHandset$ = this.breakpointObserver
    .observe(Breakpoints.Handset)
    .pipe(map((result) => result.matches));

  menuOpened = true;

  toggleMenu() {
    this.menuOpened = !this.menuOpened;
  }

  // Theme toggling for MDC 3
  isDarkTheme = false;

  toggleTheme() {
    this.isDarkTheme = !this.isDarkTheme;
    if (this.isDarkTheme) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
  }
}
