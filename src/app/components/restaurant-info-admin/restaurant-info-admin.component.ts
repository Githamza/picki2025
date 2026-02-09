import {
  Component,
  inject,
  OnInit,
  signal,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  FormArray,
  AbstractControl,
  Validators,
  type ValidationErrors,
  type ValidatorFn,
} from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { DestroyRef } from '@angular/core';
import { materialComponents } from '../../material.components';
import {
  VendorService,
  type RestaurantInfo,
  type BusinessHours,
  type OrderType,
} from '../../services/vendor.service';
import { StripeService } from '../../services/stripe.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ChangeDetectionStrategy } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { ImageUploadComponent } from '../../shared/components/image-upload/image-upload.component';

export interface PaymentProviderStatus {
  stripe: { configured: boolean; accountId: string | null };
  paygreen: { configured: boolean; onboardingCompleted: boolean };
  selectedProvider: 'STRIPE' | 'PAYGREEN' | null;
}

@Component({
  selector: 'app-restaurant-info-admin',
  imports: [CommonModule, ReactiveFormsModule, ...materialComponents, ImageUploadComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="restaurant-info-admin">
      <div class="header">
        <h2>
          <mat-icon>restaurant</mat-icon>
          Mes Informations Restaurant
        </h2>
        <p class="subtitle">Gérez les informations de votre restaurant</p>
      </div>

      <div class="content" *ngIf="restaurantForm">
        <form [formGroup]="restaurantForm" (ngSubmit)="onSave()">
          <!-- Banner & Logo Section -->
          <mat-card class="info-section branding-section">
            <mat-card-header>
              <mat-icon mat-card-avatar>image</mat-icon>
              <mat-card-title>Image de marque</mat-card-title>
              <mat-card-subtitle
                >Personnalisez l'apparence de votre restaurant</mat-card-subtitle
              >
            </mat-card-header>
            <mat-card-content>
              <!-- Banner Image -->
              <div class="branding-item">
                <div class="branding-label">
                  <mat-icon>panorama</mat-icon>
                  <div class="branding-label-text">
                    <span class="label-title">Image de bannière</span>
                    <span class="label-hint">Format recommandé : 1200x400px</span>
                  </div>
                </div>
                <div class="banner-preview-container" *ngIf="restaurantForm.get('bannerUrl')?.value">
                  <img
                    [src]="restaurantForm.get('bannerUrl')?.value"
                    alt="Bannière du restaurant"
                    class="banner-preview"
                  />
                </div>
                <app-image-upload
                  formControlName="bannerUrl"
                  label="URL de la bannière"
                  placeholder="https://... ou téléchargez une image"
                ></app-image-upload>
              </div>

              <mat-divider class="branding-divider"></mat-divider>

              <!-- Logo -->
              <div class="branding-item">
                <div class="branding-label">
                  <mat-icon>store</mat-icon>
                  <div class="branding-label-text">
                    <span class="label-title">Logo du restaurant</span>
                    <span class="label-hint">Format recommandé : 200x200px (carré)</span>
                  </div>
                </div>
                <app-image-upload
                  formControlName="logoUrl"
                  label="URL du logo"
                  placeholder="https://... ou téléchargez une image"
                ></app-image-upload>
              </div>
            </mat-card-content>
          </mat-card>

          <!-- Business Hours Section -->
          <mat-card class="info-section">
            <mat-card-header>
              <mat-icon mat-card-avatar>schedule</mat-icon>
              <mat-card-title>Horaires d'ouverture</mat-card-title>
              <mat-card-subtitle
                >Définissez vos heures d'ouverture pour chaque
                jour</mat-card-subtitle
              >
            </mat-card-header>
            <mat-card-content>
              <div class="business-hours-form" formArrayName="businessHours">
                <div
                  *ngFor="
                    let dayControl of businessHoursArray.controls;
                    let i = index
                  "
                  [formGroupName]="i"
                  class="day-row"
                >
                  <div class="day-info">
                    <span class="day-name">{{ getDayName(i) }}</span>
                  </div>

                  <mat-checkbox
                    formControlName="is_closed"
                    class="closed-checkbox"
                    (change)="onClosedToggle(i)"
                  >
                    Fermé
                  </mat-checkbox>

                  <div
                    class="time-controls"
                    *ngIf="!dayControl.get('is_closed')?.value"
                  >
                    <mat-form-field appearance="outline" class="time-field">
                      <mat-label>Ouverture</mat-label>
                      <input matInput type="time" formControlName="open_time" />
                    </mat-form-field>

                    <span class="time-separator">-</span>

                    <mat-form-field appearance="outline" class="time-field">
                      <mat-label>Fermeture</mat-label>
                      <input
                        matInput
                        type="time"
                        formControlName="close_time"
                      />
                    </mat-form-field>
                  </div>

                  <div
                    class="closed-indicator"
                    *ngIf="dayControl.get('is_closed')?.value"
                  >
                    <span class="closed-text">Fermé toute la journée</span>
                  </div>
                </div>
              </div>
            </mat-card-content>
          </mat-card>

          <!-- Order Types / Eating Modes Section -->
          <mat-card class="info-section">
            <mat-card-header>
              <mat-icon mat-card-avatar>restaurant_menu</mat-icon>
              <mat-card-title>Modes de commande</mat-card-title>
              <mat-card-subtitle
                >Choisissez quels modes afficher sur l'écran d'accueil</mat-card-subtitle
              >
            </mat-card-header>
            <mat-card-content>
              <div class="order-types" formGroupName="orderTypes">
                <mat-checkbox formControlName="takeAway">
                  À emporter
                </mat-checkbox>
                <mat-checkbox formControlName="eatIn">Sur place</mat-checkbox>
                <mat-checkbox formControlName="delivery">Livraison</mat-checkbox>
              </div>

              <div class="validation-error" *ngIf="restaurantForm.get('orderTypes')?.hasError('atLeastOne')">
                Sélectionnez au moins un mode de commande.
              </div>

              <!-- Delivery settings (only when delivery enabled) -->
              <div
                class="delivery-settings"
                *ngIf="restaurantForm.get('orderTypes.delivery')?.value"
                formGroupName="deliverySettings"
              >
                <h4 class="delivery-settings-title">Paramètres de livraison</h4>

                <mat-radio-group
                  class="delivery-system-radio"
                  formControlName="deliverySystem"
                  aria-label="Choisir le système de livraison"
                >
                  <mat-radio-button value="picki">
                    Utiliser le système de livraison Picki
                  </mat-radio-button>
                  <mat-radio-button value="own">
                    Utiliser ma propre livraison
                  </mat-radio-button>
                </mat-radio-group>

                <div *ngIf="restaurantForm.get('deliverySettings.deliverySystem')?.value === 'own'">
                  <mat-form-field appearance="outline" class="full-width">
                    <mat-label>Prix de livraison</mat-label>
                    <input
                      matInput
                      type="number"
                      inputmode="decimal"
                      min="0"
                      step="0.01"
                      formControlName="ownDeliveryPrice"
                      placeholder="0.00"
                    />
                    <mat-error *ngIf="restaurantForm.get('deliverySettings.ownDeliveryPrice')?.hasError('required')">
                      Le prix de livraison est requis.
                    </mat-error>
                    <mat-error *ngIf="restaurantForm.get('deliverySettings.ownDeliveryPrice')?.hasError('min')">
                      Le prix de livraison doit être positif.
                    </mat-error>
                  </mat-form-field>
                </div>
              </div>
            </mat-card-content>
          </mat-card>

          <!-- Payments Section -->
          <mat-card class="info-section" id="payments-section">
            <mat-card-header>
              <mat-icon mat-card-avatar>payments</mat-icon>
              <mat-card-title>Paiement</mat-card-title>
              <mat-card-subtitle
                >Activez/désactivez le paiement en ligne</mat-card-subtitle
              >
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

          <!-- Payment Providers Section (only shown when online payments enabled) -->
          <mat-card class="info-section" id="payment-providers" *ngIf="restaurantForm.get('payments.onlinePaymentsEnabled')?.value">
            <mat-card-header>
              <mat-icon mat-card-avatar>account_balance</mat-icon>
              <mat-card-title>Fournisseurs de paiement</mat-card-title>
              <mat-card-subtitle
                >Configurez vos méthodes de paiement en ligne</mat-card-subtitle
              >
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
                      >
                      </mat-radio-button>
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
                  <div class="provider-row">
                    <div class="provider-select">
                      <mat-radio-button
                        value="PAYGREEN"
                        [disabled]="isUpdatingProvider() || !paymentProvidersStatus()?.paygreen?.onboardingCompleted"
                      >
                      </mat-radio-button>
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
                        <span
                          *ngIf="!paymentProvidersStatus()?.paygreen?.configured"
                          class="provider-badge complete-setup"
                        >
                          Configuration plus complète
                        </span>
                      </div>
                      <p class="provider-description">
                        Solution de paiement éco-responsable.
                      </p>
                    </div>
                    <div class="provider-actions">
                      <button
                        *ngIf="!paymentProvidersStatus()?.paygreen?.configured"
                        mat-stroked-button
                        color="primary"
                        type="button"
                        (click)="onConfigurePaygreen()"
                      >
                        <mat-icon>settings</mat-icon>
                        Configurer mon compte
                      </button>
                    </div>
                  </div>
                </mat-radio-group>

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

          <!-- Custom Messages Section -->
          <mat-card class="info-section">
            <mat-card-header>
              <mat-icon mat-card-avatar>message</mat-icon>
              <mat-card-title>Messages personnalisés</mat-card-title>
              <mat-card-subtitle
                >Personnalisez les messages affichés à vos clients</mat-card-subtitle
              >
            </mat-card-header>
            <mat-card-content>
              <div class="contact-form" formGroupName="customMessages">
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Message de fermeture (titre)</mat-label>
                  <input
                    matInput
                    formControlName="closedMessage"
                    placeholder="On est fermé actuellement"
                  />
                  <mat-icon matSuffix>store</mat-icon>
                  <mat-hint>Titre affiché dans la popup quand le restaurant est fermé</mat-hint>
                </mat-form-field>

                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Description de fermeture</mat-label>
                  <input
                    matInput
                    formControlName="closedDescription"
                    placeholder="N'hésitez pas à revenir plus tard."
                  />
                  <mat-icon matSuffix>description</mat-icon>
                  <mat-hint>Description affichée sous le titre de la popup de fermeture</mat-hint>
                </mat-form-field>

                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Message de suspension des commandes</mat-label>
                  <input
                    matInput
                    formControlName="ordersSuspendedMessage"
                    placeholder="les commandes en ligne sont actuellement suspendues"
                  />
                  <mat-icon matSuffix>pause_circle</mat-icon>
                  <mat-hint>Message affiché dans la barre quand les commandes sont suspendues</mat-hint>
                </mat-form-field>
              </div>
            </mat-card-content>
          </mat-card>

          <!-- Stock Management Section -->
          <mat-card class="info-section">
            <mat-card-header>
              <mat-icon mat-card-avatar>inventory_2</mat-icon>
              <mat-card-title>Gestion des stocks</mat-card-title>
              <mat-card-subtitle
                >Paramètres de réinitialisation automatique</mat-card-subtitle
              >
            </mat-card-header>
            <mat-card-content>
              <div class="order-types">
                <mat-checkbox formControlName="dailyStockResetEnabled">
                  Effacer les stocks systématiquement quotidiennement
                </mat-checkbox>
              </div>
              <p class="hint-text">
                Si activé, tous les stocks seront remis à « illimité » chaque jour à minuit.
              </p>
            </mat-card-content>
          </mat-card>

          <!-- Contact Information Section -->
          <mat-card class="info-section">
            <mat-card-header>
              <mat-icon mat-card-avatar>contact_phone</mat-icon>
              <mat-card-title>Informations de contact</mat-card-title>
              <mat-card-subtitle
                >Vos coordonnées pour les clients</mat-card-subtitle
              >
            </mat-card-header>
            <mat-card-content>
              <div class="contact-form" formGroupName="contact">
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Téléphone</mat-label>
                  <input
                    matInput
                    formControlName="phone"
                    placeholder="+33 X XX XX XX XX"
                  />
                  <mat-icon matSuffix>phone</mat-icon>
                </mat-form-field>

                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Email</mat-label>
                  <input
                    matInput
                    type="email"
                    formControlName="email"
                    placeholder="contact@restaurant.fr"
                  />
                  <mat-icon matSuffix>email</mat-icon>
                </mat-form-field>

                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Site web</mat-label>
                  <input
                    matInput
                    type="url"
                    formControlName="website"
                    placeholder="https://restaurant.fr"
                  />
                  <mat-icon matSuffix>language</mat-icon>
                </mat-form-field>
              </div>
            </mat-card-content>
          </mat-card>

          <!-- Address Section -->
          <mat-card class="info-section">
            <mat-card-header>
              <mat-icon mat-card-avatar>location_on</mat-icon>
              <mat-card-title>Adresse du restaurant</mat-card-title>
              <mat-card-subtitle
                >Adresse physique de votre établissement</mat-card-subtitle
              >
            </mat-card-header>
            <mat-card-content>
              <div class="address-form" formGroupName="address">
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Adresse</mat-label>
                  <input
                    matInput
                    formControlName="street"
                    placeholder="123 Rue Example"
                  />
                  <mat-icon matSuffix>home</mat-icon>
                </mat-form-field>

                <div class="address-row">
                  <mat-form-field appearance="outline" class="postal-code">
                    <mat-label>Code postal</mat-label>
                    <input
                      matInput
                      formControlName="postal_code"
                      placeholder="37000"
                    />
                  </mat-form-field>

                  <mat-form-field appearance="outline" class="city">
                    <mat-label>Ville</mat-label>
                    <input
                      matInput
                      formControlName="city"
                      placeholder="Tours"
                    />
                  </mat-form-field>
                </div>

                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Pays</mat-label>
                  <input
                    matInput
                    formControlName="country"
                    placeholder="France"
                  />
                  <mat-icon matSuffix>public</mat-icon>
                </mat-form-field>
              </div>
            </mat-card-content>
          </mat-card>

          <!-- Action Buttons -->
          <div class="actions">
            <button
              mat-raised-button
              color="primary"
              type="submit"
              [disabled]="restaurantForm.invalid || isSaving()"
              class="save-button"
            >
              <mat-icon>save</mat-icon>
              {{
                isSaving()
                  ? 'Enregistrement...'
                  : 'Enregistrer les modifications'
              }}
            </button>

            <button
              mat-button
              type="button"
              (click)="onReset()"
              [disabled]="isSaving()"
              class="reset-button"
            >
              <mat-icon>refresh</mat-icon>
              Annuler les modifications
            </button>
          </div>
        </form>
      </div>

      <!-- Loading State -->
      <div class="loading" *ngIf="!restaurantForm">
        <mat-spinner diameter="50"></mat-spinner>
        <p>Chargement des informations...</p>
      </div>
    </div>
  `,
  styles: [
    `
      /* ===== Layout ===== */
      :host {
        display: block;
        background: var(--mat-sys-surface);
      }

      .restaurant-info-admin {
        padding: 24px;
        max-width: 800px;
        margin: 0 auto;
      }

      /* ===== Header ===== */
      .header {
        margin-bottom: 32px;
        padding: 24px;
        text-align: center;
        background: var(--mat-sys-surface-container-low);
        border-radius: var(--mat-sys-corner-extra-large);
      }

      .header h2 {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        margin: 0 0 8px 0;
        font: var(--mat-sys-headline-medium);
        color: var(--mat-sys-on-surface);
      }

      .header h2 mat-icon {
        color: var(--mat-sys-primary);
      }

      .subtitle {
        margin: 0;
        font: var(--mat-sys-body-medium);
        color: var(--mat-sys-on-surface-variant);
      }

      /* ===== Content ===== */
      .content {
        display: flex;
        flex-direction: column;
        gap: 24px;
        padding-bottom: 24px;
      }

      .info-section {
        background: var(--mat-sys-surface-container);
        border-radius: var(--mat-sys-corner-large);
        box-shadow: var(--mat-sys-level1);
        margin: 10px 0px;
      }

      .info-section mat-card-header {
        padding-bottom: 16px;
        border-bottom: 1px solid var(--mat-sys-surface-variant);
        margin-bottom: 16px;
      }

      .info-section mat-card-title {
        font: var(--mat-sys-title-medium);
      }

      .info-section mat-card-subtitle {
        font: var(--mat-sys-body-small);
        color: var(--mat-sys-on-surface-variant);
      }

      /* ===== Branding Section ===== */
      .branding-section mat-card-content {
        display: flex;
        flex-direction: column;
        gap: 24px;
      }

      .branding-item {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .branding-label {
        display: flex;
        align-items: flex-start;
        gap: 12px;
      }

      .branding-label mat-icon {
        color: var(--mat-sys-primary);
        margin-top: 2px;
      }

      .branding-label-text {
        display: flex;
        flex-direction: column;
        gap: 2px;
      }

      .label-title {
        font: var(--mat-sys-label-large);
        color: var(--mat-sys-on-surface);
      }

      .label-hint {
        font: var(--mat-sys-body-small);
        color: var(--mat-sys-on-surface-variant);
      }

      .banner-preview-container {
        width: 100%;
        max-height: 200px;
        border-radius: var(--mat-sys-corner-medium);
        overflow: hidden;
        border: 1px solid var(--mat-sys-outline-variant);
      }

      .banner-preview {
        width: 100%;
        height: 100%;
        object-fit: cover;
        display: block;
      }

      .branding-divider {
        margin: 8px 0;
      }

      /* ===== Business Hours ===== */
      .business-hours-form {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .day-row {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 12px 16px;
        background: var(--mat-sys-surface-container-high);
        border-radius: var(--mat-sys-corner-medium);
        transition: background-color 0.15s ease;
      }

      .day-row:hover {
        background: var(--mat-sys-surface-container-highest);
      }

      .day-info {
        min-width: 100px;
      }

      .day-name {
        font: var(--mat-sys-label-large);
        color: var(--mat-sys-on-surface);
      }

      .closed-checkbox {
        min-width: 80px;
      }

      .time-controls {
        display: flex;
        align-items: center;
        gap: 12px;
        flex: 1;
      }

      .time-field {
        width: 120px;
      }

      .time-separator {
        font: var(--mat-sys-body-large);
        color: var(--mat-sys-on-surface-variant);
      }

      .closed-indicator {
        flex: 1;
        text-align: center;
      }

      .closed-text {
        font: var(--mat-sys-body-medium);
        color: var(--mat-sys-error);
        font-style: italic;
      }

      /* ===== Forms ===== */
      .contact-form,
      .address-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .order-types {
        display: flex;
        flex-direction: column;
        gap: 12px;
        padding: 8px 0;
      }

      .delivery-settings {
        margin-top: 16px;
        padding: 16px;
        background: var(--mat-sys-surface-container-high);
        border: 1px solid var(--mat-sys-outline-variant);
        border-radius: var(--mat-sys-corner-medium);
      }

      .delivery-settings-title {
        margin: 0 0 16px 0;
        font: var(--mat-sys-title-small);
        color: var(--mat-sys-on-surface);
      }

      .delivery-system-radio {
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin-bottom: 16px;
      }

      .validation-error {
        margin-top: 8px;
        font: var(--mat-sys-body-small);
        color: var(--mat-sys-error);
      }

      .address-row {
        display: flex;
        gap: 16px;
      }

      .postal-code {
        flex: 0 0 140px;
      }

      .city {
        flex: 1;
      }

      .full-width {
        width: 100%;
      }

      .hint-text {
        margin: 12px 0 0 0;
        font: var(--mat-sys-body-small);
        color: var(--mat-sys-on-surface-variant);
      }

      /* ===== Actions ===== */
      .actions {
        display: flex;
        gap: 16px;
        justify-content: center;
        padding: 24px;
        margin-top: 8px;
        background: var(--mat-sys-surface-container-low);
        border-radius: var(--mat-sys-corner-large);
        position: sticky;
        bottom: 16px;
        box-shadow: var(--mat-sys-level2);
      }

      /* ===== Loading State ===== */
      .loading {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 16px;
        padding: 64px;
        background: var(--mat-sys-surface-container);
        border-radius: var(--mat-sys-corner-large);
      }

      .loading p {
        font: var(--mat-sys-body-medium);
        color: var(--mat-sys-on-surface-variant);
      }

      /* ===== Payment Providers ===== */
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
        transition: background-color 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
      }

      .provider-row:hover {
        background: var(--mat-sys-surface-container-highest);
        border-color: var(--mat-sys-outline);
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

      /* ===== Alerts ===== */
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

      /* ===== Section Highlight Animation ===== */
      .highlight-section {
        animation: highlight-pulse 2s ease-out;
      }

      @keyframes highlight-pulse {
        0% {
          box-shadow: 0 0 0 4px var(--mat-sys-primary);
        }
        100% {
          box-shadow: var(--mat-sys-level1);
        }
      }

      /* ===== Responsive ===== */
      @media (max-width: 600px) {
        .restaurant-info-admin {
          padding: 16px;
        }

        .header h2 {
          font: var(--mat-sys-headline-small);
        }

        .day-row {
          flex-direction: column;
          align-items: stretch;
          gap: 12px;
        }

        .day-info {
          min-width: unset;
        }

        .time-controls {
          justify-content: space-between;
        }

        .time-field {
          flex: 1;
          min-width: 0;
        }

        .address-row {
          flex-direction: column;
          gap: 0;
        }

        .postal-code {
          flex: 1;
        }

        .header {
          padding: 16px;
          margin: -16px -16px 24px -16px;
          border-radius: 0;
        }

        .actions {
          flex-direction: column;
          gap: 12px;
          margin: 8px -16px 0 -16px;
          padding: 16px;
          border-radius: 0;
          bottom: 0;
        }

        .actions button {
          width: 100%;
        }

        .provider-row {
          flex-wrap: wrap;
        }

        .provider-select {
          order: 1;
        }

        .provider-info {
          order: 2;
          flex: 1;
          min-width: 180px;
        }

        .provider-actions {
          order: 3;
          width: 100%;
          margin-top: 12px;
        }

        .provider-actions button {
          width: 100%;
          justify-content: center;
        }

        .provider-description {
          padding-left: 0;
          margin-top: 4px;
        }
      }
    `,
  ],
})
export class RestaurantInfoAdminComponent implements OnInit {
  private fb = inject(FormBuilder);
  private vendorService = inject(VendorService);
  private stripeService = inject(StripeService);
  private snackBar = inject(MatSnackBar);
  private cdr = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  restaurantForm: FormGroup | null = null;
  isSaving = signal(false);

  // Payment providers state
  paymentProvidersStatus = signal<PaymentProviderStatus | null>(null);
  isLoadingPaymentProviders = signal(true);
  isUpdatingProvider = signal(false);
  isCreatingStripeOnboarding = signal(false);

  private dayNames = [
    'Dimanche',
    'Lundi',
    'Mardi',
    'Mercredi',
    'Jeudi',
    'Vendredi',
    'Samedi',
  ];

  ngOnInit() {
    this.loadRestaurantInfo();
    this.loadPaymentProvidersStatus();
    this.checkStripeOnboardingReturn();
    this.handleFragmentNavigation();
  }

  private handleFragmentNavigation(): void {
    // Handle initial fragment from snapshot
    const fragment = this.route.snapshot.fragment;
    if (fragment) {
      this.scrollToFragment(fragment);
    }

    // Also subscribe to fragment changes
    this.route.fragment.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((frag) => {
      if (frag) {
        this.scrollToFragment(frag);
      }
    });
  }

  private scrollToFragment(fragment: string): void {
    // Delay to ensure the DOM is rendered
    setTimeout(() => {
      const element = document.getElementById(fragment);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Add a brief highlight effect
        element.classList.add('highlight-section');
        setTimeout(() => element.classList.remove('highlight-section'), 2000);
      }
    }, 500);
  }

  private checkStripeOnboardingReturn() {
    // Check query params immediately (for page reload/redirect from Stripe)
    const params = this.route.snapshot.queryParams;
    const stripeOnboarding = params['stripe_onboarding'];

    console.log('Checking Stripe onboarding return, param:', stripeOnboarding);

    if (stripeOnboarding === 'success' || stripeOnboarding === 'refresh') {
      console.log('Stripe onboarding return detected, verifying status...');

      // Clear the query param from URL
      this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { stripe_onboarding: null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });

      // Check onboarding status with Stripe (with small delay to ensure vendor is loaded)
      setTimeout(() => {
        this.verifyStripeOnboardingStatus();
      }, 500);
    }
  }

  private verifyStripeOnboardingStatus() {
    const currentVendor = this.vendorService.getCurrentVendor();
    if (!currentVendor) return;

    this.snackBar.open('Vérification du statut Stripe...', '', {
      duration: 2000,
    });

    this.stripeService.checkOnboardingStatus(currentVendor.id).subscribe({
      next: (status) => {
        if (status.onboarding_complete) {
          this.snackBar.open('Configuration Stripe terminée avec succès!', 'Fermer', {
            duration: 5000,
            panelClass: ['success-snackbar'],
          });
          // Reload payment providers status and auto-select Stripe
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

      // Auto-select Stripe if it's now configured
      if (status.stripe.configured) {
        await this.onProviderSelect('STRIPE');
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

  async onProviderSelect(provider: 'STRIPE' | 'PAYGREEN' | null) {
    if (!provider) return;

    const currentStatus = this.paymentProvidersStatus();
    if (!currentStatus) return;

    // Don't update if already selected
    if (currentStatus.selectedProvider === provider) {
      return;
    }

    this.isUpdatingProvider.set(true);
    try {
      await this.vendorService.updatePaymentProvider(provider);
      this.paymentProvidersStatus.set({
        ...currentStatus,
        selectedProvider: provider,
      });
      this.snackBar.open(`Fournisseur de paiement changé vers ${provider === 'STRIPE' ? 'Stripe' : 'PayGreen'}`, 'Fermer', {
        duration: 3000,
        panelClass: ['success-snackbar'],
      });
    } catch (error) {
      console.error('Error updating payment provider:', error);
      this.snackBar.open('Erreur lors de la mise à jour du fournisseur', 'Fermer', {
        duration: 5000,
        panelClass: ['error-snackbar'],
      });
      // Reload to reset the radio group state
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
    const returnUrl = `${baseUrl}/admin/restaurant-info?stripe_onboarding=success`;
    const refreshUrl = `${baseUrl}/admin/restaurant-info?stripe_onboarding=refresh`;

    this.stripeService.createOnboardingLink(currentVendor.id, refreshUrl, returnUrl).subscribe({
      next: (response) => {
        this.isCreatingStripeOnboarding.set(false);
        // Open Stripe onboarding in new tab
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
    // Open PayGreen signup page in a new tab
    window.open('https://app.paygreen.fr/auth/signup', '_blank');
    this.snackBar.open('Redirection vers PayGreen pour créer votre compte...', 'Fermer', {
      duration: 5000,
    });
  }

  get businessHoursArray(): FormArray {
    return this.restaurantForm?.get('businessHours') as FormArray;
  }

  getDayName(index: number): string {
    return this.dayNames[index];
  }

  private async loadRestaurantInfo() {
    try {
      this.vendorService.getRestaurantInfo().subscribe(async (info) => {
        console.log('Received info:', info);
        if (info) {
          // Load banner from banners table
          let bannerUrl = '';
          try {
            const banner = await this.vendorService.getVendorBanner(info.vendor.id);
            bannerUrl = banner?.image_url || '';
          } catch (error) {
            console.warn('Could not load vendor banner:', error);
          }
          this.initializeForm(info, bannerUrl);
        } else {
          this.initializeEmptyForm();
        }
        // Trigger change detection after form initialization
        this.cdr.detectChanges();
      });
    } catch (error) {
      console.error('Error loading restaurant info:', error);
      this.initializeEmptyForm();
      this.cdr.detectChanges();
    }
  }

  private initializeForm(info: RestaurantInfo, bannerUrl: string = '') {
    const enabledTypes = info.vendor.enabled_order_types;
    this.restaurantForm = this.fb.group({
      bannerUrl: [bannerUrl],
      logoUrl: [info.vendor.logo_url || ''],
      businessHours: this.fb.array(
        this.createBusinessHoursControls(info.businessHours)
      ),
      orderTypes: this.createOrderTypesGroup(enabledTypes),
      deliverySettings: this.fb.group({
        deliverySystem: [
          (info.vendor as any).delivery_system === 'own' ? 'own' : 'picki',
          [Validators.required],
        ],
        ownDeliveryPrice: [
          Number((info.vendor as any).own_delivery_price ?? 0),
          [Validators.min(0)],
        ],
      }),
      payments: this.fb.group({
        onlinePaymentsEnabled: [info.vendor.online_payments_enabled ?? true],
      }),
      customMessages: this.fb.group({
        closedMessage: [info.vendor.closed_message || ''],
        closedDescription: [info.vendor.closed_description || ''],
        ordersSuspendedMessage: [info.vendor.orders_suspended_message || ''],
      }),
      dailyStockResetEnabled: [(info.vendor as any).daily_stock_reset_enabled ?? true],
      contact: this.fb.group({
        phone: [info.contact.phone || '', []],
        email: [info.contact.email || '', [Validators.email]],
        website: [info.contact.website || '', []],
      }),
      address: this.fb.group({
        street: [info.address.street || ''],
        city: [info.address.city || ''],
        postal_code: [info.address.postal_code || ''],
        country: [info.address.country || ''],
      }),
    });
    console.log('Form initialized:', this.restaurantForm);
    this.setupDeliverySettingsBehavior();
  }

  private initializeEmptyForm() {
    this.restaurantForm = this.fb.group({
      bannerUrl: [''],
      logoUrl: [''],
      businessHours: this.fb.array(this.createEmptyBusinessHoursControls()),
      orderTypes: this.createOrderTypesGroup(['take-away', 'eat-in', 'delivery']),
      deliverySettings: this.fb.group({
        deliverySystem: ['picki', [Validators.required]],
        ownDeliveryPrice: [0, [Validators.min(0)]],
      }),
      payments: this.fb.group({
        onlinePaymentsEnabled: [true],
      }),
      customMessages: this.fb.group({
        closedMessage: [''],
        closedDescription: [''],
        ordersSuspendedMessage: [''],
      }),
      dailyStockResetEnabled: [true],
      contact: this.fb.group({
        phone: ['', []],
        email: ['', [Validators.email]],
        website: ['', []],
      }),
      address: this.fb.group({
        street: [''],
        city: [''],
        postal_code: [''],
        country: ['France'],
      }),
    });
    console.log('Empty form initialized:', this.restaurantForm);
    this.setupDeliverySettingsBehavior();
  }

  private setupDeliverySettingsBehavior(): void {
    if (!this.restaurantForm) return;

    const deliveryEnabledCtrl = this.restaurantForm.get('orderTypes.delivery');
    const deliverySettingsGroup = this.restaurantForm.get(
      'deliverySettings'
    ) as FormGroup | null;
    const systemCtrl = deliverySettingsGroup?.get('deliverySystem');
    const ownPriceCtrl = deliverySettingsGroup?.get('ownDeliveryPrice');

    if (!deliveryEnabledCtrl || !deliverySettingsGroup || !systemCtrl || !ownPriceCtrl) {
      return;
    }

    const applyValidators = () => {
      const deliveryEnabled = !!deliveryEnabledCtrl.value;
      const system = (systemCtrl.value as 'picki' | 'own' | null) ?? 'picki';

      if (!deliveryEnabled) {
        // Reset to safe defaults when delivery is disabled
        deliverySettingsGroup.patchValue(
          { deliverySystem: 'picki', ownDeliveryPrice: 0 },
          { emitEvent: false }
        );
        ownPriceCtrl.clearValidators();
        ownPriceCtrl.setValidators([Validators.min(0)]);
      } else if (system === 'own') {
        // Own delivery requires an explicit price
        ownPriceCtrl.setValidators([Validators.required, Validators.min(0)]);
      } else {
        // Picki delivery doesn't require a fixed price
        ownPriceCtrl.clearValidators();
        ownPriceCtrl.setValidators([Validators.min(0)]);
      }

      ownPriceCtrl.updateValueAndValidity({ emitEvent: false });
      this.cdr.detectChanges();
    };

    deliveryEnabledCtrl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => applyValidators());

    systemCtrl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => applyValidators());

    // Apply once for initial state
    applyValidators();
  }

  private createOrderTypesGroup(enabled: OrderType[] | null | undefined): FormGroup {
    const enabledSet = new Set<OrderType>(enabled ?? ['take-away', 'eat-in', 'delivery']);

    return this.fb.group(
      {
        takeAway: [enabledSet.has('take-away')],
        eatIn: [enabledSet.has('eat-in')],
        delivery: [enabledSet.has('delivery')],
      },
      { validators: [this.atLeastOneTrueValidator()] }
    );
  }

  private atLeastOneTrueValidator(): ValidatorFn {
    return (control: AbstractControl): ValidationErrors | null => {
      const value = control.value as
        | { takeAway?: boolean; eatIn?: boolean; delivery?: boolean }
        | null
        | undefined;

      const hasOne =
        !!value?.takeAway || !!value?.eatIn || !!value?.delivery;

      return hasOne ? null : { atLeastOne: true };
    };
  }

  private createBusinessHoursControls(
    businessHours: BusinessHours[]
  ): FormGroup[] {
    // Sort business hours by day (starting with Sunday = 0)
    const sortedHours = [...businessHours].sort((a, b) => {
      const dayOrder = [
        'Dimanche',
        'Lundi',
        'Mardi',
        'Mercredi',
        'Jeudi',
        'Vendredi',
        'Samedi',
      ];
      return dayOrder.indexOf(a.day) - dayOrder.indexOf(b.day);
    });

    return sortedHours.map((hours) =>
      this.fb.group({
        is_closed: [hours.is_closed],
        open_time: [
          hours.open_time,
          hours.is_closed ? [] : [Validators.required],
        ],
        close_time: [
          hours.close_time,
          hours.is_closed ? [] : [Validators.required],
        ],
      })
    );
  }

  private createEmptyBusinessHoursControls(): FormGroup[] {
    return this.dayNames.map(() =>
      this.fb.group({
        is_closed: [false],
        open_time: ['11:00', [Validators.required]],
        close_time: ['23:00', [Validators.required]],
      })
    );
  }

  onClosedToggle(dayIndex: number) {
    const dayControl = this.businessHoursArray.at(dayIndex);
    const isClosed = dayControl.get('is_closed')?.value;

    if (isClosed) {
      dayControl.get('open_time')?.setValue(null);
      dayControl.get('close_time')?.setValue(null);
      dayControl.get('open_time')?.clearValidators();
      dayControl.get('close_time')?.clearValidators();
    } else {
      dayControl.get('open_time')?.setValue('11:00');
      dayControl.get('close_time')?.setValue('23:00');
      dayControl.get('open_time')?.setValidators([Validators.required]);
      dayControl.get('close_time')?.setValidators([Validators.required]);
    }

    dayControl.get('open_time')?.updateValueAndValidity();
    dayControl.get('close_time')?.updateValueAndValidity();
  }

  async onSave() {
    if (!this.restaurantForm || this.restaurantForm.invalid) {
      return;
    }

    this.isSaving.set(true);

    try {
      const formValue = this.restaurantForm.value as any;
      const currentVendor = this.vendorService.getCurrentVendor();

      if (!currentVendor) {
        throw new Error('No vendor selected');
      }

      const enabledOrderTypes: OrderType[] = [];
      if (formValue.orderTypes?.takeAway) enabledOrderTypes.push('take-away');
      if (formValue.orderTypes?.eatIn) enabledOrderTypes.push('eat-in');
      if (formValue.orderTypes?.delivery) enabledOrderTypes.push('delivery');

      // Save banner and logo URLs
      const bannerUrl = formValue.bannerUrl || '';
      const logoUrl = formValue.logoUrl || '';

      // Update banner in banners table if provided
      if (bannerUrl) {
        await this.vendorService.upsertVendorBanner(currentVendor.id, bannerUrl);
      }

      // Update logo if changed
      if (logoUrl !== currentVendor.logo_url) {
        await this.vendorService.updateVendorLogo(currentVendor.id, logoUrl);
      }

      // Save other restaurant info
      await this.saveRestaurantInfo({
        businessHours: formValue.businessHours,
        contact: formValue.contact,
        address: formValue.address,
        enabledOrderTypes,
        onlinePaymentsEnabled: !!formValue.payments?.onlinePaymentsEnabled,
        dailyStockResetEnabled: !!formValue.dailyStockResetEnabled,
        deliverySettings: {
          deliverySystem:
            formValue.deliverySettings?.deliverySystem === 'own' ? 'own' : 'picki',
          ownDeliveryPrice: Number(formValue.deliverySettings?.ownDeliveryPrice ?? 0),
        },
        customMessages: {
          closed_message: formValue.customMessages?.closedMessage?.trim() || null,
          closed_description: formValue.customMessages?.closedDescription?.trim() || null,
          orders_suspended_message: formValue.customMessages?.ordersSuspendedMessage?.trim() || null,
        },
      });

      this.snackBar.open('Informations sauvegardées avec succès', 'Fermer', {
        duration: 3000,
        panelClass: ['success-snackbar'],
      });
    } catch (error) {
      console.error('Error saving restaurant info:', error);
      this.snackBar.open('Erreur lors de la sauvegarde', 'Fermer', {
        duration: 5000,
        panelClass: ['error-snackbar'],
      });
    } finally {
      this.isSaving.set(false);
    }
  }

  private async saveRestaurantInfo(formData: any) {
    try {
      await this.vendorService.saveRestaurantInfo(formData);
    } catch (error) {
      console.error('Error saving restaurant info:', error);
      throw error;
    }
  }

  onReset() {
    this.loadRestaurantInfo();
    this.snackBar.open('Modifications annulées', 'Fermer', {
      duration: 2000,
    });
  }
}
