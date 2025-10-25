# Restaurant Logo Feature

This feature adds restaurant logo support to the main toolbar, displaying the restaurant's logo and name on the left side of the navigation bar.

## What's New

### Database Changes

- Added `logo_url` field to the `vendors` table
- Migration files created to add the column and insert test data

### Frontend Changes

- Updated main layout to display restaurant logo and name
- Added fallback icon when no logo is available
- Responsive design for mobile and desktop
- Automatic vendor selection for single-restaurant setups

### API Changes

- Added `updateVendorLogo` method to SupabaseService
- Added corresponding method to VendorService
- Updated TypeScript types to include logo_url field

## How to Test

1. **Apply Database Migrations**

   ```bash
   # Apply the logo column migration
   supabase db push

   # Or if using local development
   supabase migration up
   ```

2. **Test with Demo Data**

   - The migration includes a test logo URL for demonstration
   - The logo will automatically appear in the main toolbar
   - Test both with and without logo URL to see the fallback icon

3. **Update Logo Programmatically**

   ```typescript
   // In your component or service
   const vendorService = inject(VendorService);

   // Update vendor logo
   await vendorService.updateVendorLogo(vendorId, "https://example.com/logo.png");
   ```

## Features

### Main Toolbar Logo

- Displays restaurant logo (40x40px) with rounded corners
- Falls back to restaurant icon if no logo is available
- Shows restaurant name next to the logo
- Hover effects for better user experience

### Responsive Design

- Desktop: Full logo with name
- Mobile: Smaller logo with truncated name
- Proper spacing and alignment

### Accessibility

- Alt text for logo images
- Proper ARIA labels
- Keyboard navigation support

## Technical Details

### Database Schema

```sql
-- vendors table now includes:
logo_url TEXT -- URL to the restaurant logo image
```

### CSS Classes

- `.brand-section` - Container for logo and name
- `.restaurant-logo` - Logo image styling
- `.restaurant-logo-fallback` - Fallback icon styling
- `.restaurant-name` - Restaurant name styling

### Service Methods

- `VendorService.updateVendorLogo(vendorId, logoUrl)` - Update logo URL
- `VendorService.currentVendor$` - Observable for current vendor (includes logo)

## Future Enhancements

1. **Logo Upload Interface**

   - Admin interface for uploading logos
   - Image resize and optimization
   - Multiple logo formats support

2. **Advanced Logo Features**

   - Dark/light mode logo variants
   - SVG logo support
   - Logo aspect ratio preservation

3. **Branding Consistency**
   - Logo validation and guidelines
   - Brand color extraction from logo
   - Consistent sizing across the application

## Migration Files

1. `20241230000002_add_vendor_logo_url.sql` - Adds logo_url column
2. `20241230000003_insert_test_logo.sql` - Inserts test logo data

## Testing Checklist

- [ ] Logo appears in main toolbar
- [ ] Fallback icon shows when no logo URL
- [ ] Restaurant name displays correctly
- [ ] Responsive design works on mobile
- [ ] Hover effects work properly
- [ ] Logo updates reflect immediately
- [ ] Accessibility features work
- [ ] Multiple vendors supported
