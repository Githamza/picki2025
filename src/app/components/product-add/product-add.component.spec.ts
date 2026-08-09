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
    decidePostAddOffer(p: Product): unknown;
    stageOffer(o: UpsellOffer, path?: string[]): void;
  }>;

  const burger = specProduct(9101, 'Burger');

  function create(category: string | null = 'Burgers'): ProductAddComponent {
    storeSpy = { dispatch: jasmine.createSpy('dispatch') };
    navSpy = jasmine.createSpyObj('VendorNavigationService', ['navigateWithVendor']);
    upsellSpy = jasmine.createSpyObj('UpsellService', [
      'decidePostAddOffer',
      'stageOffer',
    ]);
    upsellSpy.decidePostAddOffer.and.returnValue(of(null));

    const route = {
      snapshot: { paramMap: { get: () => category } },
      paramMap: of({ get: () => 'burger' }),
    };

    return new ProductAddComponent(
      route as never,
      storeSpy as never,
      {} as never,
      {} as never,
      {} as never,
      navSpy as never,
      {} as never,
      { hideCartBadge: () => {}, showCartBadge: () => {} } as never,
      upsellSpy as never
    );
  }

  it('with no offer, returns straight to the category grid', () => {
    component = create('Burgers');
    component.completePostAdd(null);
    expect(navSpy.navigateWithVendor).toHaveBeenCalledWith([
      'promotional-banner',
      'Burgers',
      'products',
    ]);
    expect(upsellSpy.stageOffer).not.toHaveBeenCalled();
  });

  it('with an offer, stages it with the return path and routes to /upsell', () => {
    component = create('Burgers');
    const offer: UpsellOffer = { tier: 'pool', products: [specProduct(9104)] };
    component.completePostAdd(offer);
    expect(upsellSpy.stageOffer).toHaveBeenCalledWith(offer, [
      'promotional-banner',
      'Burgers',
      'products',
    ]);
    expect(navSpy.navigateWithVendor).toHaveBeenCalledWith(['upsell']);
  });

  it('addToCart dispatches the cart line and consults the upsell decision', () => {
    component = create();
    component.addToCart({ product: burger });
    expect(storeSpy.dispatch).toHaveBeenCalledWith(
      addToCart({
        product: burger,
        quantity: 1,
        comment: undefined,
        customisationSelections: undefined,
      })
    );
    expect(upsellSpy.decidePostAddOffer).toHaveBeenCalledWith(burger);
  });
});
