import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { materialComponents } from '../../material.components';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-example-page',
  standalone: true,
  imports: [CommonModule, FormsModule, ...materialComponents],
  template: `
    <div class="example-page-container">
      <h1 class="mat-headline-4">Material 3 Components</h1>

      <section>
        <h2 class="mat-headline-5">Buttons</h2>
        <div class="button-row">
          <button mat-button>Basic</button>
          <button mat-raised-button color="primary">Primary</button>
          <button mat-flat-button color="accent">Accent</button>
          <button mat-stroked-button color="warn">Warn</button>
        </div>

        <div class="button-row">
          <button mat-fab color="primary" aria-label="Example icon button">
            <mat-icon class="material-symbols-rounded">add</mat-icon>
          </button>
          <button mat-mini-fab color="accent" aria-label="Example icon button">
            <mat-icon class="material-symbols-rounded">favorite</mat-icon>
          </button>
          <button mat-icon-button color="warn" aria-label="Example icon button">
            <mat-icon class="material-symbols-rounded">delete</mat-icon>
          </button>
        </div>
      </section>

      <section>
        <h2 class="mat-headline-5">Form Fields</h2>
        <div class="form-fields-row">
          <mat-form-field appearance="outline">
            <mat-label>Outline form field</mat-label>
            <input matInput placeholder="Placeholder" />
            <mat-hint>Hint</mat-hint>
          </mat-form-field>

          <mat-form-field appearance="fill">
            <mat-label>Fill form field</mat-label>
            <input matInput placeholder="Placeholder" />
            <mat-icon matSuffix class="material-symbols-rounded"
              >sentiment_very_satisfied</mat-icon
            >
          </mat-form-field>
        </div>
      </section>

      <section>
        <h2 class="mat-headline-5">Cards</h2>
        <div class="cards-row">
          <mat-card class="example-card mat-elevation-z2">
            <mat-card-header>
              <div mat-card-avatar class="example-header-image"></div>
              <mat-card-title>Material Design 3</mat-card-title>
              <mat-card-subtitle>Card Subtitle</mat-card-subtitle>
            </mat-card-header>
            <mat-card-content>
              <p>
                This is a card showing the Material Design 3 styling with more
                rounded corners and updated elevation.
              </p>
            </mat-card-content>
            <mat-card-actions>
              <button mat-button>LIKE</button>
              <button mat-button>SHARE</button>
            </mat-card-actions>
          </mat-card>

          <mat-card class="example-card mat-elevation-z3 mat-rounded-large">
            <mat-card-header>
              <mat-card-title-group>
                <mat-card-title>Custom Rounded Card</mat-card-title>
                <mat-card-subtitle>Extra large radius</mat-card-subtitle>
              </mat-card-title-group>
            </mat-card-header>
            <mat-card-content>
              <p>
                This card has custom large rounded corners using the
                mat-rounded-large class.
              </p>
            </mat-card-content>
            <mat-card-actions align="end">
              <button mat-button>ACTION</button>
            </mat-card-actions>
          </mat-card>
        </div>
      </section>

      <section>
        <h2 class="mat-headline-5">Sliders & Toggles</h2>
        <div class="toggles-row">
          <mat-slide-toggle color="primary" [checked]="true"
            >Primary Toggle</mat-slide-toggle
          >
          <mat-slide-toggle color="accent" [checked]="true"
            >Accent Toggle</mat-slide-toggle
          >
          <mat-slide-toggle color="warn" [checked]="true"
            >Warn Toggle</mat-slide-toggle
          >
        </div>
      </section>
    </div>
  `,
  styles: [
    `
      .example-page-container {
        padding: 16px;
      }

      section {
        margin-bottom: 40px;
      }

      .button-row {
        display: flex;
        gap: 16px;
        margin-bottom: 16px;
        flex-wrap: wrap;
      }

      .form-fields-row {
        display: flex;
        gap: 16px;
        margin-bottom: 16px;
        flex-wrap: wrap;
      }

      .cards-row {
        display: flex;
        gap: 16px;
        margin-bottom: 16px;
        flex-wrap: wrap;
      }

      .toggles-row {
        display: flex;
        gap: 24px;
        margin-bottom: 16px;
        flex-wrap: wrap;
      }

      mat-form-field {
        min-width: 250px;
      }

      .example-card {
        max-width: 350px;
        width: 100%;
      }

      .example-header-image {
        background-image: url('https://material.io/favicon.ico');
        background-size: cover;
      }

      .mat-headline-4 {
        margin-bottom: 32px;
      }

      .mat-headline-5 {
        margin-bottom: 16px;
        border-bottom: 1px solid var(--mat-outline-variant);
        padding-bottom: 8px;
      }

      /* Responsive adjustments */
      @media (max-width: 768px) {
        .button-row,
        .form-fields-row,
        .cards-row,
        .toggles-row {
          flex-direction: column;
          gap: 12px;
        }

        .example-card {
          max-width: 100%;
        }
      }
    `,
  ],
})
export class ExamplePageComponent {}
