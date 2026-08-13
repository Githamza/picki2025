import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAT_DIALOG_DATA, MatDialogRef } from '@angular/material/dialog';
import { Subject } from 'rxjs';

import { TerminalPaymentDialogComponent } from './terminal-payment-dialog.component';
import {
  QontoTerminalService,
  TerminalPaymentState,
} from '../../../services/qonto-terminal.service';

describe('TerminalPaymentDialogComponent', () => {
  let fixture: ComponentFixture<TerminalPaymentDialogComponent>;
  let states$: Subject<TerminalPaymentState>;
  let terminalSpy: jasmine.SpyObj<QontoTerminalService>;
  let dialogRefSpy: jasmine.SpyObj<MatDialogRef<TerminalPaymentDialogComponent>>;

  beforeEach(() => {
    states$ = new Subject<TerminalPaymentState>();
    terminalSpy = jasmine.createSpyObj<QontoTerminalService>(
      'QontoTerminalService',
      ['startPayment', 'cancelOrder']
    );
    terminalSpy.startPayment.and.returnValue(states$.asObservable());
    terminalSpy.cancelOrder.and.resolveTo();
    dialogRefSpy = jasmine.createSpyObj('MatDialogRef', ['close']);

    TestBed.configureTestingModule({
      imports: [TerminalPaymentDialogComponent],
      providers: [
        { provide: QontoTerminalService, useValue: terminalSpy },
        { provide: MatDialogRef, useValue: dialogRefSpy },
        {
          provide: MAT_DIALOG_DATA,
          useValue: { orderId: 'order-1', amount: '12.50' },
        },
      ],
    });
    fixture = TestBed.createComponent(TerminalPaymentDialogComponent);
    fixture.detectChanges();
  });

  function text(): string {
    return (fixture.nativeElement as HTMLElement).textContent ?? '';
  }

  it('starts the payment on open and shows the waiting state with the amount', () => {
    expect(terminalSpy.startPayment).toHaveBeenCalledOnceWith('order-1');
    states$.next({ phase: 'waiting-card', paymentId: 'p1' });
    fixture.detectChanges();

    expect(text()).toContain('12,50 €');
    expect(text()).toContain('Présentez votre carte');
  });

  it('closes with authorized when the payment settles', () => {
    states$.next({ phase: 'authorized', paymentId: 'p1' });
    fixture.detectChanges();

    expect(dialogRefSpy.close).toHaveBeenCalledWith({ outcome: 'authorized' });
  });

  it('shows the refusal state with retry and cancel actions', () => {
    states$.next({ phase: 'refused', paymentId: 'p1', failureReason: 'card_declined' });
    fixture.detectChanges();

    expect(text()).toContain('Paiement refusé');
    expect(text()).toContain('Réessayer');
    expect(text()).toContain('Annuler');
    expect(dialogRefSpy.close).not.toHaveBeenCalled();
  });

  it('shows the timeout state through the same error surface', () => {
    states$.next({ phase: 'timeout', paymentId: 'p1' });
    fixture.detectChanges();

    expect(text()).toContain('Réessayer');
  });

  it('Réessayer restarts the payment on the same order', () => {
    states$.next({ phase: 'refused', paymentId: 'p1', failureReason: null });
    fixture.detectChanges();

    const retry = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button')
    ).find((b) => b.textContent?.includes('Réessayer'))!;
    retry.click();
    fixture.detectChanges();

    expect(terminalSpy.startPayment).toHaveBeenCalledTimes(2);
    expect(terminalSpy.startPayment.calls.mostRecent().args[0]).toBe('order-1');
  });

  it('Annuler cancels the order then closes with cancelled', async () => {
    states$.next({ phase: 'refused', paymentId: 'p1', failureReason: null });
    fixture.detectChanges();

    const cancel = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button')
    ).find((b) => b.textContent?.includes('Annuler'))!;
    cancel.click();
    await fixture.whenStable();

    expect(terminalSpy.cancelOrder).toHaveBeenCalledOnceWith('order-1');
    expect(dialogRefSpy.close).toHaveBeenCalledWith({ outcome: 'cancelled' });
  });
});
