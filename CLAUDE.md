# Picki - Multi-Vendor Food Ordering Platform

## Project Overview

**Picki** is a multi-vendor food ordering platform built with Angular 20 and Supabase. It enables restaurant vendors to manage their menus, receive orders, and process payments through a unified platform.

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | Angular 20, Angular Material, TailwindCSS |
| **State Management** | NgRx (Store, Effects, Entity) |
| **Backend** | Supabase (PostgreSQL + Edge Functions) |
| **Auth** | Supabase Auth |
| **Payments** | Stripe, PayGreen |
| **Delivery** | Stuart, Uber Direct integrations |

---

## Project Structure

```
src/app/
├── components/       # 35+ Angular components
├── services/         # 20+ services for business logic
├── models/           # TypeScript interfaces
├── store/            # NgRx state management
├── guards/           # Route guards (auth, vendor, dining preference)
├── shared/           # Shared components and pipes
└── types/            # Supabase generated types

supabase/
├── functions/        # Edge functions for backend logic
└── migrations/       # Database migrations
```

---

## Core Domain Models

### Vendors
Restaurants/businesses with configuration:
- `business_name`, `business_type`, `country`
- `currency` - Vendor-specific currency
- `paymentprovider` - Stripe or PayGreen
- `enabled_order_types` - eat-in, take-away, delivery
- `delivery_system` - 'picki' or 'own'
- `customDomain` - Optional custom domain support
- `online_payments_enabled` - Toggle for online payments
- `is_active`, `orders_suspended_at` - Operating status

### Products
Menu items with:
- Categories and display ordering
- Multi-step product configurations (customizations)
- Stock management
- Price and availability

### Orders
Customer orders with status flow:
```
initiated → paid → todo → ongoing → done → picked
                 ↘ refused/cancelled
```

Order types: `eat-in`, `take-away`, `delivery`
Timing: `asap`, `later` (scheduled)

### Customers
- firstName, lastName, email, phone

---

## Routing Architecture

### Public Routes
- `/` - Vendor selection page (main pikiapp domain only)
- `/vendor/:vendorSlug/*` - Vendor-specific storefront
- Custom domain support: `granola.fr` routes directly to vendor app

### Vendor App Routes (nested under vendor context)
- `/dining-preference` - Welcome screen with order type selection
- `/promotional-banner/categories` - Category grid
- `/promotional-banner/:category/products` - Product grid
- `/:category/product/:productName` - Product detail/add page
- `/cartdetails` - Cart and checkout
- `/successPayment`, `/failedPayment` - Payment result pages

### Admin Routes
- `/admin/login` - Admin authentication
- `/admin/register` - Vendor self-registration
- `/admin/orders-manager` - Order management dashboard
- `/admin/product-manager` - Product/menu management
- `/admin/restaurant-info` - Restaurant settings

---

## Key Services

### Vendor Management
- `VendorService` - Vendor context, caching (5min TTL), vendor list
- `VendorNavigationService` - Vendor-aware routing

### Orders
- `OrdersService` - CRUD operations, status updates, real-time subscriptions

### Products
- `ProductService` - Product catalog queries
- `ProductAdminService` - Product CRUD for admin
- `CustomisationService` - Multi-step product configurations

### Payments
- `PaymentService` - Payment orchestration
- `StripeService` - Stripe checkout integration
- `PaygreenBackendService` - PayGreen integration

### Auth
- `SupabaseAuthService` - Authentication with Supabase Auth
- `AuthService` - App-level auth state management

### Database
- `SupabaseService` - Database operations wrapper

---

## Supabase Edge Functions

| Function | Purpose |
|----------|---------|
| `stripe-create-checkout-session` | Create Stripe checkout |
| `stripe-get-checkout-session` | Retrieve checkout status |
| `create-paygreen-order` | Create PayGreen payment |
| `capture-paygreen-order` | Capture PayGreen payment |
| `get-paygreen-order` | Get PayGreen order status |
| `create-vendor-account` | Vendor registration |
| `stuart-delivery` | Stuart delivery integration |
| `stuart-webhook` | Stuart webhook handler |
| `uber-direct-delivery` | Uber Direct integration |
| `uber-webhook` | Uber webhook handler |
| `send-order-confirmation` | Email notifications |

---

## State Management (NgRx)

### Store Structure
- `cart` - Shopping cart state
- `auth` - Authentication state
- `multi-step-product` - Product customization state
- `promotional-banners` - Banner state

### Key Patterns
- Effects for async operations
- Entity adapter for collections
- Selectors for derived state

---

## Guards

- `AdminAuthGuard` - Protects admin routes
- `VendorGuard` - Validates vendor slug
- `customDomainVendorGuard` - Handles custom domain routing
- `diningPreferenceGuard` - Ensures order type is selected

---

## Key Features

1. **Multi-vendor Support** - Each vendor has isolated products, orders, settings
2. **Order Types** - Eat-in, take-away, delivery with specific flows
3. **Payment Options** - Online (Stripe/PayGreen) or pay-at-checkout
4. **Multi-step Products** - Complex products with customization steps
5. **Business Hours** - Per-vendor operating hours with open/close validation
6. **Custom Domains** - Vendors can use their own domain
7. **Delivery Integration** - Stuart and Uber Direct APIs
8. **Real-time Updates** - Supabase subscriptions for orders
9. **Currency Support** - Per-vendor currency with formatting pipes

---

## Development Guidelines

### Angular Conventions
- Use standalone components
- Use `inject()` function for DI
- Use async pipe for observables in templates
- Follow kebab-case file naming

### Code Style
- Single quotes for strings
- 2-space indentation
- Prefer `const` for immutable variables
- Use TypeScript interfaces for type safety
- Avoid `any` type

### Import Order
1. Angular core/common modules
2. RxJS modules
3. Other Angular modules
4. Application core imports
5. Shared module imports
6. Environment imports
7. Relative path imports

---

## Local Development

### Prerequisites
- Node.js, npm
- Supabase CLI

### Commands
```bash
npm start          # Start dev server
npm run build      # Production build
npm test           # Run tests
```

### Supabase Local
```bash
supabase start                    # Start local Supabase
supabase db reset --yes --local   # Reset local database
supabase functions serve          # Run edge functions locally
```

### Environment Variables
- Local: `LOCAL_SUPABASE_URL`, `LOCAL_SUPABASE_SERVICE_ROLE_KEY`
- Remote: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

Note: For local edge functions, use `http://kong:8000` instead of `http://127.0.0.1:54321` for internal service calls.

---

## Database Tables (Key)

- `vendors` - Vendor accounts and settings
- `products` - Menu items
- `categories` - Product categories
- `orders` - Customer orders
- `order_items` - Items within orders
- `business_hours` - Vendor operating hours
- `banners` - Promotional banners
- `vendor_metadata` - Additional vendor settings
- `product_steps` / `step_options` - Multi-step product configuration
