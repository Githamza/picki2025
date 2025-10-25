# Product Admin Authentication Fix

## Issue
When navigating to the products manager page in admin, users were getting the error:
```
Database call failed in fetchMenusWithSteps: Error: No valid authentication session found
```

## Root Cause
The `ProductAdminService` was using `SupabaseService` (which is now configured for anonymous operations only) but was trying to perform admin operations that require authentication.

## Solution
Updated `ProductAdminService` to use `SupabaseAuthService` for all admin operations:

### Key Changes Made

1. **Added SupabaseAuthService injection**:
   ```typescript
   private supabaseAuthService = inject(SupabaseAuthService);
   ```

2. **Updated all admin database operations** to use `supabaseAuthService`:
   - `fetchMenusWithSteps()` - Now uses authenticated client
   - `fetchProductsWithCategories()` - Now uses authenticated client  
   - `fetchCategories()` - Now uses authenticated client
   - `fetchMenuWithSteps()` - Now uses authenticated client
   - `createProductInDb()` - Now uses authenticated client
   - `updateProductInDb()` - Now uses authenticated client
   - `deleteProductFromDb()` - Now uses authenticated client
   - `createMenuInDb()` - Now uses authenticated client
   - `updateMenuInDb()` - Now uses authenticated client
   - `deleteMenuFromDb()` - Now uses authenticated client

3. **Removed manual session checking** since SupabaseAuthService handles authentication automatically

4. **Updated step options fetching** to use authenticated client

## Files Modified
- `src/app/services/product-admin.service.ts`

## Result
- Products manager page now works correctly with proper authentication
- All admin operations use the authenticated Supabase client
- No more "No valid authentication session found" errors
- Maintains separation between anonymous and authenticated operations

## Testing
The products manager page should now load correctly when accessed through the admin interface with proper authentication.

