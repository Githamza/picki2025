# Pickup Time Restriction Feature

## Overview
This feature restricts date and time selection for pickup/delivery orders based on the restaurant's business hours stored in the database.

## Implementation Details

### Changes Made

#### 1. TypeScript Component (`welcome-screen.component.ts`)

**Added:**
- Import of `VendorService` and `BusinessHours` type
- Business hours signal to store restaurant schedule
- Loading state signal
- Date filter function to disable closed days in datepicker
- Computed signal for available time slots based on selected date
- Helper methods:
  - `loadBusinessHours()`: Fetches business hours from VendorService
  - `mapBusinessHoursByDayIndex()`: Converts day names to indexed array
  - `getDayBusinessHours()`: Gets hours for specific day
  - `generateTimeSlots()`: Creates 15-minute interval time slots
  - `getBusinessHoursHint()`: Returns formatted hours text

**Key Features:**
- Automatically loads business hours on component initialization
- Filters out closed days in the datepicker
- Generates time slots only within business hours
- Adds 30-minute buffer for same-day orders
- Resets time selection when date changes

#### 2. HTML Template (`welcome-screen.component.html`)

**Changes:**
- Added `[matDatepickerFilter]="dateFilter"` to both datepickers
- Replaced `mat-timepicker` with `mat-select` for time selection
- Added business hours hint display showing operating hours
- Applied changes to both take-away and delivery sections

**Benefits:**
- Users can only select valid dates (restaurant open days)
- Time dropdown shows only available slots
- Clear visual feedback on operating hours

#### 3. SCSS Styling (`welcome-screen.component.scss`)

**Added:**
- `.business-hours-hint` styles for the info display
- Material Design tokens for consistent theming
- Responsive design considerations

## User Experience

### Date Selection
- Calendar automatically disables days when restaurant is closed
- Users cannot accidentally select unavailable dates

### Time Selection
- Dropdown shows only valid time slots in 15-minute intervals
- For today's date: shows times starting 30 minutes from now
- For future dates: shows all business hours
- Empty dropdown if restaurant is closed that day

### Visual Feedback
- Info badge displays current day's operating hours
- Shows "Fermé ce jour" (Closed this day) if restaurant is closed

## Technical Details

### Time Slot Generation
- **Interval**: 15 minutes
- **Buffer Time**: 30 minutes (for same-day orders)
- **Range**: From opening time to closing time
- **Dynamic**: Updates based on selected date

### Business Hours Mapping
- Sunday = 0
- Monday = 1
- Tuesday = 2
- Wednesday = 3
- Thursday = 4
- Friday = 5
- Saturday = 6

### Data Source
Business hours are fetched from the database via `VendorService.getRestaurantInfo()`, which returns:
```typescript
interface BusinessHours {
  day: string;
  open_time: string | null;
  close_time: string | null;
  is_closed: boolean;
}
```

## Testing Recommendations

1. **Test with various business hours configurations**
   - Standard hours (e.g., 11:00 - 22:00)
   - Split shifts
   - Closed days

2. **Test edge cases**
   - Restaurant open 24 hours
   - Very short operating hours
   - Orders placed close to closing time
   - Same-day vs future day selections

3. **Test user flow**
   - Select date first, then time
   - Change date after selecting time (should reset)
   - Try selecting closed days (should be disabled)

## Future Enhancements

Potential improvements:
- Support for multiple time ranges per day (lunch/dinner shifts)
- Holiday/special hours override
- Different intervals for different times (e.g., 30 min during lunch rush)
- Reservation capacity limits per time slot
- Real-time availability updates

## Files Modified

1. `src/app/components/welcome-screen/welcome-screen.component.ts`
2. `src/app/components/welcome-screen/welcome-screen.component.html`
3. `src/app/components/welcome-screen/welcome-screen.component.scss`

## Dependencies

- Angular Material Datepicker
- Angular Material Select
- Angular Signals (for reactive state)
- VendorService (for business hours data)

