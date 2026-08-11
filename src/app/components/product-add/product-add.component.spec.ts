import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { ProductAddComponent } from './product-add.component';
import { Product } from '../../services/product.service';
import { UpsellOffer } from '../../services/upsell.service';
import { addToCart } from '../../store/actions/cart.actions';

describe('ProductAddComponent', () => {
  let component: ProductAddComponent;
  let fixture: ComponentFixture<ProductAddComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ProductAddComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ProductAddComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});

function specProduct(id: number, name = `P${id}`): Product {
  return {
    id,
    name,
    price: 8.5,
    tvaRate: 10,
    imageUrl: '',
    categoryId: 1,
    description: '',
    shortDescription: '',
    longDescription: '',
    displayOrder: 0,
  };
}

describe('ProductAddComponent (post-add upsell routing)', () => {
  let component: ProductAddComponent;
  let storeSpy: { dispatch: jasmine.Spy };
  let navSpy: jasmine.SpyObj<{ navigateWithVendor(path: string[]): void }>;
  let upsellSpy: jasmine.SpyObj<{
    decidePostAddOffer(
      p: Product,
      pendingAdd?: {
        quantity: number;
        comment?: string;
        customisationSelections?: Map<number, number[]>;
      }
    ): unknown;
    completePostAdd(o: UpsellOffer | null, path: string[]): void;
  }>;

  const burger = specProduct(9101, 'Burger');

  function create(category: string | null = 'Burgers'): ProductAddComponent {
    storeSpy = { dispatch: jasmine.createSpy('dispatch') };
    navSpy = jasmine.createSpyObj('VendorNavigationService', ['navigateWithVendor']);
    upsellSpy = jasmine.createSpyObj('UpsellService', [
      'decidePostAddOffer',
      'completePostAdd',
    ]);
    upsellSpy.decidePostAddOffer.and.returnValue(of(null));

    const route = {
      snapshot: { paramMap: { get: () => category } },
      paramMap: of({ get: () => 'burger' }),
    };

    const instance = new ProductAddComponent(
      route as never,
      storeSpy as never,
      navSpy as never,
      {} as never,
      { hideCartBadge: () => {}, showCartBadge: () => {} } as never,
      upsellSpy as never,
      { celebrate: () => {} } as never
    );
    // Run navigation synchronously — the view-transition wrapper is
    // browser-timing dependent and not under test here.
    spyOn(instance as never as { transitionTo(fn: () => void): void }, 'transitionTo')
      .and.callFake((fn: () => void) => fn());
    return instance;
  }

  it('addToCart decides first, then dispatches when no convert offer fires', () => {
    component = create();
    component.addToCart({ product: burger });
    expect(upsellSpy.decidePostAddOffer).toHaveBeenCalledWith(burger, {
      quantity: 1,
      comment: undefined,
      customisationSelections: undefined,
    });
    expect(storeSpy.dispatch).toHaveBeenCalledWith(
      addToCart({
        product: burger,
        quantity: 1,
        comment: undefined,
        customisationSelections: undefined,
      })
    );
  });

  it('a convert offer defers the add — nothing reaches the cart yet', () => {
    component = create();
    const offer: UpsellOffer = {
      tier: 'convert',
      menu: specProduct(9103, 'Menu Burger'),
      deferredAdd: { product: burger, quantity: 1 },
    };
    upsellSpy.decidePostAddOffer.and.returnValue(of(offer));
    component.addToCart({ product: burger });
    expect(storeSpy.dispatch).not.toHaveBeenCalled();
    expect(upsellSpy.completePostAdd).toHaveBeenCalledWith(offer, [
      'promotional-banner',
      'Burgers',
      'products',
    ]);
  });

  it('a pool offer still adds immediately before the detour', () => {
    component = create();
    const offer: UpsellOffer = { tier: 'pool', products: [specProduct(9104)] };
    upsellSpy.decidePostAddOffer.and.returnValue(of(offer));
    component.addToCart({ product: burger });
    expect(storeSpy.dispatch).toHaveBeenCalledWith(
      addToCart({
        product: burger,
        quantity: 1,
        comment: undefined,
        customisationSelections: undefined,
      })
    );
  });

  it('hands the post-add outcome to UpsellService with the return path', () => {
    component = create('Burgers');
    const offer: UpsellOffer = { tier: 'pool', products: [specProduct(9104)] };
    upsellSpy.decidePostAddOffer.and.returnValue(of(offer));
    component.addToCart({ product: burger });
    expect(upsellSpy.completePostAdd).toHaveBeenCalledWith(offer, [
      'promotional-banner',
      'Burgers',
      'products',
    ]);
  });

  it('falls back to the plain grid path when no category is in the route', () => {
    component = create(null);
    component.addToCart({ product: burger });
    expect(upsellSpy.completePostAdd).toHaveBeenCalledWith(null, [
      'promotional-banner',
      'products',
    ]);
  });
});
