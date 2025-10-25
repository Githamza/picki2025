# Image Upload Component

A reusable Angular component for uploading images to Supabase storage with preview and zoom functionality.

## Features

- ✅ **File Upload**: Drag & drop or click to upload images to Supabase storage
- ✅ **Image Preview**: Shows uploaded image thumbnail with hover effects
- ✅ **Zoom Functionality**: Click on preview to open full-screen zoom dialog
- ✅ **Reactive Forms Integration**: Implements `ControlValueAccessor` for seamless form integration
- ✅ **File Validation**: Validates file type (images only) and size (max 5MB)
- ✅ **Progress Indicator**: Shows upload progress with animated progress bar
- ✅ **Error Handling**: User-friendly error messages with Material snackbar
- ✅ **Manual URL Input**: Users can also manually enter image URLs
- ✅ **Image Management**: Delete/replace existing images
- ✅ **Responsive Design**: Works on mobile and desktop

## Usage

### Basic Usage

```html
<app-image-upload formControlName="image_url" label="Product Image" placeholder="https://..."></app-image-upload>
```

### With Custom Configuration

```html
<app-image-upload formControlName="image_url" label="Category Image" placeholder="Enter image URL..." bucket="categories"></app-image-upload>
```

### Component Inputs

| Input         | Type     | Default             | Description                    |
| ------------- | -------- | ------------------- | ------------------------------ |
| `label`       | `string` | `'URL de l'image'`  | Label for the input field      |
| `placeholder` | `string` | `'https://...'`     | Placeholder text for the input |
| `bucket`      | `string` | `'productsophotos'` | Supabase storage bucket name   |

## Integration Examples

### Menu Edit Component

```typescript
// Component imports
import { ImageUploadComponent } from '../../../shared/components';

// Add to component imports
imports: [
  // ... other imports
  ImageUploadComponent,
]

// Template usage
<app-image-upload
  formControlName="image_url"
  label="URL de l'image"
  placeholder="https://..."
></app-image-upload>
```

### Product Edit Dialog

```typescript
// Same import and usage pattern as above
```

### Category Edit Dialog

```typescript
// Same import and usage pattern as above
```

## Technical Details

### File Upload Process

1. **File Selection**: User selects image file or drags & drops
2. **Validation**: Checks file type (must be image) and size (max 5MB)
3. **Progress Simulation**: Shows animated progress bar for better UX
4. **Old Image Cleanup**: Automatically deletes previous image if replacing
5. **Supabase Upload**: Uploads file to specified bucket
6. **URL Generation**: Gets public URL from Supabase
7. **Form Update**: Updates form control value with new URL

### Storage Structure

Images are stored in Supabase storage with the following naming convention:

```
{timestamp}-{random-string}.{file-extension}
```

Example: `1703123456789-abc123def456.jpg`

### Error Handling

The component handles various error scenarios:

- Invalid file types (shows error message)
- File size too large (shows error message)
- Upload failures (shows error message)
- Network issues (shows error message)

### Dependencies

- Supabase Storage API
- Angular Material Components:
  - `MatFormFieldModule`
  - `MatInputModule`
  - `MatButtonModule`
  - `MatIconModule`
  - `MatProgressSpinnerModule`
  - `MatDialogModule`
  - `MatSnackBar`

## Zoom Dialog Features

The zoom dialog provides:

- **Mouse Wheel Zoom**: Scroll to zoom in/out
- **Zoom Controls**: Buttons for zoom in, zoom out, and reset
- **Click to Reset**: Click image to reset zoom to 100%
- **Zoom Range**: 50% to 300% zoom levels
- **Responsive Design**: Adapts to mobile screens

## Styling

The component uses Material Design tokens for consistent theming:

- `var(--mat-sys-primary)` for primary actions
- `var(--mat-sys-surface-variant)` for backgrounds
- `var(--mat-sys-outline-variant)` for borders

Custom CSS classes are available for further customization if needed.
