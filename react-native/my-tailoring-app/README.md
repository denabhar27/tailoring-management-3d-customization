# Web User vs Mobile User Parity List

Goal: list what the web user app has that the mobile user app still does not have.

## Compared Apps

- Web user: tailoring-management-user/src/user and related user components
- Mobile user: react-native/my-tailoring-app/app and related mobile utilities

## Web User Features Missing on Mobile User

### High Priority (core user actions)

- [ ] Price confirmation action buttons (Accept / Decline)
  - Web user can respond when admin changes price
  - Mobile user currently sees the status/notes but no action buttons

- [ ] Compensation decision flow (damage/liability)
  - Web user can review compensation case and respond
  - Mobile user has no compensation decision UI

- [ ] Enhancement request flow after service completion
  - Web user can request enhancements and track enhancement result
  - Mobile user has no enhancement request screen/flow

### Medium Priority (tracking and transparency)

- [ ] Full order detail parity (web-style detail breakdown and richer status context)
- [ ] Full transaction detail modal parity (web has richer per-order detail)
- [ ] Rental deposit refund status visibility
- [ ] Rental overdue penalty visibility (per day and total)
- [ ] Better display of admin update reason/context in the order flow

### User Self-Service Gaps

- [ ] Measurement self-management from mobile (add/edit/update), if this is intended for users
- [ ] Cancel order item from mobile profile/history with reason input

### UI/Info Gaps

- [ ] Richer rental bundle/item detail display like web
- [ ] Complete parity for service-specific order cards and details

## Mobile User Features Already Present

- Login/signup/forgot password
- Home, FAQ, contact, notifications
- Core services: customization, dry cleaning, repair, rental
- Cart flow and order preview
- Order history and transaction log screen
- Profile with timeline display and measurement view
- Appointment date/time slot booking

## Quick Build Order

1. Price confirmation accept/decline UI + API wiring
2. Compensation decision UI + API wiring
3. Enhancement request UI + status tracking
4. Rental penalty and deposit refund visibility
5. Remaining detail and self-service parity

## Code Reference Pointers

- Web user profile/details: tailoring-management-user/src/user/Profile.jsx
- Web user order details: tailoring-management-user/src/user/OrderDetailsModal.jsx
- Web transaction details: tailoring-management-user/src/user/components/TransactionLogModal.jsx
- Mobile profile: react-native/my-tailoring-app/app/(tabs)/UserProfile/profile.tsx
- Mobile order history: react-native/my-tailoring-app/app/(tabs)/orders/OrderHistory.tsx
- Mobile order details: react-native/my-tailoring-app/app/(tabs)/orders/[id].tsx
- Mobile cart: react-native/my-tailoring-app/app/(tabs)/cart/Cart.tsx
- Mobile APIs: react-native/my-tailoring-app/utils/apiService.ts
