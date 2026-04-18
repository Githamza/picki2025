import { Component, inject, OnInit, signal, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { VendorService } from '../../../../services/vendor.service';
import { StripeService } from '../../../../services/stripe.service';
import { PaygreenBackendService } from '../../../../services/paygreen-backend.service';
import { RestaurantInfoDataService } from '../../restaurant-info-data.service';

export interface PaymentProviderStatus {
  stripe: { configured: boolean; accountId: string | null };
  paygreen: { configured: boolean; onboardingCompleted: boolean };
  selectedProvider: 'STRIPE' | 'PAYGREEN' | null;
}

@Component({
  selector: 'app-paiement',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatCheckboxModule,
    MatRadioModule,
    MatIconModule,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form [formGroup]="form" (ngSubmit)="onSave()">
      <!-- Payments Toggle -->
      <mat-card class="info-section">
        <mat-card-header>
          <mat-icon mat-card-avatar>payments</mat-icon>
          <mat-card-title>Paiement</mat-card-title>
          <mat-card-subtitle>Activez/désactivez le paiement en ligne</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <div class="order-types" formGroupName="payments">
            <mat-checkbox formControlName="onlinePaymentsEnabled">
              Accepter les paiements en ligne
            </mat-checkbox>
          </div>
          <p class="hint-text">
            Si désactivé, les commandes seront créées avec la mention « À payer au retrait ».
          </p>
        </mat-card-content>
      </mat-card>

      <!-- Payment Providers (only shown when online payments enabled) -->
      <mat-card class="info-section" *ngIf="form.get('payments.onlinePaymentsEnabled')?.value">
        <mat-card-header>
          <mat-icon mat-card-avatar>account_balance</mat-icon>
          <mat-card-title>Fournisseurs de paiement</mat-card-title>
          <mat-card-subtitle>Configurez vos méthodes de paiement en ligne</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <div class="payment-providers-loading" *ngIf="isLoadingPaymentProviders()">
            <mat-spinner diameter="24"></mat-spinner>
            <span>Chargement...</span>
          </div>

          <div class="payment-providers" *ngIf="!isLoadingPaymentProviders() && paymentProvidersStatus()">
            <mat-radio-group
              class="providers-radio-group"
              [value]="paymentProvidersStatus()?.selectedProvider"
              (change)="onProviderSelect($event.value)"
            >
              <!-- Stripe Provider -->
              <div class="provider-row">
                <div class="provider-select">
                  <mat-radio-button
                    value="STRIPE"
                    [disabled]="isUpdatingProvider() || !paymentProvidersStatus()?.stripe?.configured"
                  ></mat-radio-button>
                </div>
                <div class="provider-info">
                  <div class="provider-header">
                    <mat-icon class="provider-icon stripe-icon">credit_card</mat-icon>
                    <span class="provider-name">Stripe</span>
                    <span
                      class="provider-status"
                      [class.configured]="paymentProvidersStatus()?.stripe?.configured"
                      [class.not-configured]="!paymentProvidersStatus()?.stripe?.configured"
                    >
                      {{ paymentProvidersStatus()?.stripe?.configured ? 'Configuré' : 'Non configuré' }}
                    </span>
                    <span
                      *ngIf="!paymentProvidersStatus()?.stripe?.configured"
                      class="provider-badge quick-setup"
                    >
                      Configuration en quelques minutes
                    </span>
                  </div>
                  <p class="provider-description">
                    Acceptez les paiements par carte bancaire via Stripe.
                  </p>
                </div>
                <div class="provider-actions">
                  <button
                    *ngIf="!paymentProvidersStatus()?.stripe?.configured"
                    mat-stroked-button
                    color="primary"
                    type="button"
                    [disabled]="isCreatingStripeOnboarding()"
                    (click)="onConfigureStripe()"
                  >
                    <mat-spinner *ngIf="isCreatingStripeOnboarding()" diameter="18" class="button-spinner"></mat-spinner>
                    <mat-icon *ngIf="!isCreatingStripeOnboarding()">settings</mat-icon>
                    {{ isCreatingStripeOnboarding() ? 'Création...' : 'Configurer mon compte' }}
                  </button>
                </div>
              </div>

              <!-- PayGreen Provider -->
              <div class="provider-row paygreen-provider-row" [class.has-form]="!paymentProvidersStatus()?.paygreen?.configured">
                <div class="provider-row-header">
                  <div class="provider-select">
                    <mat-radio-button
                      value="PAYGREEN"
                      [disabled]="isUpdatingProvider() || !paymentProvidersStatus()?.paygreen?.onboardingCompleted"
                    ></mat-radio-button>
                  </div>
                  <div class="provider-info">
                    <div class="provider-header">
                      <mat-icon class="provider-icon paygreen-icon">eco</mat-icon>
                      <span class="provider-name">PayGreen</span>
                      <span
                        class="provider-status"
                        [class.configured]="paymentProvidersStatus()?.paygreen?.configured"
                        [class.not-configured]="!paymentProvidersStatus()?.paygreen?.configured"
                      >
                        {{ paymentProvidersStatus()?.paygreen?.configured ? 'Configuré' : 'Non configuré' }}
                      </span>
                    </div>
                    <p class="provider-description">
                      Solution de paiement éco-responsable.
                    </p>
                  </div>
                </div>

                <div *ngIf="!paymentProvidersStatus()?.paygreen?.configured" class="paygreen-onboarding-form">
                  <div class="onboarding-section-title">
                    <mat-icon>badge</mat-icon>
                    <span>Identification</span>
                  </div>
                  <mat-form-field appearance="outline" class="siret-field">
                    <mat-label>Numéro SIRET</mat-label>
                    <input
                      matInput
                      [value]="paygreenSiret()"
                      (input)="paygreenSiret.set($any($event.target).value)"
                      placeholder="Ex: 012345678"
                      [disabled]="isCreatingPaygreenMarketplace()"
                    />
                    <mat-hint>Requis pour créer votre compte PayGreen</mat-hint>
                  </mat-form-field>

                  <div class="onboarding-section-title">
                    <mat-icon>location_on</mat-icon>
                    <span>Adresse de l'établissement</span>
                  </div>
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>Rue</mat-label>
                    <input
                      matInput
                      [value]="paygreenStreet()"
                      (input)="paygreenStreet.set($any($event.target).value)"
                      placeholder="123 Rue Example"
                      [disabled]="isCreatingPaygreenMarketplace()"
                    />
                  </mat-form-field>
                  <div class="address-row">
                    <mat-form-field appearance="outline" class="postal-code-field">
                      <mat-label>Code postal</mat-label>
                      <input
                        matInput
                        [value]="paygreenPostalCode()"
                        (input)="paygreenPostalCode.set($any($event.target).value)"
                        placeholder="37000"
                        [disabled]="isCreatingPaygreenMarketplace()"
                      />
                    </mat-form-field>
                    <mat-form-field appearance="outline" class="city-field">
                      <mat-label>Ville</mat-label>
                      <input
                        matInput
                        [value]="paygreenCity()"
                        (input)="paygreenCity.set($any($event.target).value)"
                        placeholder="Tours"
                        [disabled]="isCreatingPaygreenMarketplace()"
                      />
                    </mat-form-field>
                  </div>

                  <p class="address-hint" *ngIf="!paygreenStreet() || !paygreenCity() || !paygreenPostalCode()">
                    <mat-icon>info</mat-icon>
                    L'adresse complète est requise pour l'inscription PayGreen marketplace.
                  </p>

                  <button
                    mat-flat-button
                    color="primary"
                    type="button"
                    class="configure-paygreen-button"
                    [disabled]="isCreatingPaygreenMarketplace()"
                    (click)="onConfigurePaygreen()"
                  >
                    <mat-spinner *ngIf="isCreatingPaygreenMarketplace()" diameter="18" class="button-spinner"></mat-spinner>
                    <mat-icon *ngIf="!isCreatingPaygreenMarketplace()">settings</mat-icon>
                    {{ isCreatingPaygreenMarketplace() ? 'Configuration en cours...' : 'Configurer mon compte PayGreen' }}
                  </button>
                </div>
              </div>
            </mat-radio-group>

            <!-- PayGreen Marketplace Mode (only when PayGreen is selected) -->
            <div
              class="paygreen-mode-section"
              *ngIf="paymentProvidersStatus()?.selectedProvider === 'PAYGREEN'"
            >
              <div class="mode-header">
                <mat-icon>storefront</mat-icon>
                <span class="mode-title">Mode PayGreen</span>
              </div>
              <mat-radio-group
                class="mode-radio-group"
                [value]="currentPaygreenMode()"
                (change)="onPaygreenModeChange($any($event).value)"
                [disabled]="isUpdatingPaygreenMode()"
              >
                <mat-radio-button value="independent">
                  <span class="mode-label">Indépendant</span>
                  <span class="mode-desc">Le vendor utilise son propre compte PayGreen (clés API complètes)</span>
                </mat-radio-button>
                <mat-radio-button value="marketplace">
                  <span class="mode-label">Marketplace</span>
                  <span class="mode-desc">Les paiements transitent par le compte Picki. Seul le shop_id PayGreen est requis.</span>
                </mat-radio-button>
              </mat-radio-group>
              <div class="mode-info" *ngIf="currentPaygreenMode() === 'marketplace'">
                <mat-icon>info</mat-icon>
                <span>
                  En mode marketplace, Picki gère les paiements et reverse au vendor sa part.
                  Si la livraison est gérée par Picki, les frais de livraison sont retenus automatiquement.
                </span>
              </div>
            </div>

            <div
              class="provider-warning"
              *ngIf="!paymentProvidersStatus()?.stripe?.configured && !paymentProvidersStatus()?.paygreen?.configured"
            >
              <mat-icon>warning</mat-icon>
              <span>Aucun fournisseur de paiement n'est configuré. Les paiements en ligne ne seront pas disponibles.</span>
            </div>

            <div
              class="provider-info-text"
              *ngIf="paymentProvidersStatus()?.selectedProvider"
            >
              <mat-icon>info</mat-icon>
              <span>
                Fournisseur actif : <strong>{{ paymentProvidersStatus()?.selectedProvider === 'STRIPE' ? 'Stripe' : 'PayGreen' }}</strong>
              </span>
            </div>
          </div>
        </mat-card-content>
      </mat-card>

      <div class="actions">
        <button
          mat-raised-button
          color="primary"
          type="submit"
          [disabled]="isSaving()"
          class="save-button"
        >
          <mat-icon>save</mat-icon>
          {{ isSaving() ? 'Enregistrement...' : 'Enregistrer' }}
        </button>
        <button
          mat-button
          type="button"
          (click)="onReset()"
          [disabled]="isSaving()"
          class="reset-button"
        >
          <mat-icon>refresh</mat-icon>
          Annuler
        </button>
      </div>
    </form>
  `,
  styles: [`
    @use '../../../restaurant-info-admin/children/shared-styles' as shared;
    @include shared.child-section;

    .payment-providers-loading {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
      background: var(--mat-sys-surface-container-high);
      border-radius: var(--mat-sys-corner-medium);
      font: var(--mat-sys-body-medium);
      color: var(--mat-sys-on-surface-variant);
    }

    .payment-providers {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    .providers-radio-group {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .provider-row {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px;
      background: var(--mat-sys-surface-container-high);
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: var(--mat-sys-corner-medium);
      transition: background-color 0.15s ease, border-color 0.15s ease;
    }

    .provider-row:hover {
      background: var(--mat-sys-surface-container-highest);
      border-color: var(--mat-sys-outline);
    }

    .paygreen-provider-row {
      flex-direction: column;
      align-items: stretch;
    }

    .paygreen-provider-row .provider-row-header {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .provider-select {
      display: flex;
      align-items: center;
    }

    .provider-info {
      flex: 1;
    }

    .provider-header {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 4px;
    }

    .provider-icon {
      font-size: 24px;
      width: 24px;
      height: 24px;
    }

    .stripe-icon {
      color: var(--mat-sys-primary);
    }

    .paygreen-icon {
      color: var(--mat-sys-tertiary);
    }

    .provider-name {
      font: var(--mat-sys-title-small);
      color: var(--mat-sys-on-surface);
    }

    .provider-status {
      font: var(--mat-sys-label-small);
      padding: 4px 12px;
      border-radius: var(--mat-sys-corner-full);
    }

    .provider-status.configured {
      background: var(--mat-sys-tertiary-container);
      color: var(--mat-sys-on-tertiary-container);
    }

    .provider-status.not-configured {
      background: var(--mat-sys-error-container);
      color: var(--mat-sys-on-error-container);
    }

    .provider-badge {
      font: var(--mat-sys-label-small);
      padding: 4px 12px;
      border-radius: var(--mat-sys-corner-full);
    }

    .provider-badge.quick-setup {
      background: var(--mat-sys-primary-container);
      color: var(--mat-sys-on-primary-container);
    }

    .provider-badge.complete-setup {
      background: var(--mat-sys-secondary-container);
      color: var(--mat-sys-on-secondary-container);
    }

    .provider-description {
      margin: 0;
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);
      padding-left: 32px;
    }

    .provider-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .provider-actions button {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .button-spinner {
      display: inline-block;
    }

    .paygreen-onboarding-form {
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid var(--mat-sys-outline-variant);
      display: flex;
      flex-direction: column;
      gap: 4px;
    }

    .onboarding-section-title {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 8px;
      margin-bottom: 4px;
      font: var(--mat-sys-label-large);
      color: var(--mat-sys-on-surface-variant);
    }

    .onboarding-section-title mat-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: var(--mat-sys-tertiary);
    }

    .siret-field {
      width: 100%;
      max-width: 300px;
    }

    .address-row {
      display: flex;
      gap: 16px;
    }

    .postal-code-field {
      flex: 0 0 140px;
    }

    .city-field {
      flex: 1;
    }

    .address-hint {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0;
      padding: 8px 12px;
      background: var(--mat-sys-secondary-container);
      border-radius: var(--mat-sys-corner-small);
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-secondary-container);
    }

    .address-hint mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      flex-shrink: 0;
    }

    .configure-paygreen-button {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin-top: 12px;
      align-self: flex-start;
    }

    .provider-warning {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 16px;
      background: var(--mat-sys-error-container);
      border-radius: var(--mat-sys-corner-medium);
    }

    .provider-warning mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
      color: var(--mat-sys-on-error-container);
      flex-shrink: 0;
    }

    .provider-warning span {
      font: var(--mat-sys-body-medium);
      color: var(--mat-sys-on-error-container);
    }

    .provider-info-text {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 16px;
      background: var(--mat-sys-primary-container);
      border-radius: var(--mat-sys-corner-medium);
    }

    .provider-info-text mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
      color: var(--mat-sys-on-primary-container);
      flex-shrink: 0;
    }

    .provider-info-text span {
      font: var(--mat-sys-body-medium);
      color: var(--mat-sys-on-primary-container);
    }

    .paygreen-mode-section {
      padding: 16px;
      background: var(--mat-sys-surface-container-high);
      border: 1px solid var(--mat-sys-outline-variant);
      border-radius: var(--mat-sys-corner-medium);
    }

    .mode-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
    }

    .mode-header mat-icon {
      color: var(--mat-sys-tertiary);
    }

    .mode-title {
      font: var(--mat-sys-title-small);
      color: var(--mat-sys-on-surface);
    }

    .mode-radio-group {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .mode-label {
      font: var(--mat-sys-body-medium);
      color: var(--mat-sys-on-surface);
      font-weight: 500;
    }

    .mode-desc {
      display: block;
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-surface-variant);
      margin-top: 2px;
    }

    .mode-info {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      margin-top: 12px;
      padding: 12px;
      background: var(--mat-sys-tertiary-container);
      border-radius: var(--mat-sys-corner-medium);
    }

    .mode-info mat-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
      color: var(--mat-sys-on-tertiary-container);
      flex-shrink: 0;
    }

    .mode-info span {
      font: var(--mat-sys-body-small);
      color: var(--mat-sys-on-tertiary-container);
    }

    @media (max-width: 600px) {
      .provider-row {
        padding: 12px;
        gap: 12px;
        flex-wrap: wrap;
      }

      .paygreen-provider-row .provider-row-header {
        gap: 12px;
        width: 100%;
      }

      .provider-header {
        gap: 6px;
      }

      .provider-select {
        order: 1;
      }

      .provider-info {
        order: 2;
        flex: 1;
        min-width: 0;
      }

      .provider-actions {
        order: 3;
        width: 100%;
        margin-top: 4px;
      }

      .provider-actions button {
        width: 100%;
        justify-content: center;
      }

      .provider-description {
        padding-left: 0;
        margin-top: 4px;
      }

      .paygreen-onboarding-form {
        margin-top: 12px;
        padding-top: 12px;
      }

      .siret-field {
        max-width: 100%;
      }

      .address-row {
        flex-direction: column;
        gap: 0;
      }

      .postal-code-field {
        flex: 1;
      }

      .configure-paygreen-button {
        align-self: stretch;
        width: 100%;
      }

      .onboarding-section-title {
        margin-top: 4px;
      }

      .address-hint {
        font: var(--mat-sys-body-small);
      }
    }
  `],
})
export class PaiementComponent implements OnInit {
  private fb = inject(FormBuilder);
  private vendorService = inject(VendorService);
  private stripeService = inject(StripeService);
  private paygreenBackendService = inject(PaygreenBackendService);
  private dataService = inject(RestaurantInfoDataService);
  private snackBar = inject(MatSnackBar);
  private cdr = inject(ChangeDetectorRef);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  form!: FormGroup;
  isSaving = signal(false);

  paymentProvidersStatus = signal<PaymentProviderStatus | null>(null);
  isLoadingPaymentProviders = signal(true);
  isUpdatingProvider = signal(false);
  isCreatingStripeOnboarding = signal(false);
  isCreatingPaygreenMarketplace = signal(false);
  paygreenSiret = signal('');
  paygreenStreet = signal('');
  paygreenCity = signal('');
  paygreenPostalCode = signal('');
  currentPaygreenMode = signal<'independent' | 'marketplace'>('independent');
  isUpdatingPaygreenMode = signal(false);

  ngOnInit() {
    const info = this.dataService.restaurantInfo();
    this.form = this.fb.group({
      payments: this.fb.group({
        onlinePaymentsEnabled: [info?.vendor.online_payments_enabled ?? true],
      }),
    });

    // Pre-fill address fields from existing data
    if (info?.address) {
      this.paygreenStreet.set(info.address.street || '');
      this.paygreenCity.set(info.address.city || '');
      this.paygreenPostalCode.set(info.address.postal_code || '');
    }
    // Pre-fill SIRET from vendor
    if (info?.vendor?.national_id) {
      this.paygreenSiret.set(info.vendor.national_id);
    }

    this.loadPaymentProvidersStatus();
    this.checkStripeOnboardingReturn();
  }

  private checkStripeOnboardingReturn() {
    const params = this.route.snapshot.queryParams;
    const stripeOnboarding = params['stripe_onboarding'];

    if (stripeOnboarding === 'success' || stripeOnboarding === 'refresh') {
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { stripe_onboarding: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });

      setTimeout(() => {
        this.verifyStripeOnboardingStatus();
      }, 500);
    }
  }

  private verifyStripeOnboardingStatus() {
    const currentVendor = this.vendorService.getCurrentVendor();
    if (!currentVendor) return;

    this.snackBar.open('Vérification du statut Stripe...', '', { duration: 2000 });

    this.stripeService.checkOnboardingStatus(currentVendor.id).subscribe({
      next: (status) => {
        if (status.onboarding_complete) {
          this.snackBar.open('Configuration Stripe terminée avec succès!', 'Fermer', {
            duration: 5000,
            panelClass: ['success-snackbar'],
          });
          this.loadPaymentProvidersStatusAndSelectStripe();
        } else {
          const pendingRequirements = status.requirements?.currently_due?.length || 0;
          this.snackBar.open(
            `Configuration Stripe en cours. ${pendingRequirements} étape(s) restante(s).`,
            'Fermer',
            { duration: 5000 }
          );
        }
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error checking Stripe onboarding status:', error);
        this.snackBar.open('Erreur lors de la vérification du statut Stripe', 'Fermer', {
          duration: 5000,
          panelClass: ['error-snackbar'],
        });
      },
    });
  }

  private async loadPaymentProvidersStatus() {
    this.isLoadingPaymentProviders.set(true);
    try {
      const status = await this.vendorService.getPaymentProvidersStatus();
      this.paymentProvidersStatus.set(status);
      // Initialize PayGreen mode from vendor data
      const vendor = this.vendorService.getCurrentVendor();
      if (vendor?.paygreen_mode) {
        this.currentPaygreenMode.set(vendor.paygreen_mode as 'independent' | 'marketplace');
      }
    } catch (error) {
      console.error('Error loading payment providers status:', error);
      this.snackBar.open('Erreur lors du chargement des fournisseurs de paiement', 'Fermer', {
        duration: 5000,
        panelClass: ['error-snackbar'],
      });
    } finally {
      this.isLoadingPaymentProviders.set(false);
      this.cdr.detectChanges();
    }
  }

  private async loadPaymentProvidersStatusAndSelectStripe() {
    this.isLoadingPaymentProviders.set(true);
    try {
      const status = await this.vendorService.getPaymentProvidersStatus();
      this.paymentProvidersStatus.set(status);

      if (status.stripe.configured) {
        await this.onProviderSelect('STRIPE');
      }
    } catch (error) {
      console.error('Error loading payment providers status:', error);
    } finally {
      this.isLoadingPaymentProviders.set(false);
      this.cdr.detectChanges();
    }
  }

  async onProviderSelect(provider: 'STRIPE' | 'PAYGREEN' | null) {
    if (!provider) return;

    const currentStatus = this.paymentProvidersStatus();
    if (!currentStatus) return;

    if (currentStatus.selectedProvider === provider) return;

    this.isUpdatingProvider.set(true);
    try {
      await this.vendorService.updatePaymentProvider(provider);
      this.paymentProvidersStatus.set({
        ...currentStatus,
        selectedProvider: provider,
      });
      this.snackBar.open(
        `Fournisseur de paiement changé vers ${provider === 'STRIPE' ? 'Stripe' : 'PayGreen'}`,
        'Fermer',
        { duration: 3000, panelClass: ['success-snackbar'] }
      );
    } catch (error) {
      console.error('Error updating payment provider:', error);
      this.snackBar.open('Erreur lors de la mise à jour du fournisseur', 'Fermer', {
        duration: 5000,
        panelClass: ['error-snackbar'],
      });
      await this.loadPaymentProvidersStatus();
    } finally {
      this.isUpdatingProvider.set(false);
      this.cdr.detectChanges();
    }
  }

  onConfigureStripe() {
    const currentVendor = this.vendorService.getCurrentVendor();
    if (!currentVendor) {
      this.snackBar.open('Erreur: Aucun vendeur sélectionné', 'Fermer', {
        duration: 3000,
        panelClass: ['error-snackbar'],
      });
      return;
    }

    this.isCreatingStripeOnboarding.set(true);

    const baseUrl = window.location.origin;
    const returnUrl = `${baseUrl}/admin/restaurant-info/paiement?stripe_onboarding=success`;
    const refreshUrl = `${baseUrl}/admin/restaurant-info/paiement?stripe_onboarding=refresh`;

    this.stripeService.createOnboardingLink(currentVendor.id, refreshUrl, returnUrl).subscribe({
      next: (response) => {
        this.isCreatingStripeOnboarding.set(false);
        window.open(response.url, '_blank');
        this.snackBar.open('Redirection vers Stripe pour finaliser la configuration...', 'Fermer', {
          duration: 5000,
        });
      },
      error: (error) => {
        this.isCreatingStripeOnboarding.set(false);
        console.error('Error creating Stripe onboarding link:', error);
        this.snackBar.open('Erreur lors de la création du lien Stripe. Veuillez réessayer.', 'Fermer', {
          duration: 5000,
          panelClass: ['error-snackbar'],
        });
        this.cdr.detectChanges();
      },
    });
  }

  onConfigurePaygreen() {
    const currentVendor = this.vendorService.getCurrentVendor();
    if (!currentVendor) {
      this.snackBar.open('Erreur: Aucun vendeur sélectionné', 'Fermer', {
        duration: 3000,
        panelClass: ['error-snackbar'],
      });
      return;
    }

    const siret = this.paygreenSiret().trim();
    const street = this.paygreenStreet().trim();
    const city = this.paygreenCity().trim();
    const postalCode = this.paygreenPostalCode().trim();

    if (!siret) {
      this.snackBar.open('Veuillez renseigner votre numéro SIRET', 'Fermer', {
        duration: 3000,
        panelClass: ['error-snackbar'],
      });
      return;
    }

    if (!street || !city || !postalCode) {
      this.snackBar.open('Veuillez renseigner l\'adresse complète (rue, ville, code postal)', 'Fermer', {
        duration: 4000,
        panelClass: ['error-snackbar'],
      });
      return;
    }

    this.isCreatingPaygreenMarketplace.set(true);

    // Save SIRET and address first, then create marketplace shop
    Promise.all([
      this.vendorService.updateVendorNationalId(currentVendor.id, siret),
      this.vendorService.saveRestaurantInfo({
        address: { street, city, postal_code: postalCode, country: currentVendor.country || 'FR' },
      }),
    ]).then(() => {
      this.paygreenBackendService.createMarketplaceShop(currentVendor.id).subscribe({
        next: () => {
          this.isCreatingPaygreenMarketplace.set(false);
          this.snackBar.open('Compte PayGreen marketplace créé avec succès!', 'Fermer', {
            duration: 5000,
            panelClass: ['success-snackbar'],
          });
          this.loadPaymentProvidersStatusAndSelectPaygreen();
        },
        error: (error) => {
          this.isCreatingPaygreenMarketplace.set(false);
          const errorMsg = error?.error?.error || 'Erreur lors de la création du compte PayGreen';
          console.error('Error creating PayGreen marketplace shop:', error);
          this.snackBar.open(errorMsg, 'Fermer', {
            duration: 5000,
            panelClass: ['error-snackbar'],
          });
          this.cdr.detectChanges();
        },
      });
    }).catch((error) => {
      this.isCreatingPaygreenMarketplace.set(false);
      console.error('Error saving SIRET:', error);
      this.snackBar.open('Erreur lors de la sauvegarde du SIRET', 'Fermer', {
        duration: 5000,
        panelClass: ['error-snackbar'],
      });
      this.cdr.detectChanges();
    });
  }

  private async loadPaymentProvidersStatusAndSelectPaygreen() {
    this.isLoadingPaymentProviders.set(true);
    try {
      const status = await this.vendorService.getPaymentProvidersStatus();
      this.paymentProvidersStatus.set(status);

      if (status.paygreen.configured) {
        await this.onProviderSelect('PAYGREEN');
        this.currentPaygreenMode.set('marketplace');
      }
    } catch (error) {
      console.error('Error loading payment providers status:', error);
    } finally {
      this.isLoadingPaymentProviders.set(false);
      this.cdr.detectChanges();
    }
  }

  async onPaygreenModeChange(mode: 'independent' | 'marketplace') {
    const vendor = this.vendorService.getCurrentVendor();
    if (!vendor) return;

    this.isUpdatingPaygreenMode.set(true);
    try {
      await this.vendorService.updatePaygreenMode(vendor.id, mode);
      this.currentPaygreenMode.set(mode);
      this.snackBar.open(
        `Mode PayGreen changé vers ${mode === 'marketplace' ? 'Marketplace' : 'Indépendant'}`,
        'Fermer',
        { duration: 3000, panelClass: ['success-snackbar'] }
      );
    } catch (error) {
      console.error('Error updating PayGreen mode:', error);
      this.snackBar.open('Erreur lors de la mise à jour du mode PayGreen', 'Fermer', {
        duration: 5000,
        panelClass: ['error-snackbar'],
      });
    } finally {
      this.isUpdatingPaygreenMode.set(false);
      this.cdr.detectChanges();
    }
  }

  async onSave() {
    this.isSaving.set(true);
    try {
      await this.vendorService.saveRestaurantInfo({
        onlinePaymentsEnabled: !!this.form.value.payments?.onlinePaymentsEnabled,
      });
      await this.dataService.refreshVendor();
      this.snackBar.open('Paiement sauvegardé', 'Fermer', { duration: 3000, panelClass: ['success-snackbar'] });
    } catch {
      this.snackBar.open('Erreur lors de la sauvegarde', 'Fermer', { duration: 5000, panelClass: ['error-snackbar'] });
    } finally {
      this.isSaving.set(false);
    }
  }

  onReset() {
    const info = this.dataService.restaurantInfo();
    this.form.patchValue({
      payments: {
        onlinePaymentsEnabled: info?.vendor.online_payments_enabled ?? true,
      },
    });
    this.snackBar.open('Modifications annulées', 'Fermer', { duration: 2000 });
  }
}
