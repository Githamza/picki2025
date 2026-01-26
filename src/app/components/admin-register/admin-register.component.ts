import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { Router } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { AuthService } from '../../services/auth.service';
import { VendorOnboardingService } from '../../services/vendor-onboarding.service';
import { ImportProgressDialogComponent } from './import-progress-dialog.component';

/**
 * Validator to check if two form controls have the same value.
 */
export const passwordMatchValidator: ValidatorFn = (
  control: AbstractControl
): ValidationErrors | null => {
  const password = control.get('password');
  const confirmPassword = control.get('confirmPassword');

  return password && confirmPassword && password.value !== confirmPassword.value
    ? { passwordMismatch: true }
    : null;
};

/**
 * Optional validator: if a value is provided, it must be a valid URL and look like an Uber Eats URL.
 */
export const optionalUberEatsUrlValidator: ValidatorFn = (
  control: AbstractControl
): ValidationErrors | null => {
  const raw = (control.value ?? '').toString().trim();
  if (!raw) return null;

  try {
    // eslint-disable-next-line no-new
    new URL(raw);
  } catch {
    return { invalidUrl: true };
  }

  if (!/ubereats\.com/i.test(raw)) {
    return { invalidUberEatsUrl: true };
  }

  return null;
};

@Component({
  selector: 'app-admin-register',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatToolbarModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatDialogModule,
  ],
  templateUrl: './admin-register.component.html',
  styleUrl: './admin-register.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminRegisterComponent {
  private readonly fb = inject(FormBuilder);
  private readonly onboarding = inject(VendorOnboardingService);
  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);
  private readonly snackBar = inject(MatSnackBar);
  private readonly dialog = inject(MatDialog);

  readonly hidePassword = signal(true);
  readonly hideConfirmPassword = signal(true);
  readonly isSubmitting = signal(false);
  readonly isScrapingUberEats = signal(false);
  readonly uberEatsProgress = signal<{ formatted: number; total: number } | null>(
    null
  );

  readonly form = this.fb.group(
    {
      businessName: ['', [Validators.required, Validators.minLength(2)]],
      uberEatsUrl: ['', [optionalUberEatsUrlValidator]],
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', [Validators.required]],
    },
    { validators: passwordMatchValidator }
  );

  async onSubmit(): Promise<void> {
    if (!this.form.valid || this.isSubmitting()) {
      this.form.markAllAsTouched();
      return;
    }

    let importDialogRef: MatDialogRef<ImportProgressDialogComponent> | null = null;
    this.isSubmitting.set(true);
    try {
      const businessName = this.form.controls.businessName.value ?? '';
      const firstName = this.form.controls.firstName.value ?? '';
      const lastName = this.form.controls.lastName.value ?? '';
      const email = this.form.controls.email.value ?? '';
      const password = this.form.controls.password.value ?? '';
      const uberEatsUrl = this.form.controls.uberEatsUrl.value ?? '';

      const hasUberEatsUrl = !!uberEatsUrl.trim();
      this.isScrapingUberEats.set(hasUberEatsUrl);
      this.uberEatsProgress.set(null);

      if (hasUberEatsUrl) {
        importDialogRef = this.dialog.open(ImportProgressDialogComponent, {
          disableClose: true,
        });
      }

      const result = await this.onboarding.createVendorAccount(
        {
          businessName,
          firstName,
          lastName,
          email,
          password,
          uberEatsUrl,
        },
        hasUberEatsUrl
          ? {
              onUberEatsProgress: (p) => {
                this.uberEatsProgress.set({
                  formatted: p.formattedCategories,
                  total: p.totalCategories,
                });
                importDialogRef?.componentInstance.setCategoryProgress(
                  p.formattedCategories,
                  p.totalCategories
                );
              },
            }
          : undefined
      );

      if (hasUberEatsUrl) {
        const source =
          result.catalogSource === 'ubereats'
            ? 'Menu importé depuis Uber Eats.'
            : 'Import Uber Eats échoué, menu de démarrage utilisé.';
        this.snackBar.open(source, 'OK', {
          duration: 7000,
          panelClass:
            result.catalogSource === 'ubereats'
              ? undefined
              : ['warning-snackbar'],
        });
      }

      // Sign in and let AuthService load vendor/admin context.
      await this.authService.login({ email, password, rememberMe: true });

      // Send them to the admin products list after successful account creation.
      await this.router.navigate(['/admin/product-manager']);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to create account';
      this.snackBar.open(message, 'Close', {
        duration: 6000,
        panelClass: ['error-snackbar'],
      });
    } finally {
      importDialogRef?.close();
      this.isSubmitting.set(false);
      this.isScrapingUberEats.set(false);
      this.uberEatsProgress.set(null);
    }
  }

  togglePasswordVisibility(): void {
    this.hidePassword.update((v) => !v);
  }

  toggleConfirmPasswordVisibility(): void {
    this.hideConfirmPassword.update((v) => !v);
  }

  goToLogin(): void {
    this.router.navigate(['/admin/login']);
  }
}
