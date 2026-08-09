import { TestBed } from '@angular/core/testing';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { of } from 'rxjs';

import { UpsellService, POOL_OFFER_MAX_ITEMS } from './upsell.service';
import { ProductService, Product } from './product.service';
import { VendorService } from './vendor.service';
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
  const burger = product(9101, 'Burger Classique');
  const pool = [product(9104, 'Coca'), product(9107, 'Eau'), product(9108, 'Tiramisu')];

  function setup(cartItems: CartItem[] = [cartItem(burger)]): UpsellService {
    mockProductService = jasmine.createSpyObj('ProductService', ['getUpsellPool']);
    mockProductService.getUpsellPool.and.returnValue(of(pool));

    TestBed.configureTestingModule({
      providers: [
        UpsellService,
        provideMockStore({
          selectors: [{ selector: selectCartItems, value: cartItems }],
        }),
        { provide: ProductService, useValue: mockProductService },
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

  it('clears any staged offer when the cart empties', () => {
    const service = setup();
    service.stageOffer({ tier: 'pool', products: pool });
    expect(service.pendingOffer()).not.toBeNull();
    store.overrideSelector(selectCartItems, []);
    store.refreshState();
    expect(service.pendingOffer()).toBeNull();
  });
});
