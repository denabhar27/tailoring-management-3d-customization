# Rental Application UI Enhancement Prompt

## Overview
Implement comprehensive UI and functional changes to the rental application for both web and React Native platforms. The changes focus on improving individual item selection and bundled item selection workflows with enhanced size/quantity controls and cart integration.

## Current State Analysis

### Web Implementation (React)
- **File**: `tailoring-management-user/src/user/components/RentalClothes.jsx`
- **Current Individual Item Flow**: Click "View" button → opens modal with size selection table
- **Current Bundle Flow**: Click "Select Multiple" → select items → horizontal mini modal appears → date selection → add to cart
- **Size System**: Uses `SIZE_LABELS` mapping (small, medium, large, extra_large) with quantity/price per size
- **Data Structure**: `sizeOptions` object with per-size quantities and prices

### React Native Implementation
- **File**: `react-native/my-tailoring-app/app/(tabs)/rental/index.tsx`
- **Current Individual Item Flow**: Tap card → navigates to detail page
- **Current Bundle Flow**: Similar to web but with native components
- **Missing Features**: No size/quantity selection in bundle mode

## Required Changes

### 1. Individual Rental Items (Both Platforms)

**Current**: Click "View" button → opens modal
**New**: Click entire card → opens enhanced info modal

**Enhanced Modal Requirements**:
- Replace "View" button with direct card click functionality
- Display measurement details (integrate existing measurement system)
- Size options (S, M, L, XL) with plus/minus quantity controls
- Real-time price calculation based on selected quantities
- Use existing admin-configured quantities and prices from `sizeOptions`
- Maintain existing measurement display functionality

**Key Implementation Points**:
```javascript
// Web: Modify onClick handler in rental card
onClick={() => isMultiSelectMode ? toggleItemSelection(item) : openModal(item)}

// Size selection should use existing structure:
sizeOptions: {
  small: { quantity: 5, price: 500, measurements: {...} },
  medium: { quantity: 3, price: 600, measurements: {...} },
  // etc.
}
```

### 2. Bundled Rental Items (Both Platforms)

**Current**: Select items → horizontal modal with date selection
**New**: Enhanced size/quantity selection before horizontal modal

**New Bundle Flow**:
1. User clicks "Select Multiple"
2. Size chips (S, M, L, XL) appear beside each rental card
3. Click size chip → reveals plus/minus quantity selector below the card
4. User selects quantities for multiple sizes across multiple items
5. Horizontal mini modal shows selected items with quantities
6. Date selection and cart addition as before

**Bundle Selection UI Requirements**:
- Size chips beside cards (only in multi-select mode)
- Plus/minus controls below cards when size is selected
- Disable sizes with zero quantity (show non-modal message)
- Maintain selection state per item per size
- Update horizontal modal to show selected items with quantities

**State Management**:
```javascript
// New state structure for bundle selections
const [bundleSelections, setBundleSelections] = useState({
  itemId: {
    small: { quantity: 2, price: 500 },
    medium: { quantity: 1, price: 600 }
  }
});
```

### 3. Horizontal Mini Modal Enhancement

**Current**: Shows selected items count and estimated downpayment
**New**: Show detailed selected items with images and quantities

**Enhanced Modal Requirements**:
- Display small images of selected items
- Show selected sizes and quantities for each item
- Maintain "Set Dates" and "Add to Cart" functionality
- Update cost calculation based on actual selections

### 4. Cart Integration & Data Consistency

**Requirements**:
- Ensure all size/quantity data flows correctly to cart
- Update order history/tracking to reflect new selection structure
- Admin management system must display detailed size/quantity information
- Maintain backward compatibility with existing cart structure

**Cart Data Structure Enhancement**:
```javascript
// Enhanced cart item structure
{
  serviceType: 'rental',
  specificData: {
    selected_sizes: [
      { sizeKey: 'small', quantity: 2, price: 500 },
      { sizeKey: 'medium', quantity: 1, price: 600 }
    ],
    // existing fields...
  }
}
```

## Implementation Strategy

### Phase 1: Web Implementation
1. Modify `RentalClothes.jsx` card click handlers
2. Enhance individual item modal with size/quantity controls
3. Implement bundle size selection UI
4. Update horizontal mini modal
5. Test cart integration

### Phase 2: React Native Implementation
1. Update `rental/index.tsx` with similar changes
2. Adapt UI components for native platform
3. Implement native size selection controls
4. Test mobile-specific interactions

### Phase 3: Data Integration
1. Update cart API to handle enhanced data structure
2. Modify admin panel to display detailed selections
3. Update order history/tracking
4. Ensure data consistency across platforms

## Technical Requirements

### Web (React)
- Use existing CSS classes and styling patterns
- Maintain responsive design
- Preserve accessibility features
- Use existing measurement system (`formatMeasurements`, `getMeasurementsSummary`)

### React Native
- Use native components (`TouchableOpacity`, `View`, `Text`)
- Maintain platform-specific design patterns
- Preserve gesture handling
- Use existing navigation patterns

### Shared Logic
- Size validation and quantity limits
- Price calculation algorithms
- Cart data formatting
- Error handling for out-of-stock items

## Error Handling & Edge Cases

1. **Out of Stock Sizes**: Disable selection, show non-modal message
2. **Invalid Quantities**: Validate against admin-configured limits
3. **Price Calculation**: Handle missing/invalid price data
4. **Cart Failures**: Graceful fallback with user feedback
5. **Network Issues**: Maintain local state until sync completes

## Testing Requirements

1. **Unit Tests**: Size selection, price calculation, cart formatting
2. **Integration Tests**: End-to-end flow from selection to cart
3. **Cross-Platform Tests**: Consistent behavior between web and mobile
4. **Edge Case Tests**: Zero quantities, missing data, network failures

## Success Metrics

1. **User Experience**: Seamless size/quantity selection
2. **Data Accuracy**: Correct cart and order data
3. **Performance**: No degradation in loading/interaction speed
4. **Cross-Platform**: Consistent behavior on web and mobile
5. **Backward Compatibility**: Existing functionality preserved

## Reference Design
See attached image showing desired UI pattern with size selector, quantity controls, and product information layout.

## Files to Modify

### Web
- `tailoring-management-user/src/user/components/RentalClothes.jsx`
- `tailoring-management-user/src/styles/RentalClothes.css`

### React Native
- `react-native/my-tailoring-app/app/(tabs)/rental/index.tsx`
- Related style components

### Backend (if needed)
- Cart API endpoints
- Admin panel display logic

## Implementation Priority
1. Individual item modal enhancement (both platforms)
2. Bundle size selection UI (web first, then mobile)
3. Horizontal modal updates
4. Cart integration testing
5. Admin panel updates
