import {
  Component,
  inject,
  signal,
  computed,
  OnInit,
  ChangeDetectionStrategy,
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
import { LoginFormData } from '../../models/auth.models';

@Component({
  selector: 'app-admin-login-centralized',
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
  templateUrl: './admin-login-centralized.component.html',
  styleUrl: './admin-login-centralized.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminLoginCentralizedComponent implements OnInit {
  private readonly authService = inject(AuthService);
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
    // Watch for authentication errors
    const error = this.authState().error;
    if (error) {
      this.showError(error);
    }
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
        this.showError(error instanceof Error ? error.message : 'Login failed');
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
   * Show error message
   */
  private showError(message: string): void {
    this.snackBar.open(message, 'Close', {
      duration: 5000,
      panelClass: ['error-snackbar'],
    });
  }

  /**
   * Redirect to admin dashboard
   */
  private redirectToAdmin(): void {
    const returnUrl = this.route.snapshot.queryParams['returnUrl'];
    const currentUser = this.authService.currentUser();
    
    if (currentUser?.vendor?.slug) {
      const defaultUrl = `/${currentUser.vendor.slug}/admin`;
      this.router.navigate([returnUrl || defaultUrl]);
    } else {
      // Fallback to vendor selection if no vendor context
      this.router.navigate(['/']);
    }
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