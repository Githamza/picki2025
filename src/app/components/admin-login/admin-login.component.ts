import {
  Component,
  inject,
  signal,
  computed,
  OnInit,
  OnDestroy,
  ChangeDetectionStrategy,
  effect,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
} from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatToolbarModule } from '@angular/material/toolbar';
import { AuthService } from '../../services/auth.service';
import { VendorService } from '../../services/vendor.service';
import { LoginFormData } from '../../models/auth.models';

@Component({
  selector: 'app-admin-login',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatToolbarModule,
  ],
  templateUrl: './admin-login.component.html',
  styleUrl: './admin-login.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminLoginComponent implements OnInit, OnDestroy {
  private readonly authService = inject(AuthService);
  private readonly vendorService = inject(VendorService);
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly snackBar = inject(MatSnackBar);

  // Reactive signals
  readonly authState = this.authService.authState;
  readonly isLoading = computed(() => this.authState().isLoading);
  readonly error = computed(() => this.authState().error);

  // Form and UI state
  readonly hidePassword = signal(true);
  readonly loginForm: FormGroup;
  readonly currentVendor = this.vendorService.getCurrentVendor();

  constructor() {
    // Initialize reactive form
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      rememberMe: [false],
    });

    // Redirect if already authenticated
    if (this.authService.isAuthenticated()) {
      this.redirectToAdmin();
    }
  }

  ngOnInit(): void {
    // Check if vendor is set
    if (!this.currentVendor) {
      this.snackBar.open('Please select a vendor first', 'Close', {
        duration: 5000,
        panelClass: ['error-snackbar'],
      });
      this.router.navigate(['/']);
      return;
    }

    // Watch for authentication errors
    effect(() => {
      const error = this.authService.error();
      if (error) {
        this.snackBar.open(error, 'Close', {
          duration: 5000,
          panelClass: ['error-snackbar'],
        });
      }
    });
  }

  ngOnDestroy(): void {
    // Cleanup handled by takeUntilDestroyed
  }

  /**
   * Handle form submission
   */
  async onSubmit(): Promise<void> {
    if (this.loginForm.valid && !this.isLoading()) {
      const formData: LoginFormData = this.loginForm.value;

      try {
        const authUser = await this.authService.login(formData);

        // Verify authentication was successful
        if (authUser && this.authService.isAuthenticated()) {
          this.snackBar.open(`Welcome back, ${authUser.firstName}!`, 'Close', {
            duration: 3000,
            panelClass: ['success-snackbar'],
          });

          // Navigate immediately since we have confirmed authentication
          this.redirectToAdmin();
        } else {
          throw new Error('Authentication verification failed');
        }
      } catch (error) {
        // Error handling is done through the service and snackbar subscription
        console.error('Login failed:', error);
      }
    } else {
      this.markFormGroupTouched();
    }
  }

  /**
   * Toggle password visibility
   */
  togglePasswordVisibility(): void {
    this.hidePassword.update((hidden) => !hidden);
  }

  /**
   * Get form control error message
   */
  getErrorMessage(controlName: string): string {
    const control = this.loginForm.get(controlName);

    if (control?.hasError('required')) {
      return `${this.getControlDisplayName(controlName)} is required`;
    }

    if (control?.hasError('email')) {
      return 'Please enter a valid email address';
    }

    if (control?.hasError('minlength')) {
      const minLength = control.errors?.['minlength'].requiredLength;
      return `Password must be at least ${minLength} characters long`;
    }

    return '';
  }

  /**
   * Check if form control has error and is touched
   */
  hasError(controlName: string): boolean {
    const control = this.loginForm.get(controlName);
    return !!(control?.invalid && (control?.dirty || control?.touched));
  }

  /**
   * Navigate back to vendor selection
   */
  goBackToVendorSelection(): void {
    this.router.navigate(['/']);
  }

  /**
   * Get vendor logo URL or fallback
   */
  getVendorLogo(): string {
    return (
      this.currentVendor?.logo_url || '/assets/images/default-vendor-logo.png'
    );
  }

  /**
   * Get vendor display name
   */
  getVendorName(): string {
    return this.currentVendor?.business_name || 'Restaurant';
  }

  // Private methods

  /**
   * Redirect to admin dashboard
   */
  private redirectToAdmin(): void {
    const returnUrl = this.route.snapshot.queryParams['returnUrl'];
    const defaultUrl = `/${this.vendorService.getVendorSlug(
      this.currentVendor!
    )}/admin`;

    this.router.navigate([returnUrl || defaultUrl]);
  }

  /**
   * Mark all form controls as touched to show validation errors
   */
  private markFormGroupTouched(): void {
    Object.keys(this.loginForm.controls).forEach((key) => {
      const control = this.loginForm.get(key);
      control?.markAsTouched();
    });
  }

  /**
   * Get display name for form control
   */
  private getControlDisplayName(controlName: string): string {
    const displayNames: Record<string, string> = {
      email: 'Email',
      password: 'Password',
    };

    return displayNames[controlName] || controlName;
  }
}
