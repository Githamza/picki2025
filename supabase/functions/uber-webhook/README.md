# Uber Eats Webhook Handler

This Edge Function handles webhooks from Uber Eats Direct API for delivery status updates.

## URL Pattern

```
/functions/v1/uber-webhook/:vendorId/deliveryupdates
```

## Supported Events

### 1. Delivery Status Webhook (`event.delivery_status`)

- **Implemented**: ✅ Full implementation
- **Triggers**: Whenever delivery status or courier_imminent changes
- **Status Mapping**:
  - `pending` → `created`
  - `pickup` (courier_imminent: false) → `en_route_to_pickup`
  - `pickup` (courier_imminent: true) → `arrived_at_pickup`
  - `pickup_complete` → `in_transit`
  - `dropoff` (courier_imminent: false) → `en_route_to_dropoff`
  - `dropoff` (courier_imminent: true) → `arrived_at_dropoff`
  - `delivered` → `delivered`
  - `canceled` → `cancelled`
  - `returned` → `returned`

### 2. Courier Status Webhook (`event.courier_status`)

- **Status**: 🚧 Not yet implemented
- **Purpose**: Handle courier-specific events

### 3. Refund Webhook (`event.refund`)

- **Status**: 🚧 Not yet implemented
- **Purpose**: Handle refund-related events

## Database Updates

The function updates the `order_deliveries` table with:

- `status` - Mapped internal status
- `updated_at` - Current timestamp
- `occurred_at` - Event timestamp from Uber
- `event_id` - Uber event ID (for deduplication)
- `tracking_url` - Uber tracking URL
- `eta_timestamp` - Dropoff ETA if available
- `last_known_location` - Courier location if available
- `raw` - Complete webhook payload (for debugging)

## Error Handling

- Returns 200 OK for unsupported event types (graceful ignore)
- Returns 400 for missing vendorId or invalid JSON
- Returns 500 for database errors
- Logs warnings when no matching delivery records found

## Security

- CORS enabled for webhook calls
- Uses Supabase service role key for database access
- Validates webhook structure before processing

## Next Steps

1. Implement courier status webhook handler
2. Implement refund webhook handler
3. Add webhook signature verification for security
4. Add duplicate event detection using event_id
