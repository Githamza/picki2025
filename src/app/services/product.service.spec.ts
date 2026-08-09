import { TestBed } from '@angular/core/testing';
import { ProductService } from './product.service';
import { SupabaseService } from './supabase.service';
import { CategoryService } from './category.service';
import { CustomisationService } from './customisation.service';
import { Customisation } from '../models/customisation.interface';
import { UPSELLABLE_CATEGORY_TYPES } from '../models/category-type.model';
import { of } from 'rxjs';

// The Supabase query builders give these service methods exact row types;
// the lightweight mocks below intentionally carry only the fields the
// ProductService mapping reads, hence the ReturnType casts at the spy sites.

describe('ProductService', () => {
  let service: ProductService;
  let mockSupabaseService: jasmine.SpyObj<SupabaseService>;
  let mockCategoryService: jasmine.SpyObj<CategoryService>;
  let mockCustomisationService: jasmine.SpyObj<CustomisationService>;

  beforeEach(() => {
    const supabaseSpy = jasmine.createSpyObj('SupabaseService', [
      'getProducts',
      'getAllProducts',
      'getProductById',
      'getUpsellProducts'
    ]);
    
    const categorySpy = jasmine.createSpyObj('CategoryService', [
      'getCategories',
      'getCategoriesByVendor'
    ]);
    
    const customisationSpy = jasmine.createSpyObj('CustomisationService', [
      'getProductCustomisations'
    ]);

    TestBed.configureTestingModule({
      providers: [
        ProductService,
        { provide: SupabaseService, useValue: supabaseSpy },
        { provide: CategoryService, useValue: categorySpy },
        { provide: CustomisationService, useValue: customisationSpy }
      ]
    });
    
    service = TestBed.inject(ProductService);
    mockSupabaseService = TestBed.inject(SupabaseService) as jasmine.SpyObj<SupabaseService>;
    mockCategoryService = TestBed.inject(CategoryService) as jasmine.SpyObj<CategoryService>;
    mockCustomisationService = TestBed.inject(CustomisationService) as jasmine.SpyObj<CustomisationService>;
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getProducts', () => {
    it('should load products without customisations for product grid', (done) => {
      // Mock product data
      const mockProducts = [
        { 
          id: 1, 
          name: 'Product 1', 
          price: 10, 
          category_id: 1, 
          vendor_id: 'vendor1',
          has_customisations: true,
          display_order: 1
        },
        { 
          id: 2, 
          name: 'Product 2', 
          price: 20, 
          category_id: 1, 
          vendor_id: 'vendor1',
          has_customisations: false,
          display_order: 2
        }
      ];

      // Mock category data
      const mockCategories = [
        { id: 1, name: 'Category 1', displayOrder: 1 }
      ];

      // Setup spies
      mockSupabaseService.getProducts.and.returnValue(
        Promise.resolve(mockProducts) as unknown as ReturnType<SupabaseService['getProducts']>
      );
      mockCategoryService.getCategories.and.returnValue(of(mockCategories));
      mockCustomisationService.getProductCustomisations.and.returnValue(of([]));

      // Call the method
      service.getProducts().subscribe({
        next: (products) => {
          // Verify products are returned
          expect(products.length).toBe(2);
          expect(products[0].name).toBe('Product 1');
          expect(products[1].name).toBe('Product 2');
          
          // Verify customisations were NOT loaded (this is the key test)
          expect(mockCustomisationService.getProductCustomisations).not.toHaveBeenCalled();
          
          done();
        },
        error: done.fail
      });
    });
  });

  describe('getProductWithCustomisations', () => {
    it('should load product with customisations when needed', (done) => {
      // Mock product data
      const mockProduct = { 
        id: 1, 
        name: 'Product 1', 
        price: 10, 
        category_id: 1, 
        vendor_id: 'vendor1',
        has_customisations: true,
        display_order: 1
      };

      // Mock customisations
      const mockCustomisations = [
        {
          id: 1,
          name: 'Size',
          options: [
            { id: 1, name: 'Small', price_adjustment: 0 },
            { id: 2, name: 'Large', price_adjustment: 2 }
          ]
        }
      ] as unknown as Customisation[];

      // Setup spies
      mockSupabaseService.getProductById.and.returnValue(
        Promise.resolve(mockProduct) as unknown as ReturnType<SupabaseService['getProductById']>
      );
      mockCustomisationService.getProductCustomisations.and.returnValue(of(mockCustomisations));

      // Call the method
      service.getProductWithCustomisations(1).subscribe({
        next: (product) => {
          // Verify product is returned with customisations
          expect(product).toBeTruthy();
          expect(product!.id).toBe(1);
          expect(product!.name).toBe('Product 1');
          expect(product!.customisations).toEqual(mockCustomisations);
          
          // Verify customisations WERE loaded for individual product
          expect(mockCustomisationService.getProductCustomisations).toHaveBeenCalledWith(1);
          
          done();
        },
        error: done.fail
      });
    });
  });

  describe('getUpsellPool', () => {
    const poolRows = [
      {
        id: 9104,
        name: 'Coca-Cola',
        price: 2.5,
        category_id: 9002,
        vendor_id: 'vendor1',
        is_multi_step: false,
        display_order: 2
      }
    ];

    it('queries the upsellable category types and maps rows to Product', (done) => {
      mockSupabaseService.getUpsellProducts.and.returnValue(
        Promise.resolve(poolRows) as unknown as ReturnType<SupabaseService['getUpsellProducts']>
      );

      service.getUpsellPool('vendor1', 'eat-in').subscribe({
        next: (products) => {
          expect(mockSupabaseService.getUpsellProducts).toHaveBeenCalledWith(
            'vendor1',
            'eat-in',
            UPSELLABLE_CATEGORY_TYPES
          );
          expect(products.length).toBe(1);
          expect(products[0].name).toBe('Coca-Cola');
          expect(products[0].price).toBe(2.5);
          done();
        },
        error: done.fail
      });
    });

    it('caches per vendor and order type', (done) => {
      mockSupabaseService.getUpsellProducts.and.returnValue(
        Promise.resolve(poolRows) as unknown as ReturnType<SupabaseService['getUpsellProducts']>
      );

      service.getUpsellPool('vendor1', 'eat-in').subscribe(() => {
        service.getUpsellPool('vendor1', 'eat-in').subscribe((cached) => {
          expect(mockSupabaseService.getUpsellProducts).toHaveBeenCalledTimes(1);
          expect(cached.length).toBe(1);

          // A different order type is a different cache entry.
          service.getUpsellPool('vendor1', 'take-away').subscribe(() => {
            expect(mockSupabaseService.getUpsellProducts).toHaveBeenCalledTimes(2);
            done();
          });
        });
      });
    });

    it('the v1 upsellable set is boisson + dessert', () => {
      expect(UPSELLABLE_CATEGORY_TYPES).toEqual(['boisson', 'dessert']);
    });
  });

  describe('getAllProducts', () => {
    it('should load all products without customisations for product grid', (done) => {
      // Mock product data
      const mockProducts = [
        { 
          id: 1, 
          name: 'Product 1', 
          price: 10, 
          category_id: 1, 
          vendor_id: 'vendor1',
          has_customisations: true,
          display_order: 1
        }
      ];

      // Mock category data
      const mockCategories = [
        { id: 1, name: 'Category 1', displayOrder: 1 }
      ];

      // Setup spies
      mockSupabaseService.getAllProducts.and.returnValue(
        Promise.resolve(mockProducts) as unknown as ReturnType<SupabaseService['getAllProducts']>
      );
      mockCategoryService.getCategories.and.returnValue(of(mockCategories));
      mockCustomisationService.getProductCustomisations.and.returnValue(of([]));

      // Call the method
      service.getAllProducts().subscribe({
        next: (products) => {
          // Verify products are returned
          expect(products.length).toBe(1);
          expect(products[0].name).toBe('Product 1');
          
          // Verify customisations were NOT loaded (this is the key test)
          expect(mockCustomisationService.getProductCustomisations).not.toHaveBeenCalled();
          
          done();
        },
        error: done.fail
      });
    });
  });
});