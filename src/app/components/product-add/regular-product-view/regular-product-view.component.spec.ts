import { TestBed } from '@angular/core/testing';
import { MatDialog } from '@angular/material/dialog';
import { MockStore, provideMockStore } from '@ngrx/store/testing';
import { of, throwError } from 'rxjs';

import { RegularProductViewComponent } from './regular-product-view.component';
import { Product, ProductService } from '../../../services/product.service';
import { VendorService } from '../../../services/vendor.service';
import { DiningPreferenceService } from '../../../services/dining-preference.service';
import { selectCartItems } from '../../../store/selectors/cart.selectors';
import { addToCart } from '../../../store/actions/cart.actions';

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

describe('RegularProductViewComponent (upsell strip)', () => {
  let store: MockStore;
  let mockProductService: jasmine.SpyObj<ProductService>;
  const burger = product(9101, 'Burger');

  function create(pool: Product[] | 'error'): RegularProductViewComponent {
    mockProductService = jasmine.createSpyObj('ProductService', [
      'getUpsellPool',
      'getProductWithCustomisations',
    ]);
    mockProductService.getUpsellPool.and.returnValue(
      pool === 'error' ? throwError(() => new Error('offline')) : of(pool)
    );
    mockProductService.getProductWithCustomisations.and.returnValue(of(null));

    TestBed.configureTestingModule({
      providers: [
        provideMockStore({
          selectors: [{ selector: selectCartItems, value: [] }],
        }),
        { provide: MatDialog, useValue: {} },
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
    const component = TestBed.runInInjectionContext(
      () => new RegularProductViewComponent()
    );
    component.product = burger;
    component.ngOnInit();
    return component;
  }

  it('loads the pool on init, excludes the current product, caps at 4', () => {
    const poolWithSelf = [
      burger,
      product(9104),
      product(9107),
      product(9108),
      product(9109),
      product(9110),
    ];
    const component = create(poolWithSelf);
    const suggestions = component.upsellSuggestions();
    expect(suggestions.length).toBe(4);
    expect(suggestions.some((p) => p.id === burger.id)).toBeFalse();
  });

  it('renders nothing when the pool is empty or errored', () => {
    const component = create('error');
    expect(component.upsellSuggestions()).toEqual([]);
  });

  it('adding a suggestion dispatches a normal addToCart line', () => {
    const component = create([product(9104, 'Coca')]);
    const dispatchSpy = spyOn(store, 'dispatch');
    const coca = product(9104, 'Coca');
    component.onUpsellAdd(coca);
    expect(dispatchSpy).toHaveBeenCalledWith(
      addToCart({ product: coca, quantity: 1 })
    );
  });
});
