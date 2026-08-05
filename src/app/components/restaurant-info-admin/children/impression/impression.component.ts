import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatRadioModule } from '@angular/material/radio';
import { MatSelectModule } from '@angular/material/select';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { PairedDevice, ThermalPrinter } from '../../../../native/thermal-printer.plugin';
import { PrinterSettingsService } from '../../../../services/printer-settings.service';
import { TicketPrintService } from '../../../../services/ticket-print.service';
import { VendorService } from '../../../../services/vendor.service';
import {
  CODE_PAGE_PC437,
  CODE_PAGE_PC858,
  CODE_PAGE_WPC1252,
} from '../../../../shared/utils/escpos-builder';
import { RestaurantInfoDataService } from '../../restaurant-info-data.service';

@Component({
  selector: 'app-impression',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatCardModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatRadioModule,
    MatSelectModule,
    MatSnackBarModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <form [formGroup]="form" (ngSubmit)="onSave()">
      <mat-card class="info-section">
        <mat-card-header>
          <mat-icon mat-card-avatar>print</mat-icon>
          <mat-card-title>Impression des tickets</mat-card-title>
          <mat-card-subtitle>Imprimante thermique Bluetooth</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content>
          <div class="order-types">
            <mat-checkbox formControlName="autoPrintEnabled">
              Imprimer automatiquement les tickets des nouvelles commandes
            </mat-checkbox>
          </div>
          <p class="hint-text">
            Ce réglage s'applique à votre restaurant. L'impression n'a lieu que sur
            les tablettes Android configurées ci-dessous.
          </p>
        </mat-card-content>
      </mat-card>

      @if (!isNative) {
        <mat-card class="info-section">
          <mat-card-content>
            <p class="hint-text">
              <mat-icon>info</mat-icon>
              L'imprimante se configure depuis l'application Android installée sur
              la tablette. Cette page n'affiche que le réglage du restaurant.
            </p>
          </mat-card-content>
        </mat-card>
      } @else {
        <mat-card class="info-section">
          <mat-card-header>
            <mat-icon mat-card-avatar>bluetooth</mat-icon>
            <mat-card-title>Imprimante de cette tablette</mat-card-title>
            <mat-card-subtitle>
              Réglages enregistrés sur cet appareil uniquement
            </mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <div class="printer-row">
              <mat-form-field appearance="outline" class="printer-select">
                <mat-label>Imprimante appairée</mat-label>
                <mat-select formControlName="address">
                  <mat-option value="">Aucune</mat-option>
                  @for (device of devices(); track device.address) {
                    <mat-option [value]="device.address">
                      {{ device.name }} ({{ device.address }})
                    </mat-option>
                  }
                </mat-select>
              </mat-form-field>

              <button
                mat-stroked-button
                type="button"
                (click)="onRefreshDevices()"
                [disabled]="isScanning()"
              >
                @if (isScanning()) {
                  <mat-spinner diameter="18"></mat-spinner>
                } @else {
                  <mat-icon>refresh</mat-icon>
                }
                Rechercher
              </button>
            </div>

            <p class="hint-text">
              L'imprimante doit d'abord être appairée dans les réglages Bluetooth
              d'Android. Seuls les appareils déjà appairés apparaissent ici.
            </p>

            <div class="paper-width">
              <label class="field-label">Largeur du papier</label>
              <mat-radio-group formControlName="paperWidth">
                <mat-radio-button [value]="58">58 mm (32 colonnes)</mat-radio-button>
                <mat-radio-button [value]="80">80 mm (48 colonnes)</mat-radio-button>
              </mat-radio-group>
            </div>

            <mat-form-field appearance="outline" class="code-page">
              <mat-label>Jeu de caractères</mat-label>
              <mat-select formControlName="codePage">
                <mat-option [value]="codePagePc858">PC858 - accents + euro (défaut)</mat-option>
                <mat-option [value]="codePageWpc1252">Windows-1252</mat-option>
                <mat-option [value]="codePagePc437">PC437 - sans accents</mat-option>
              </mat-select>
              <mat-hint>
                À changer uniquement si les accents s'impriment mal.
              </mat-hint>
            </mat-form-field>

            <div class="order-types">
              <mat-checkbox formControlName="autoPrint">
                Imprimer les nouvelles commandes sur cette tablette
              </mat-checkbox>
            </div>

            <mat-form-field appearance="outline" class="copies">
              <mat-label>Nombre d'exemplaires</mat-label>
              <mat-select formControlName="copies">
                <mat-option [value]="1">1</mat-option>
                <mat-option [value]="2">2</mat-option>
                <mat-option [value]="3">3</mat-option>
              </mat-select>
            </mat-form-field>

            <button
              mat-stroked-button
              type="button"
              (click)="onPrintTest()"
              [disabled]="isTesting() || !form.value.address"
            >
              @if (isTesting()) {
                <mat-spinner diameter="18"></mat-spinner>
              } @else {
                <mat-icon>receipt_long</mat-icon>
              }
              Imprimer un ticket de test
            </button>
          </mat-card-content>
        </mat-card>
      }

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
  styles: [
    `
      @use '../../../restaurant-info-admin/children/shared-styles' as shared;
      @include shared.child-section;

      .printer-row {
        display: flex;
        align-items: flex-start;
        gap: 12px;
        flex-wrap: wrap;
      }

      .printer-select {
        flex: 1 1 320px;
      }

      .paper-width {
        margin: 16px 0;

        .field-label {
          display: block;
          margin-bottom: 8px;
          font-weight: 500;
        }

        mat-radio-group {
          display: flex;
          gap: 24px;
          flex-wrap: wrap;
        }
      }

      .code-page,
      .copies {
        display: block;
        max-width: 320px;
        margin-bottom: 8px;
      }
    `,
  ],
})
export class ImpressionComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly vendorService = inject(VendorService);
  private readonly dataService = inject(RestaurantInfoDataService);
  private readonly printerSettings = inject(PrinterSettingsService);
  private readonly ticketPrint = inject(TicketPrintService);
  private readonly snackBar = inject(MatSnackBar);

  readonly isNative = this.printerSettings.isNative;
  readonly codePagePc858 = CODE_PAGE_PC858;
  readonly codePageWpc1252 = CODE_PAGE_WPC1252;
  readonly codePagePc437 = CODE_PAGE_PC437;

  form!: FormGroup;
  readonly devices = signal<PairedDevice[]>([]);
  readonly isSaving = signal(false);
  readonly isScanning = signal(false);
  readonly isTesting = signal(false);

  async ngOnInit() {
    const settings = await this.printerSettings.load();

    this.form = this.fb.group({
      autoPrintEnabled: [this.vendorAutoPrintEnabled()],
      address: [settings.address],
      paperWidth: [settings.paperWidth],
      codePage: [settings.codePage],
      autoPrint: [settings.autoPrint],
      copies: [settings.copies],
    });

    if (this.isNative) {
      // Show the saved printer even before a scan completes.
      if (settings.address) {
        this.devices.set([
          { address: settings.address, name: settings.name || settings.address },
        ]);
      }
      await this.onRefreshDevices({ silent: true });
    }
  }

  async onRefreshDevices(options: { silent?: boolean } = {}): Promise<void> {
    this.isScanning.set(true);
    try {
      const { granted } = await ThermalPrinter.requestBluetoothPermission();
      if (!granted) {
        this.notify("Autorisation Bluetooth refusée", true);
        return;
      }

      const { enabled } = await ThermalPrinter.isEnabled();
      if (!enabled) {
        this.notify('Le Bluetooth est désactivé', true);
        return;
      }

      const { devices } = await ThermalPrinter.listPairedDevices();
      this.devices.set(devices);

      if (!options.silent) {
        this.notify(
          devices.length
            ? `${devices.length} appareil(s) appairé(s)`
            : 'Aucun appareil appairé. Appairez l\'imprimante dans les réglages Android.',
          !devices.length
        );
      }
    } catch (error) {
      if (!options.silent) {
        this.notify(this.ticketPrint.describeError(error), true);
      }
    } finally {
      this.isScanning.set(false);
    }
  }

  async onPrintTest(): Promise<void> {
    this.isTesting.set(true);
    try {
      // Test with the values on screen, not the last saved ones.
      await this.ticketPrint.printTestTicket({
        address: this.form.value.address,
        columns: this.form.value.paperWidth === 80 ? 48 : 32,
        codePage: this.form.value.codePage,
      });
      this.notify('Ticket de test envoyé');
    } catch (error) {
      this.notify(this.ticketPrint.describeError(error), true);
    } finally {
      this.isTesting.set(false);
    }
  }

  async onSave(): Promise<void> {
    this.isSaving.set(true);
    try {
      await this.vendorService.saveRestaurantInfo({
        autoPrintEnabled: !!this.form.value.autoPrintEnabled,
      });
      await this.dataService.refreshVendor();

      if (this.isNative) {
        const selected = this.devices().find((d) => d.address === this.form.value.address);
        await this.printerSettings.save({
          address: this.form.value.address || '',
          name: selected?.name ?? '',
          paperWidth: this.form.value.paperWidth,
          codePage: this.form.value.codePage,
          autoPrint: !!this.form.value.autoPrint,
          copies: this.form.value.copies,
        });
      }

      this.notify("Paramètres d'impression sauvegardés");
    } catch {
      this.notify('Erreur lors de la sauvegarde', true);
    } finally {
      this.isSaving.set(false);
    }
  }

  onReset(): void {
    const settings = this.printerSettings.settings();
    this.form.patchValue({
      autoPrintEnabled: this.vendorAutoPrintEnabled(),
      address: settings.address,
      paperWidth: settings.paperWidth,
      codePage: settings.codePage,
      autoPrint: settings.autoPrint,
      copies: settings.copies,
    });
    this.snackBar.open('Modifications annulées', 'Fermer', { duration: 2000 });
  }

  private vendorAutoPrintEnabled(): boolean {
    return !!this.dataService.restaurantInfo()?.vendor?.auto_print_enabled;
  }

  private notify(message: string, isError = false): void {
    this.snackBar.open(message, 'Fermer', {
      duration: isError ? 5000 : 3000,
      panelClass: [isError ? 'error-snackbar' : 'success-snackbar'],
    });
  }
}
