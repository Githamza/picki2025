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
import { materialComponents } from '../../material.components';
import {
  VendorService,
  type RestaurantInfo,
  type BusinessHours,
  type OrderType,
} from '../../services/vendor.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-restaurant-info-admin',
  imports: [CommonModule, ReactiveFormsModule, ...materialComponents],
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
            </mat-card-content>
          </mat-card>

          <!-- Payments Section -->
          <mat-card class="info-section">
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
              <p class="subtitle" style="margin: 8px 0 0 0">
                Si désactivé, les commandes seront créées avec la mention « À payer au retrait ».
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
      .restaurant-info-admin {
        padding: 24px;
        max-width: 1200px;
        margin: 0 auto;
      }

      .header {
        margin-bottom: 32px;
        text-align: center;
      }

      .header h2 {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 12px;
        margin: 0 0 8px 0;
        color: var(--mat-sys-primary);
      }

      .subtitle {
        margin: 0;
        color: var(--mat-sys-on-surface-variant);
      }

      .content {
        display: flex;
        flex-direction: column;
        gap: 24px;
      }

      .info-section {
        border-radius: 16px;
      }

      .business-hours-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .day-row {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 12px 0;
        border-bottom: 1px solid var(--mat-sys-outline-variant);
      }

      .day-row:last-child {
        border-bottom: none;
      }

      .day-info {
        min-width: 100px;
      }

      .day-name {
        font-weight: 500;
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
        color: var(--mat-sys-on-surface-variant);
      }

      .closed-indicator {
        flex: 1;
        text-align: center;
      }

      .closed-text {
        color: var(--mat-sys-error);
        font-style: italic;
      }

      .contact-form,
      .address-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .order-types {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 8px 0;
      }

      .validation-error {
        margin-top: 8px;
        color: var(--mat-sys-error);
        font-size: 12px;
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

      .actions {
        display: flex;
        gap: 16px;
        justify-content: center;
        padding: 24px 0;
      }

      .save-button {
        border-radius: 24px;
        padding: 0 32px;
      }

      .reset-button {
        border-radius: 24px;
        padding: 0 24px;
      }

      .loading {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 16px;
        padding: 64px;
        color: var(--mat-sys-on-surface-variant);
      }

      @media (max-width: 768px) {
        .restaurant-info-admin {
          padding: 16px;
        }

        .day-row {
          flex-direction: column;
          align-items: stretch;
          gap: 12px;
        }

        .time-controls {
          justify-content: space-between;
        }

        .address-row {
          flex-direction: column;
          gap: 16px;
        }

        .actions {
          flex-direction: column;
        }
      }
    `,
  ],
})
export class RestaurantInfoAdminComponent implements OnInit {
  private fb = inject(FormBuilder);
  private vendorService = inject(VendorService);
  private snackBar = inject(MatSnackBar);
  private cdr = inject(ChangeDetectorRef);

  restaurantForm: FormGroup | null = null;
  isSaving = signal(false);

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
  }

  get businessHoursArray(): FormArray {
    return this.restaurantForm?.get('businessHours') as FormArray;
  }

  getDayName(index: number): string {
    return this.dayNames[index];
  }

  private async loadRestaurantInfo() {
    try {
      this.vendorService.getRestaurantInfo().subscribe((info) => {
        console.log('Received info:', info);
        if (info) {
          this.initializeForm(info);
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

  private initializeForm(info: RestaurantInfo) {
    const enabledTypes = info.vendor.enabled_order_types;
    this.restaurantForm = this.fb.group({
      businessHours: this.fb.array(
        this.createBusinessHoursControls(info.businessHours)
      ),
      orderTypes: this.createOrderTypesGroup(enabledTypes),
      payments: this.fb.group({
        onlinePaymentsEnabled: [info.vendor.online_payments_enabled ?? true],
      }),
      contact: this.fb.group({
        phone: [info.contact.phone || '', []],
        email: [info.contact.email || '', [Validators.email]],
        website: [info.contact.website || '', []],
      }),
      address: this.fb.group({
        street: [info.address.street || '', [Validators.required]],
        city: [info.address.city || '', [Validators.required]],
        postal_code: [info.address.postal_code || '', [Validators.required]],
        country: [info.address.country || '', [Validators.required]],
      }),
    });
    console.log('Form initialized:', this.restaurantForm);
  }

  private initializeEmptyForm() {
    this.restaurantForm = this.fb.group({
      businessHours: this.fb.array(this.createEmptyBusinessHoursControls()),
      orderTypes: this.createOrderTypesGroup(['take-away', 'eat-in', 'delivery']),
      payments: this.fb.group({
        onlinePaymentsEnabled: [true],
      }),
      contact: this.fb.group({
        phone: ['', []],
        email: ['', [Validators.email]],
        website: ['', []],
      }),
      address: this.fb.group({
        street: ['', [Validators.required]],
        city: ['', [Validators.required]],
        postal_code: ['', [Validators.required]],
        country: ['France', [Validators.required]],
      }),
    });
    console.log('Empty form initialized:', this.restaurantForm);
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

      const enabledOrderTypes: OrderType[] = [];
      if (formValue.orderTypes?.takeAway) enabledOrderTypes.push('take-away');
      if (formValue.orderTypes?.eatIn) enabledOrderTypes.push('eat-in');
      if (formValue.orderTypes?.delivery) enabledOrderTypes.push('delivery');

      // Here we would call the service to save the data
      // For now, we'll show a success message
      await this.saveRestaurantInfo({
        businessHours: formValue.businessHours,
        contact: formValue.contact,
        address: formValue.address,
        enabledOrderTypes,
        onlinePaymentsEnabled: !!formValue.payments?.onlinePaymentsEnabled,
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
