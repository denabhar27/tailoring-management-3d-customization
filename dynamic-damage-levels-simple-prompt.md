# Dynamic Damage Levels per Garment Type Implementation

I need to implement a dynamic damage level system for the repair form where each garment type has its own specific damage levels with custom pricing. Currently, the system uses static damage levels (minor, moderate, major, severe) that apply to all garment types, but I want each garment type to have its own relevant damage levels.

## Key Requirements

The main change needed is to reorder the form fields so that garment type selection comes first, then dynamically load damage levels specific to that garment type. For example, when a user selects "T-shirt" as the garment type, they should see damage levels like "Pristine Condition", "Surface Imperfection Only", "Minor Localized Damage", and "Visible Wear Damage" - each with their own specific prices. If they select "Suit", they might see different damage levels appropriate for suits with different pricing.

## Database Changes Required

I need to create a new database table called `repair_damage_levels` that will store damage level information linked to specific garment types. This table should include fields for the damage level ID, garment type ID (foreign key to repair_garment_types), level name, description, base price, active status, and sort order. I also need to alter the existing repair_garment_types table to add fields for indicating whether the garment type has damage levels and a default damage level ID.

The database migration should be implemented directly in the backend code so it runs automatically when the application starts, without requiring manual database setup in XAMPP. This should include proper error handling to ensure the tables are created correctly.

## Backend API Enhancements

The backend needs new API endpoints to manage damage levels, including getting garment types with their associated damage levels, creating new damage levels, updating existing ones, and deleting damage levels. The existing garment type API should be enhanced to include damage level information when fetching garment types.

The model layer needs new methods to handle damage level CRUD operations, including methods to get garment types with their damage levels in a single query using JSON aggregation for efficiency.

## Admin Panel Updates

The admin panel for managing repair garment types needs to be enhanced to allow administrators to configure damage levels for each garment type. When adding or editing a garment type, there should be a section to manage damage levels with the ability to add multiple damage levels, set their names, descriptions, prices, and sort order. The interface should support adding, editing, and removing damage levels dynamically.

## Frontend Web Form Changes

The web repair form modal needs significant updates to support the dynamic damage level system. The form should first ask for garment type, then based on the selection, dynamically populate the damage level dropdown with the specific options for that garment type. The price calculation should be updated to use the actual prices from the damage levels rather than static values.

The form field order should be changed to: Garment Type → Damage Level → Notes. When a user changes the garment type, the damage level selection should reset and show the appropriate options for the newly selected garment type.

## React Native Implementation

The React Native repair clothes component needs similar updates to match the web functionality. The garment type picker should come first, followed by a dynamic damage level picker that updates based on the selected garment type. The price calculation logic should be updated to use the dynamic damage level prices, and the UI should show damage level descriptions to help users understand what each level includes.

The React Native implementation should maintain the same user experience flow as the web version, with proper loading states and error handling for the dynamic data loading.

## Data Migration Strategy

I need to implement a data migration process that creates default damage levels for existing garment types in the system. This should automatically create standard damage levels (like Minor, Moderate, Major, Severe) for all existing garment types with appropriate base prices, ensuring the system continues to work after the upgrade without losing functionality.

## Implementation Approach

The implementation should be done in phases: first implement the database changes and backend API, then update the admin panel to allow damage level management, then update the web form, and finally update the React Native form. Each phase should be tested thoroughly before moving to the next.

All changes should maintain backward compatibility where possible, and the system should gracefully handle cases where garment types don't have damage levels configured (falling back to default options if needed).

## Expected Outcome

After implementation, users will be able to select a garment type and see only relevant damage levels for that specific garment type, with accurate pricing that reflects the actual repair complexity for that garment and damage level. Administrators will have full control over damage levels and pricing for each garment type, making the repair service more accurate and professional.
