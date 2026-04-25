# Picki — Product Knowledge Base

> A functional reference of the Picki SaaS platform.  
> Audience: LLMs reasoning about the product, proposing improvements, or building new features.  
> Scope: WHAT the product does and for WHOM. Implementation details (frameworks, code structure, libraries) are intentionally excluded.

---

## 1. What is Picki?

**Picki is a multi-vendor food-ordering SaaS for independent restaurants and food businesses.**

It gives each restaurant ("vendor") a fully working, branded **online ordering storefront** plus a complete **back-office dashboard** to run service: take orders, manage the menu, accept payments, and dispatch deliveries — without building anything custom.

The platform sits between three actors:

- **Customers** — order food on a vendor's storefront (eat-in, take-away, or delivery).
- **Vendors** — restaurant owners and staff who manage menu, orders, payments, hours and branding.
- **Picki (the platform operator)** — runs the marketplace, optionally takes a platform fee, and provides shared infrastructure (payments, delivery, emails, onboarding).

Picki is positioned as a **direct-to-customer alternative to commission-heavy aggregators** (Uber Eats, Just Eat, Deliveroo): each vendor keeps their own customers, branding, and most of the margin, while still benefiting from delivery and payment integrations under the hood.

---

## 2. Core Concepts (Glossary)

| Term | Meaning |
|------|---------|
| **Vendor** | A restaurant / food business with its own menu, settings, hours and orders. The base tenant of the platform. |
| **Storefront** | The public-facing ordering site a customer sees for a given vendor. |
| **Custom domain** | A vendor can use their own domain (e.g. `granola.fr`) for their storefront, instead of `pikiapp.com/vendor/<slug>`. |
| **Order type** | One of `eat-in`, `take-away`, `delivery`. Each vendor enables a subset. |
| **Dining preference** | The combined choice the customer makes before browsing: order type + timing (ASAP / scheduled) + table number (eat-in) + drop-off address (delivery). |
| **Product** | A menu item. Can be simple, configurable (with complements/options), or a **multi-step product** (a "formule" / combo with sequential choices). |
| **Category** | A grouping of products on the menu. |
| **Complement / Accessory** | Optional add-ons (e.g. extra sauce, cutlery). Accessories can be tied to specific order types. |
| **Multi-step product (Formule)** | A bundled offer where the customer goes through ordered steps to compose the item (e.g. "choose a starter → main → drink"). Each step is single- or multi-choice with min/max rules. |
| **Stock** | Optional quantity-on-hand per product or per option, with concurrency-safe decrement and an optional daily reset to "unlimited". |
| **Coupon** | A vendor-scoped promo code (percent or fixed amount), validated server-side, with date window, max uses and minimum-spend rules. |
| **Order** | A confirmed basket with customer info, totals, fees, status and (optionally) delivery tracking. |
| **Order status flow** | `initiated → paid → todo → ongoing → done → picked` (with branches `refused` / `cancelled`). |
| **Suspended orders** | A vendor toggle that temporarily stops accepting new orders, with a customer-facing message. |
| **Pickup hours** | Click & collect window, separate from general opening hours. |
| **Picki delivery vs Own delivery** | Either Picki orchestrates couriers (Stuart / Uber Direct / Just Eat DaaS), or the vendor handles delivery themselves at a fixed price. |
| **Payment provider** | Per-vendor choice between **Stripe** and **PayGreen**, each with its own onboarding and capture flow. |
| **Marketplace mode (PayGreen)** | Payments flow through Picki, then are split to the vendor (vs. "independent" mode where money goes straight to the vendor's own PayGreen account). |
| **Platform fee** | Optional Picki commission added to a Stripe checkout, e.g. to fund delivery. |

---

## 3. Personas & High-Level User Journeys

### 3.1 Customer (end consumer)
1. Lands on a vendor storefront (via Picki vendor list, direct link, or the vendor's custom domain).
2. Picks a **dining preference** (eat-in / take-away / delivery, ASAP or scheduled, table #, delivery address on a map).
3. Browses the menu by **category** (or all products), sees promotional banners and a possible info banner.
4. Opens a product → either adds it directly, customizes it (complements), or walks through a **multi-step formule**. Can leave an order comment.
5. Reviews the **cart** (sheet or full page): line items, multi-step recap, accessories upsell, **coupon code**, fees.
6. Provides contact info (name, email, optional phone) and either:
   - Pays online via the redirected hosted checkout (Stripe or PayGreen), or
   - Confirms a "pay at the venue" order (when online payments are off).
7. Lands on a **payment success / failure page** with order details, status, payment summary, and (for delivery) live courier tracking.
8. Can revisit the storefront's public **orders queue board** to see their order number progress through "Confirmed → In preparation → Ready".

### 3.2 Vendor (restaurant owner / staff)
1. **Self-registers** an account on Picki, optionally importing their menu from an existing **Uber Eats URL**, or starting from a default catalog.
2. Configures the storefront via the **back-office dashboard**:
   - Branding (logo, banner, optional banner title)
   - Business hours, click & collect hours, automatic daily suspension time
   - Order types, delivery mode and price
   - Payment provider (Stripe Connect onboarding or PayGreen setup, marketplace or independent)
   - Contact info, customer-facing messages (closed dialog, suspended bar, info banner)
   - Stock policy, coupon codes
3. Builds the **menu**: categories, products, multi-step formules, complements/accessories, VAT rates, max quantity per order, stock.
4. **Operates service** in real time:
   - Sees incoming orders on a kanban dashboard, with sound alerts.
   - Accepts/refuses orders (refusal triggers a customer email + reason).
   - Advances order status through the lifecycle (todo → ongoing → done → picked).
   - Captures PayGreen payments when accepting.
   - Triggers delivery (Stuart / Uber / Just Eat) for delivery orders.
   - Suspends orders manually if needed.

### 3.3 Picki (platform operator)
- Manages the multi-vendor directory and shared infrastructure.
- Optionally takes platform fees (Stripe Connect application fee, PayGreen marketplace split).
- Provides automated onboarding tools, email notifications and integrations.

---

## 4. Customer-Facing Features (Storefront)

### 4.1 Vendor discovery & landing
- **Vendor directory page** on the main Picki domain: list of restaurants with name, type, open/closed status, "Enter restaurant" CTA, empty state when none available.
- **Custom domain support**: a vendor's storefront can be served at the root of their own domain.
- **Top banners** on the vendor shell: warning bar when orders are suspended (customizable text), optional dismissible **info banner** (e.g. "Closed Dec 24–26").

### 4.2 Welcome & dining preference
- **Personalized welcome screen** (`Bienvenue chez [restaurant]`) with a promotional strip.
- **Dining preference selector**:
  - Choose order type (limited to what the vendor enabled).
  - Choose timing: **ASAP** or **scheduled later** with time picker.
  - Eat-in: enter a **table number**.
  - Delivery: **map flow** to share/adjust the drop-off position and confirm the address.
- Previously chosen preferences are restored on return.
- Preference can be edited at any time from the toolbar or from the cart.

### 4.3 Menu browsing
- **Promotional banner carousel** with auto-rotation, navigation dots, tap-to-enter the menu.
- **Category grid** (image, name, short description) with loading and empty states.
- **Sidebar category menu** with an "Tout" (all) shortcut + per-category rows.
- **Horizontal scroll category chips** for narrow screens.
- **Product grid / list** showing name, price, description snippet and an **out-of-stock state** ("Victime de son succès").
- Browsing is by category and navigation; there is **no global search bar** in the storefront.
- **Restaurant info dialog**: opening hours per day, phone, email, website, full address.
- **Restaurant closed dialog**: shown when the vendor is outside opening hours, with vendor-customizable title and description.
- **Theme toggle** (light/dark) in the toolbar.

### 4.4 Product configuration
- **Simple product view**: photo, title, price, descriptions, optional **per-line comment**, quantity selector, "Add to cart" or "Customize and add" depending on whether complements exist.
- **Complements**: required vs optional, single vs multiple, max selections, with prices.
- **Multi-step product (formule)**: tabbed step-by-step builder; each step is single- or multi-choice with min/max; options can have images with zoom; running total; summary step; optional long comment; final quantity + add to cart.
- **Stock-aware**: a product or an option can be unavailable; the "add" action accounts for what is already in the cart.

### 4.5 Cart & checkout
- **Floating cart badge** ("Voir mon panier (N)") visible across the storefront.
- **Cart bottom sheet**: line items with thumbnail and quantity controls, expandable summaries for multi-step items, per-line comments, accessories upsell strip, **coupon code input**, delivery and service fees, dining-preference edit, total.
- **Full-page cart** ("Mon panier") with the same elements (no coupon row in the full page version).
- **Stock validation** before going to payment.
- **User info dialog** at checkout: optional preference re-confirm + last name / first name / email (required) / phone (optional).
- Checkout is **blocked** when orders are suspended or the restaurant is closed for the day.
- Distinguishes **"pay online"** vs **"pay at pickup / counter"** with clear iconography and labels.

### 4.6 Coupons (customer side)
- Coupon field appears in the cart sheet when subtotal > 0.
- Code is uppercased automatically; busy/error states are shown.
- After success, the cart shows the **applied code + discount amount** with a remove control.
- Final discount is **always recomputed server-side** at payment creation, so a manipulated client cannot fake a discount.

### 4.7 Payment outcome pages
- **Payment success page**:
  - Processing state, then either "Card payment confirmed" or "Order registered, pay at pickup".
  - Order number, type, timing, scheduled time, status, refusal reason if applicable.
  - **Delivery block**: map, address, status, ETA, tracking link, sometimes embedded tracking.
  - Customer block, line items with totals, payment method/amount, notes.
  - "Return home" CTA; gracefully handles missing payment details.
- **Short failure page** (`payment-failed`): retry button + go home.
- **Detailed failure page** (`failed-payment`): error code/message/transaction id/provider, "what to do" list, common reasons, actions: back to menu, contact support, retry.

### 4.8 Public order tracking
- **Orders queue board** ("Suivi des commandes") at a public URL on the vendor storefront — three columns: **Confirmée**, **En préparation**, **Prête** — showing order number + order-type icon + status. Auto-polls. Designed to be displayed on a screen in the venue.

---

## 5. Vendor / Admin Features (Back-Office)

### 5.1 Onboarding & login
- **Self-registration**: restaurant name, owner name, email, password, optional **Uber Eats URL** for automatic menu import (with progress feedback). Falls back to a default starter menu.
- **Default starter assets** (banners, hours defaults) are seeded so a new vendor's storefront is usable immediately.
- **Login** with email/password, with vendor-aware branding when a vendor is already selected.
- Session timeout after 8 hours of inactivity.
- Post-login nudge to **configure online payments** if they are enabled but no provider is set.

### 5.2 Live order management
- **Kanban dashboard** with columns adapted to enabled order types: dine-in vs take-away/delivery.
- **Period filter & revenue total**: today, since yesterday, last 7 days, this month, all.
- **Manual + automatic refresh** (every 10s). **Sound alert** for new orders, with mute toggle.
- **Order cards** show: number, status, paid online vs pay-at-venue, order type, ASAP vs scheduled, table number, totals (with fee tooltips).
- **Status workflow** (French UI): pending → paid → todo → ongoing → done → picked (eat-in stops earlier where applicable).
- **Validation**: accept / refuse — refusal opens a **reason dialog** (preset reasons + custom text) and triggers a customer email.
- **Order details dialog**: full line items, customer info, status actions, delivery address on a map.
- **Payment capture**: PayGreen orders can require explicit capture on accept; Stripe is handled automatically.

### 5.3 Menu / product management
- **Categories tab**: full CRUD, ordering, imagery, active/inactive state.
- **Products tab**: list with search and "show unavailable" toggle, CRUD; sub-tabs for **regular products** vs **accessoires** (accessories).
- **Formules tab**: create, configure, duplicate, delete bundled menus; deep editor for **multi-step formules** (steps, options, ordering, images, VAT, bulk product picker).
- **Complements admin**: pick a base product and attach others as complements with rules — single vs multiple, max selections, required, display order, free / custom price / catalog price.
- **VAT rate per product** (FR defaults: reduced / food / standard; **Belgium 12%** supported).
- **Max quantity per product per order**.
- **Stock per product** (and per option), with optional **daily midnight reset**.
- "Aller vers ma boutique" link to open the public storefront in a new tab.

### 5.4 Restaurant settings (Restaurant Info)
The settings area has dedicated child pages, each handling one concern:

- **Apparence** — Logo (upload or URL), banner (upload or URL), optional banner title.
- **Horaires** — Per-day open/close, optional **click & collect hours**, **automatic daily suspension** at a chosen time.
- **Commandes** — Enable/disable order types (eat-in, take-away, delivery; at least one required). For delivery, choose **Picki delivery** vs **own delivery** with a fixed delivery price.
- **Paiement** — Master switch for online payments. Stripe Connect onboarding (status, "Configurer mon compte"). PayGreen setup with SIRET + address, including marketplace onboarding. Pick the **active provider** and **mode** (independent vs marketplace) with explanatory copy about platform vs vendor share.
- **Contact** — Phone, email, website, address (street, postal code, city, country).
- **Messages** — Customizable strings for: closed-restaurant dialog (title + description), suspended-orders bar, optional storefront info banner (on/off + text).
- **Stocks** — Toggle for daily stock reset at midnight.
- **Coupons** — List of codes with active/total counts. Create / edit dialog: code, percent vs fixed, valid from/until, optional max uses, optional minimum subtotal, active flag. Toggle active, delete with confirmation. Vendor only manages their own codes.

### 5.5 Suspending service
- **Sidenav toggle** between "Commandes ouvertes" and "Commandes suspendues" (with snackbar confirmation).
- **Automatic** daily suspension via Horaires.
- **Custom message** displayed to customers in both states.

### 5.6 Roles & access control
- Each admin user has a role: **staff < manager < admin** (hierarchical).
- Routes carry permission metadata (`orders` / `vendor` / `products` × `read` / `update`) and an optional minimum role.
- Auth guard enforces: signed in, account active, valid session, vendor slug matches the user's vendor.

### 5.7 Custom domains
- A vendor's customer storefront can be served at the root of their own domain.
- The Picki main domain root redirects operators to `/admin/orders-manager`.
- Admin back-office stays under `/admin/...` regardless of domain.

---

## 6. Cross-Cutting Domains

### 6.1 Coupons (full system)
- **Per-vendor scope** — the same code can exist across different vendors.
- **Two types** — percentage off, or fixed amount (capped at subtotal).
- **Constraints** — start/end date, optional max redemptions, optional minimum order value, active flag.
- **Validation** — `validate-coupon` returns valid/invalid + computed discount **without** counting a use.
- **Enforcement** — Stripe and PayGreen checkout creation re-run the same validation server-side; the customer's client cannot manipulate the discount.
- **Redemption counter** — increments **once per order** when the order reaches a "consumed" paid status (idempotent).
- **Admin** — full CRUD restricted by RLS to the vendor that owns the code.

### 6.2 Tax / VAT
- VAT is stored **per product** at edit time and **per order line** at purchase time, so historical receipts remain accurate.
- Allowed rates align with FR defaults; **Belgium 12%** is supported.
- Order-confirmation emails include a **VAT breakdown by rate**, with pro-rata splits for multi-step / formule items so mixed VAT is handled correctly.
- Default rate falls back to a country-aware value when none is set on the product.

### 6.3 Stock management
- Stock can be **unlimited** (null) or a finite number per product / per option.
- Cart blocks checkout when **insufficient stock** is detected, including options nested in multi-step products.
- Stock decrements use **atomic reservation** at order time to prevent overselling under concurrent checkouts.
- Optional **daily reset to unlimited** at midnight UTC for vendors that use stock as a daily production cap.

### 6.4 Order constraints
- **Max quantity per product per order** (vendor-defined cap).
- **Pickup hours** independent from opening hours.
- **Accessories** are restricted to the order types the vendor enables.

### 6.5 Notifications & emails
- Customer emails are sent for: **order confirmation / receipt** (with VAT breakdown), **order ready**, **order refused / cancelled**.
- Sent via Resend when configured; degrades to no-op in development.
- Vendor-side: in-app sound alerts on new orders, with mute toggle.

### 6.6 Vendor onboarding flows
- **Default catalog seeding** — new vendors immediately get categories, sample products and a default banner.
- **Uber Eats import** — give a public Uber Eats restaurant URL → scrape it → format the result into a structured catalog → seed the vendor with that menu (and sometimes hours/banner).
- **Stripe Connect onboarding** — generates a Stripe-hosted onboarding link, then re-checks status until the vendor is ready to receive payouts.
- **PayGreen marketplace onboarding** — collects SIRET + address, creates the marketplace shop, persists onboarding completion flags.

---

## 7. Payment System (Functional View)

Picki supports **two payment providers per vendor** — exactly one is active at a time when online payments are enabled:

### 7.1 Stripe
- **Hosted Stripe Checkout** for the customer.
- **Stripe Connect** so payouts go to the vendor's own Stripe account.
- Optional **platform application fee** (e.g. to cover delivery costs).
- Server-side coupon recomputation before creating the checkout session.

### 7.2 PayGreen
- **Hosted PayGreen payment page** for the customer.
- **Two modes**:
  - **Independent** — vendor uses their own PayGreen account; money lands directly with them.
  - **Marketplace** — payments flow through Picki's PayGreen master account, then split between platform / vendor / delivery; vendor's "shop" is provisioned via marketplace onboarding.
- Supports **authorize then capture** (capture happens when the vendor accepts the order).
- Server-side coupon recomputation before creating the order.

### 7.3 Pay at venue
- When the vendor turns off online payments, customers see "pay at pickup / counter" messaging.
- Orders are still created and tracked, but no payment is processed online.

---

## 8. Delivery System (Functional View)

The platform supports both **Picki-orchestrated delivery** and **vendor-managed delivery**.

### 8.1 Picki delivery
Picki integrates three third-party courier networks:

- **Stuart** — quote → book → status → cancel + webhook events.
- **Uber Direct** — quote → create → status → webhook events (with rich options like time windows, manifest, tips).
- **Just Eat DaaS** — estimate → create → status → cancel + webhook (requires the restaurant to be a registered Just Eat collect point with a region, e.g. UK).

Capabilities provided to the vendor and customer:
- **Multi-provider price/ETA comparison** when more than one is configured, with automatic best-quote selection.
- **Live tracking** on the customer's payment success page (status, ETA, courier link, sometimes embedded map).
- **Webhooks** keep the order's delivery status synchronized.

### 8.2 Own delivery
- Vendor sets a **fixed delivery price**.
- Customer enters an address; no courier quote is run.
- Order delivery is handled outside the platform.

---

## 9. Multi-Tenant & Branding Model

- **Each vendor is an isolated tenant**: products, orders, customers, settings, coupons and assets are all scoped per vendor.
- **Storefront branding** per vendor: logo, banner, banner title, info banner, customer-facing messages, currency.
- **Per-vendor currency**: prices and totals are formatted in the vendor's currency.
- **Per-vendor country**: drives default VAT rates and provider behavior (e.g. Just Eat region).
- **Custom domain** per vendor for a true white-label customer experience.
- **Per-vendor payment provider** and mode.
- **Per-vendor delivery configuration**.

---

## 10. Notable Differentiators & Strengths

1. **End-to-end ownership for the vendor** — they keep their own customers, branding, domain and most of the margin. No commission required by default.
2. **Frictionless onboarding** — sign up, optionally paste an Uber Eats URL, and have a working storefront with a real menu in minutes.
3. **Two-provider payment flexibility** — Stripe for international/standard flows, PayGreen for French/marketplace flows; each with proper Connect-style onboarding.
4. **Real courier marketplace built in** — Stuart, Uber Direct and Just Eat DaaS, with multi-quote comparison and live tracking on the customer side.
5. **Honest tax handling** — per-product, per-line VAT with breakdowns on receipts and country-aware defaults including Belgium.
6. **Operationally complete back-office** — kanban with sound alerts, period revenue, refusal flows, capture flows, suspension toggles, hours + pickup hours, info messages.
7. **Concurrency-safe stock** with optional daily reset — solves the "we sold 12 of the last 10 cookies" class of bug.
8. **Public in-venue queue board** — turns a screen at the counter into a "your order is ready" display.
9. **Server-validated coupons** with vendor-scoped management and idempotent redemption.

---

## 11. Known Functional Gaps & Areas to Watch

These are areas where the product is clearly intentional but where additional work could meaningfully improve the experience:

- **No global product search** in the storefront — discovery is purely category-driven.
- **Coupon UX inconsistency** — the coupon input only appears in the cart **sheet**, not in the full-page cart.
- **No customer accounts / order history** for end consumers (orders are tracked by id; there is no "my orders" login on the storefront).
- **Public orders queue board** is poll-based rather than realtime push.
- **Auxiliary admin tools** (`payment-admin`, `payment-test`, `paygreen-config-demo`) live outside the main routed admin and are dev-leaning.
- **A second login component** (`admin-login-centralized`) exists in parallel with the wired one.
- **Multi-language** — UI strings are predominantly French; no visible i18n switcher.
- **Loyalty / rewards** — not present beyond coupons.
- **Subscription / recurring orders** — not present.
- **Reviews / ratings** — not present on the storefront.
- **Push or SMS notifications** — only email + in-app sound.
- **Vendor analytics** — limited to revenue per period in the orders dashboard; no dedicated analytics screen (best-sellers, conversion funnel, abandoned carts).

---

## 12. Quick Feature Map (Index)

**Customer storefront**: vendor directory · custom domain · welcome screen · dining preference (eat-in / take-away / delivery, ASAP / scheduled, table #, delivery map) · promotional banner carousel · category grid / sidebar / horizontal chips · product grid with stock state · simple + complements product views · multi-step formule builder · per-line comments · cart sheet + full-page cart · coupon input · accessories upsell · user-info dialog · pay-online vs pay-at-venue · payment success page (with delivery tracking) · payment failure pages · public orders queue board · restaurant-info dialog · restaurant-closed dialog · light/dark theme.

**Vendor back-office**: self-registration with Uber Eats import · login with session timeout · permissions (staff/manager/admin × resources) · live orders kanban · period filter + revenue · sound alerts · accept/refuse with reason · status lifecycle · payment capture · order details + delivery map · categories CRUD · products CRUD with search & "show unavailable" · accessories sub-tab · multi-step formule editor · complements admin · per-product VAT + max-qty + stock · daily stock reset · branding (logo / banner / banner title) · hours + pickup hours + automatic daily suspension · order types & delivery mode (Picki vs own) · Stripe Connect onboarding · PayGreen setup with marketplace mode · contact info · customer messages (closed / suspended / info banner) · coupon CRUD · manual order suspension · custom domain.

**Cross-cutting**: per-vendor currency / country · multi-provider payments (Stripe + PayGreen, marketplace optional) · multi-courier delivery (Stuart + Uber Direct + Just Eat DaaS) with quote comparison and live tracking · server-validated vendor-scoped coupons · per-line VAT with breakdown emails · concurrency-safe stock with optional daily reset · email notifications (confirmation / ready / refused) via Resend · onboarding seeding (default catalog + Uber Eats import).
