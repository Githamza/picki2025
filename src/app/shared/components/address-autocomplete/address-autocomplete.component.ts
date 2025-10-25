import {
  Component,
  EventEmitter,
  Input,
  Output,
  inject,
  signal,
  OnChanges,
  SimpleChanges,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormControl } from '@angular/forms';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatIconModule } from '@angular/material/icon';
import { GooglePlacesAutocompleteService } from '../../../services/google-places-autocomplete.service';
import { Address } from '../../../services/delivery/delivery.types';

@Component({
  selector: 'app-address-autocomplete',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    ReactiveFormsModule,
    MatFormFieldModule,
    MatInputModule,
    MatAutocompleteModule,
    MatIconModule,
  ],
  template: `
    <mat-form-field class="w-full" appearance="outline">
      <mat-label>{{ label || 'Adresse de livraison' }}</mat-label>
      <input
        matInput
        type="text"
        [formControl]="query"
        [matAutocomplete]="auto"
        (input)="onInput()"
      />
      <button
        mat-icon-button
        matSuffix
        *ngIf="query.value"
        aria-label="Effacer"
        (click)="clear()"
      >
        <mat-icon>close</mat-icon>
      </button>
      <mat-autocomplete
        #auto="matAutocomplete"
        (optionSelected)="onSelected($event.option.value)"
      >
        <mat-option *ngFor="let p of predictions()" [value]="p.place_id">
          {{ p.description }}
        </mat-option>
      </mat-autocomplete>
    </mat-form-field>
  `,
})
export class AddressAutocompleteComponent implements OnChanges {
  private places = inject(GooglePlacesAutocompleteService);

  @Input() label?: string;
  @Input() address?: Address | null;
  @Output() placeSelected = new EventEmitter<string>();

  query = new FormControl('');
  private _predictions = signal<google.maps.places.AutocompletePrediction[]>(
    []
  );
  predictions = this._predictions.asReadonly();

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['address'] && this.address) {
      // Format the address for display
      const displayAddress = this.formatAddressForDisplay(this.address);
      this.query.setValue(displayAddress, { emitEvent: false });
    } else if (changes['address'] && !this.address) {
      // Clear the input if no address
      this.query.setValue('', { emitEvent: false });
    }
  }

  private formatAddressForDisplay(address: Address): string {
    const parts = [address.line1];
    if (address.line2) {
      parts.push(address.line2);
    }
    parts.push(`${address.postalCode} ${address.city}`);
    return parts.join(', ');
  }

  async onInput(): Promise<void> {
    const value = this.query.value?.toString().trim() || '';
    if (!value) {
      this._predictions.set([]);
      return;
    }
    const preds = await this.places.getPredictions(value);
    this._predictions.set(preds);
  }

  clear(): void {
    this.query.setValue('');
    this._predictions.set([]);
  }

  onSelected(placeId: string): void {
    // Replace the input value with the readable description instead of the place_id
    const selected = this._predictions().find((p) => p.place_id === placeId);
    if (selected?.description) {
      // Do not trigger a new predictions fetch when updating the field
      this.query.setValue(selected.description, { emitEvent: false });
      this._predictions.set([]);
    }
    this.placeSelected.emit(placeId);
  }
}
