import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  FormGroup,
  Validators,
  type AbstractControl,
  type ValidationErrors,
  type ValidatorFn,
} from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatRadioModule } from '@angular/material/radio';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { VendorService, type OrderType } from '../../../../services/vendor.service';
import { RestaurantInfoDataService } from '../../restaurant-info-data.service';

@Component({
  selector: 'app-commandes',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatCheckboxModule,
    MatRadioModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatButtonModule,
    MatSnackBarModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form [formGroup]="form" (ngSubmit)="onSave()">
      <mat-card class="info-section">
        <mat-card-header>
          <mat-icon mat-card-avatar>restaurant_menu</mat-icon>
          <mat-card-title>Modes de commande</mat-card-title>
          <mat-card-subtitle>Choisissez quels modes afficher sur l'écran d'accueil</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <div class="order-types" formGroupName="orderTypes">
            <mat-checkbox formControlName="takeAway">À emporter</mat-checkbox>
            <mat-checkbox formControlName="eatIn">Sur place</mat-checkbox>
            <mat-checkbox formControlName="delivery">Livraison</mat-checkbox>
          </div>

          <div class="validation-error" *ngIf="form.get('orderTypes')?.hasError('atLeastOne')">
            Sélectionnez au moins un mode de commande.
          </div>

          <!-- Delivery settings -->
          <div
            class="delivery-settings"
            *ngIf="form.get('orderTypes.delivery')?.value"
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

            <div *ngIf="form.get('deliverySettings.deliverySystem')?.value === 'own'">
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
                <mat-error *ngIf="form.get('deliverySettings.ownDeliveryPrice')?.hasError('required')">
                  Le prix de livraison est requis.
                </mat-error>
                <mat-error *ngIf="form.get('deliverySettings.ownDeliveryPrice')?.hasError('min')">
                  Le prix de livraison doit être positif.
                </mat-error>
              </mat-form-field>
            </div>
          </div>
        </mat-card-content>
      </mat-card>

      <div class="actions">
        <button
          mat-raised-button
          color="primary"
          type="submit"
          [disabled]="form.invalid || isSaving()"
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
  `],
})
export class CommandesComponent implements OnInit {
  private fb = inject(FormBuilder);
  private vendorService = inject(VendorService);
  private dataService = inject(RestaurantInfoDataService);
  private snackBar = inject(MatSnackBar);
  private cdr = inject(ChangeDetectorRef);
  private destroyRef = inject(DestroyRef);

  form!: FormGroup;
  isSaving = signal(false);

  ngOnInit() {
    const info = this.dataService.restaurantInfo();
    const enabledTypes = info?.vendor.enabled_order_types;

    this.form = this.fb.group({
      orderTypes: this.createOrderTypesGroup(enabledTypes),
      deliverySettings: this.fb.group({
        deliverySystem: [
          (info?.vendor as any)?.delivery_system === 'own' ? 'own' : 'picki',
          [Validators.required],
        ],
        ownDeliveryPrice: [
          Number((info?.vendor as any)?.own_delivery_price ?? 0),
          [Validators.min(0)],
        ],
      }),
    });

    this.setupDeliverySettingsBehavior();
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
      const hasOne = !!value?.takeAway || !!value?.eatIn || !!value?.delivery;
      return hasOne ? null : { atLeastOne: true };
    };
  }

  private setupDeliverySettingsBehavior(): void {
    const deliveryEnabledCtrl = this.form.get('orderTypes.delivery');
    const deliverySettingsGroup = this.form.get('deliverySettings') as FormGroup | null;
    const systemCtrl = deliverySettingsGroup?.get('deliverySystem');
    const ownPriceCtrl = deliverySettingsGroup?.get('ownDeliveryPrice');

    if (!deliveryEnabledCtrl || !deliverySettingsGroup || !systemCtrl || !ownPriceCtrl) {
      return;
    }

    const applyValidators = () => {
      const deliveryEnabled = !!deliveryEnabledCtrl.value;
      const system = (systemCtrl.value as 'picki' | 'own' | null) ?? 'picki';

      if (!deliveryEnabled) {
        deliverySettingsGroup.patchValue(
          { deliverySystem: 'picki', ownDeliveryPrice: 0 },
          { emitEvent: false }
        );
        ownPriceCtrl.clearValidators();
        ownPriceCtrl.setValidators([Validators.min(0)]);
      } else if (system === 'own') {
        ownPriceCtrl.setValidators([Validators.required, Validators.min(0)]);
      } else {
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

    applyValidators();
  }

  async onSave() {
    if (this.form.invalid) return;
    this.isSaving.set(true);
    try {
      const formValue = this.form.value;
      const enabledOrderTypes: OrderType[] = [];
      if (formValue.orderTypes?.takeAway) enabledOrderTypes.push('take-away');
      if (formValue.orderTypes?.eatIn) enabledOrderTypes.push('eat-in');
      if (formValue.orderTypes?.delivery) enabledOrderTypes.push('delivery');

      await this.vendorService.saveRestaurantInfo({
        enabledOrderTypes,
        deliverySettings: {
          deliverySystem:
            formValue.deliverySettings?.deliverySystem === 'own' ? 'own' : 'picki',
          ownDeliveryPrice: Number(formValue.deliverySettings?.ownDeliveryPrice ?? 0),
        },
      });
      await this.dataService.refreshVendor();
      this.snackBar.open('Modes de commande sauvegardés', 'Fermer', { duration: 3000, panelClass: ['success-snackbar'] });
    } catch {
      this.snackBar.open('Erreur lors de la sauvegarde', 'Fermer', { duration: 5000, panelClass: ['error-snackbar'] });
    } finally {
      this.isSaving.set(false);
    }
  }

  onReset() {
    const info = this.dataService.restaurantInfo();
    const enabledTypes = info?.vendor.enabled_order_types;
    const enabledSet = new Set<OrderType>(enabledTypes ?? ['take-away', 'eat-in', 'delivery']);
    this.form.patchValue({
      orderTypes: {
        takeAway: enabledSet.has('take-away'),
        eatIn: enabledSet.has('eat-in'),
        delivery: enabledSet.has('delivery'),
      },
      deliverySettings: {
        deliverySystem: (info?.vendor as any)?.delivery_system === 'own' ? 'own' : 'picki',
        ownDeliveryPrice: Number((info?.vendor as any)?.own_delivery_price ?? 0),
      },
    });
    this.snackBar.open('Modifications annulées', 'Fermer', { duration: 2000 });
  }
}
