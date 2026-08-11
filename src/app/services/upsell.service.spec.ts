import { TestBed } from '@angular/core/testing';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { of } from 'rxjs';

import {
  UpsellService,
  UpsellOffer,
  POOL_OFFER_MAX_ITEMS,
  findUnambiguousPreselection,
  productGridPath,
} from './upsell.service';
import { ProductStep } from '../models/multi-step-product.model';
import { ProductService, Product } from './product.service';
import { VendorService } from './vendor.service';
import { VendorNavigationService } from './vendor-navigation.service';
import { DiningPreferenceService } from './dining-preference.service';
import { selectCartItems } from '../store/selectors/cart.selectors';
import { CartItem } from '../store/models/app.state';

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

function cartItem(p: Product, metadata?: unknown): CartItem {
  return { product: p, quantity: 1, metadata } as CartItem;
}

describe('UpsellService', () => {
  let store: MockStore;
  let mockProductService: jasmine.SpyObj<ProductService>;
  let navSpy: jasmine.SpyObj<VendorNavigationService>;
  const burger = product(9101, 'Burger Classique');
  const pool = [product(9104, 'Coca'), product(9107, 'Eau'), product(9108, 'Tiramisu')];

  function setup(cartItems: CartItem[] = [cartItem(burger)]): UpsellService {
    mockProductService = jasmine.createSpyObj('ProductService', [
      'getUpsellPool',
      'getMenusContaining',
    ]);
    mockProductService.getUpsellPool.and.returnValue(of(pool));
    mockProductService.getMenusContaining.and.returnValue(of([]));
    navSpy = jasmine.createSpyObj('VendorNavigationService', [
      'navigateWithVendor',
    ]);

    TestBed.configureTestingModule({
      providers: [
        UpsellService,
        provideMockStore({
          selectors: [{ selector: selectCartItems, value: cartItems }],
        }),
        { provide: ProductService, useValue: mockProductService },
        { provide: VendorNavigationService, useValue: navSpy },
        {
          provide: VendorService,
          useValue: { getCurrentVendor: () => ({ id: 'v1' }) },
        },
        {
          provide: DiningPreferenceService,
          useValue: { diningPreference: () => 'eat-in' },
        },
      ],
    });
    store = TestBed.inject(MockStore);
    return TestBed.inject(UpsellService);
  }

  it('offers the pool tier when the cart has no pool item', (done) => {
    const service = setup();
    service.decidePostAddOffer(burger).subscribe((offer) => {
      expect(offer?.tier).toBe('pool');
      if (offer?.tier === 'pool') {
        expect(offer.products.length).toBe(3);
      }
      done();
    });
  });

  it('caps the pool offer at POOL_OFFER_MAX_ITEMS', (done) => {
    const service = setup();
    const bigPool = [1, 2, 3, 4, 5, 6].map((i) => product(9200 + i));
    mockProductService.getUpsellPool.and.returnValue(of(bigPool));
    service.decidePostAddOffer(burger).subscribe((offer) => {
      if (offer?.tier === 'pool') {
        expect(offer.products.length).toBe(POOL_OFFER_MAX_ITEMS);
        done();
      } else {
        done.fail('expected a pool offer');
      }
    });
  });

  it('stays silent when the cart already holds a pool item directly', (done) => {
    const service = setup([cartItem(burger), cartItem(product(9104, 'Coca'))]);
    service.decidePostAddOffer(burger).subscribe((offer) => {
      expect(offer).toBeNull();
      done();
    });
  });

  it('stays silent when the added product is itself a pool item (decide runs pre-add)', (done) => {
    // The decision now happens BEFORE the cart dispatch, so the just-added
    // drink is not in the cart yet — it must still suppress the pool tier.
    const service = setup([cartItem(burger)]);
    service.decidePostAddOffer(product(9104, 'Coca')).subscribe((offer) => {
      expect(offer).toBeNull();
      done();
    });
  });

  it('counts pool items nested inside a menu (no nagging combo buyers)', (done) => {
    const menuWithDrink = cartItem(product(9103, 'Menu Burger'), {
      stepSelections: [
        { selectedOptions: [{ productId: 9104, name: 'Coca' }] },
      ],
    });
    const service = setup([menuWithDrink]);
    service.decidePostAddOffer(burger).subscribe((offer) => {
      expect(offer).toBeNull();
      done();
    });
  });

  it('offers the pool tier at most once per session', (done) => {
    const service = setup();
    service.decidePostAddOffer(burger).subscribe((first) => {
      expect(first?.tier).toBe('pool');
      service.decidePostAddOffer(burger).subscribe((second) => {
        expect(second).toBeNull();
        done();
      });
    });
  });

  it('resets the session when the cart empties', (done) => {
    const service = setup();
    service.decidePostAddOffer(burger).subscribe(() => {
      store.overrideSelector(selectCartItems, []);
      store.refreshState();
      store.overrideSelector(selectCartItems, [cartItem(burger)]);
      store.refreshState();
      service.decidePostAddOffer(burger).subscribe((offer) => {
        expect(offer?.tier).toBe('pool');
        done();
      });
    });
  });

  it('stays silent when the pool is empty', (done) => {
    const service = setup();
    mockProductService.getUpsellPool.and.returnValue(of([]));
    service.decidePostAddOffer(burger).subscribe((offer) => {
      expect(offer).toBeNull();
      done();
    });
  });

  describe('convert-to-menu tier', () => {
    const menu = { ...product(9103, 'Menu Burger'), price: 12, isMultiStep: true };

    it('offers converting to the containing menu before pool suggestions', (done) => {
      const service = setup();
      mockProductService.getMenusContaining.and.returnValue(of([menu]));
      service.decidePostAddOffer(burger).subscribe((offer) => {
        expect(offer?.tier).toBe('convert');
        if (offer?.tier === 'convert') {
          expect(offer.menu.id).toBe(9103);
          expect(offer.deferredAdd.product.id).toBe(9101);
          expect(offer.deferredAdd.quantity).toBe(1);
        }
        done();
      });
    });

    it('carries the pending add payload so nothing is added before the choice', (done) => {
      const service = setup();
      mockProductService.getMenusContaining.and.returnValue(of([menu]));
      service
        .decidePostAddOffer(burger, { quantity: 2, comment: 'sans oignons' })
        .subscribe((offer) => {
          if (offer?.tier === 'convert') {
            expect(offer.deferredAdd).toEqual({
              product: burger,
              quantity: 2,
              comment: 'sans oignons',
              customisationSelections: undefined,
            });
            done();
          } else {
            done.fail('expected a convert offer');
          }
        });
    });

    it('picks the cheapest menu when several contain the product', (done) => {
      const service = setup();
      const dearMenu = { ...product(9110, 'Menu Maxi'), price: 15, isMultiStep: true };
      mockProductService.getMenusContaining.and.returnValue(of([dearMenu, menu]));
      service.decidePostAddOffer(burger).subscribe((offer) => {
        if (offer?.tier === 'convert') {
          expect(offer.menu.id).toBe(9103);
          done();
        } else {
          done.fail('expected a convert offer');
        }
      });
    });

    it('never offers convert for a multi-step (menu) product add', (done) => {
      const service = setup();
      mockProductService.getMenusContaining.and.returnValue(of([menu]));
      const addedMenu = { ...product(9106, 'Menu Kiosk'), isMultiStep: true };
      service.decidePostAddOffer(addedMenu).subscribe((offer) => {
        expect(offer?.tier).toBe('pool');
        expect(mockProductService.getMenusContaining).not.toHaveBeenCalled();
        done();
      });
    });

    it('offers convert at most once per session, then falls back to pool', (done) => {
      const service = setup();
      mockProductService.getMenusContaining.and.returnValue(of([menu]));
      service.decidePostAddOffer(burger).subscribe((first) => {
        expect(first?.tier).toBe('convert');
        service.decidePostAddOffer(burger).subscribe((second) => {
          expect(second?.tier).toBe('pool');
          done();
        });
      });
    });
  });

  describe('findUnambiguousPreselection', () => {
    function step(
      id: number,
      stepType: 'single-select' | 'multi-select',
      optionEntries: Array<{ id: number; productId: number | null }>
    ): ProductStep {
      return {
        id,
        stepType,
        options: optionEntries.map((o) => ({
          id: o.id,
          productId: o.productId,
        })),
      } as ProductStep;
    }

    it('finds the option when exactly one single-select option matches', () => {
      const steps = [
        step(1, 'single-select', [
          { id: 11, productId: 9101 },
          { id: 12, productId: null },
        ]),
        step(2, 'multi-select', [{ id: 21, productId: null }]),
      ];
      expect(findUnambiguousPreselection(steps, 9101)).toEqual({
        stepId: 1,
        optionId: 11,
      });
    });

    it('returns null when several options match (ambiguous)', () => {
      const steps = [
        step(1, 'single-select', [{ id: 11, productId: 9101 }]),
        step(2, 'single-select', [{ id: 21, productId: 9101 }]),
      ];
      expect(findUnambiguousPreselection(steps, 9101)).toBeNull();
    });

    it('returns null when the only match sits in a multi-select step', () => {
      const steps = [step(1, 'multi-select', [{ id: 11, productId: 9101 }])];
      expect(findUnambiguousPreselection(steps, 9101)).toBeNull();
    });

    it('returns null when nothing matches', () => {
      const steps = [step(1, 'single-select', [{ id: 11, productId: null }])];
      expect(findUnambiguousPreselection(steps, 9101)).toBeNull();
    });
  });

  it('clears any staged offer when the cart empties', () => {
    const service = setup();
    service.stageOffer({ tier: 'pool', products: pool });
    expect(service.pendingOffer()).not.toBeNull();
    store.overrideSelector(selectCartItems, []);
    store.refreshState();
    expect(service.pendingOffer()).toBeNull();
  });

  describe('completePostAdd (shared post-add routing)', () => {
    const returnPath = ['promotional-banner', 'Burgers', 'products'];

    it('with no offer, returns straight to the grid', () => {
      const service = setup();
      service.completePostAdd(null, returnPath);
      expect(navSpy.navigateWithVendor).toHaveBeenCalledWith(returnPath);
      expect(service.pendingOffer()).toBeNull();
    });

    it('with an offer, stages it with the return path and routes to /upsell', () => {
      const service = setup();
      const offer: UpsellOffer = { tier: 'pool', products: pool };
      service.completePostAdd(offer, returnPath);
      expect(service.pendingOffer()).toEqual(offer);
      expect(navSpy.navigateWithVendor).toHaveBeenCalledWith(['upsell']);
    });
  });

  describe('productGridPath', () => {
    it('includes the category when present', () => {
      expect(productGridPath('Burgers')).toEqual([
        'promotional-banner',
        'Burgers',
        'products',
      ]);
    });

    it('falls back to the plain grid without a category', () => {
      expect(productGridPath(null)).toEqual([
        'promotional-banner',
        'products',
      ]);
    });
  });
});
