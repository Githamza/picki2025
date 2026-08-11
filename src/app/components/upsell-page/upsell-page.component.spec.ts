import { TestBed } from '@angular/core/testing';
import { MockStore, provideMockStore } from '@ngrx/store/testing';

import { UpsellPageComponent } from './upsell-page.component';
import { UpsellService } from '../../services/upsell.service';
import { VendorNavigationService } from '../../services/vendor-navigation.service';
import { Product, ProductService } from '../../services/product.service';
import { VendorService } from '../../services/vendor.service';
import { DiningPreferenceService } from '../../services/dining-preference.service';
import { CartCelebrationService } from '../../services/cart-celebration.service';
import { selectCartItems } from '../../store/selectors/cart.selectors';
import { addToCart } from '../../store/actions/cart.actions';

function product(id: number, name = `P${id}`): Product {
  return {
    id,
    name,
    price: 2.5,
    tvaRate: 10,
    imageUrl: '',
    categoryId: 1,
    description: '',
    shortDescription: '',
    longDescription: '',
    displayOrder: 0,
  };
}

describe('UpsellPageComponent', () => {
  let store: MockStore;
  let upsellService: UpsellService;
  let navSpy: jasmine.SpyObj<VendorNavigationService>;

  const burger = product(9101, 'Burger');
  const menu = { ...product(9103, 'Menu Burger'), price: 12, isMultiStep: true };

  function create(): UpsellPageComponent {
    navSpy = jasmine.createSpyObj('VendorNavigationService', ['navigateWithVendor']);

    TestBed.configureTestingModule({
      providers: [
        UpsellService,
        provideMockStore({
          selectors: [{ selector: selectCartItems, value: [{ product: burger, quantity: 1 }] }],
        }),
        { provide: VendorNavigationService, useValue: navSpy },
        { provide: ProductService, useValue: {} },
        {
          provide: VendorService,
          useValue: { getCurrentVendor: () => ({ id: 'v1' }) },
        },
        {
          provide: DiningPreferenceService,
          useValue: { diningPreference: () => 'eat-in' },
        },
        { provide: CartCelebrationService, useValue: { celebrate: () => {} } },
      ],
    });
    store = TestBed.inject(MockStore);
    upsellService = TestBed.inject(UpsellService);
    const component = TestBed.runInInjectionContext(() => new UpsellPageComponent());
    return component;
  }

  it('redirects to the grid when entered with no staged offer', () => {
    const component = create();
    component.ngOnInit();
    expect(navSpy.navigateWithVendor).toHaveBeenCalledWith([
      'promotional-banner',
      'products',
    ]);
  });

  it('dismiss clears the offer and returns to the staged path', () => {
    const component = create();
    upsellService.stageOffer(
      { tier: 'pool', products: [product(9104)] },
      ['promotional-banner', 'Burgers', 'products']
    );
    component.ngOnInit();
    component.dismiss();
    expect(upsellService.pendingOffer()).toBeNull();
    expect(navSpy.navigateWithVendor).toHaveBeenCalledWith([
      'promotional-banner',
      'Burgers',
      'products',
    ]);
  });

  it('accepting convert never touches the cart — no add, no remove', () => {
    const component = create();
    upsellService.stageOffer({
      tier: 'convert',
      menu,
      deferredAdd: { product: burger, quantity: 1 },
    });
    component.ngOnInit();
    const dispatchSpy = spyOn(store, 'dispatch');
    component.acceptConvert();
    expect(dispatchSpy).not.toHaveBeenCalled();
    expect(upsellService.pendingPreselect()).toEqual({ menuId: 9103, productId: 9101 });
    expect(upsellService.pendingOffer()).toBeNull();
    expect(navSpy.navigateWithVendor).toHaveBeenCalledWith(['product', 'Menu Burger']);
  });

  it('declining convert performs the deferred add with the original payload', () => {
    const component = create();
    upsellService.stageOffer(
      {
        tier: 'convert',
        menu,
        deferredAdd: { product: burger, quantity: 2, comment: 'sans oignons' },
      },
      ['promotional-banner', 'Burgers', 'products']
    );
    component.ngOnInit();
    const dispatchSpy = spyOn(store, 'dispatch');
    component.dismiss();
    expect(dispatchSpy).toHaveBeenCalledWith(
      addToCart({ product: burger, quantity: 2, comment: 'sans oignons' })
    );
    expect(upsellService.pendingOffer()).toBeNull();
    expect(navSpy.navigateWithVendor).toHaveBeenCalledWith([
      'promotional-banner',
      'Burgers',
      'products',
    ]);
  });

  it('adding a pool suggestion dispatches a normal cart line and flips the CTA', () => {
    const component = create();
    const coca = product(9104, 'Coca');
    upsellService.stageOffer({ tier: 'pool', products: [coca] });
    component.ngOnInit();
    const dispatchSpy = spyOn(store, 'dispatch');
    component.onPoolAdd(coca);
    expect(dispatchSpy).toHaveBeenCalledWith(addToCart({ product: coca, quantity: 1 }));

    store.overrideSelector(selectCartItems, [
      { product: burger, quantity: 1 },
      { product: coca, quantity: 1 },
    ] as never);
    store.refreshState();
    expect(component.hasAddedSuggestion()).toBeTrue();
  });
});
