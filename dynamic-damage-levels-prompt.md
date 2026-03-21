# Dynamic Damage Levels per Garment Type Implementation

## Overview
Implement a dynamic damage level system where each garment type has its own specific damage levels with custom pricing. The garment type selection should come first, followed by dynamic damage level options specific to that garment type.

## Current State Analysis

### Existing Structure
- **Web Form**: `RepairFormModal.jsx` - currently uses static damage levels (minor, moderate, major, severe)
- **React Native**: `RepairClothes.tsx` - similar static damage level system
- **Backend**: `RepairGarmentTypeModel.js` - basic garment type storage without damage levels
- **Admin Panel**: `repair.jsx` - manages garment types but no damage level configuration

### Current Damage Levels (Static)
```javascript
const damageLevels = [
  { value: 'minor', label: 'Minor', basePrice: 300, description: 'Small tears, loose threads, missing buttons' },
  { value: 'moderate', label: 'Moderate', basePrice: 500, description: 'Broken zippers, medium tears, seam repairs' },
  { value: 'major', label: 'Major', basePrice: 800, description: 'Large tears, structural damage, extensive repairs' },
  { value: 'severe', label: 'Severe', basePrice: 1500, description: 'Complete reconstruction, multiple major issues' }
];
```

## Required Changes

### 1. Database Schema Enhancement

**New Table**: `repair_damage_levels`
```sql
CREATE TABLE repair_damage_levels (
  damage_level_id INT AUTO_INCREMENT PRIMARY KEY,
  garment_type_id INT NOT NULL,
  level_name VARCHAR(100) NOT NULL,
  level_description TEXT,
  base_price DECIMAL(10,2) NOT NULL,
  is_active TINYINT(1) DEFAULT 1,
  sort_order INT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (garment_type_id) REFERENCES repair_garment_types(repair_garment_id),
  INDEX idx_garment_type (garment_type_id),
  INDEX idx_is_active (is_active),
  INDEX idx_sort_order (sort_order)
);
```

**Update Existing Table**: Add damage level configuration to garment types
```sql
ALTER TABLE repair_garment_types 
ADD COLUMN has_damage_levels TINYINT(1) DEFAULT 1,
ADD COLUMN default_damage_level_id INT NULL;
```

### 2. Backend API Enhancements

#### Model Updates
**RepairGarmentTypeModel.js** - Add damage level methods:
```javascript
// New methods to add
getWithDamageLevels: (callback) => {
  const sql = `
    SELECT 
      g.*,
      JSON_ARRAYAGG(
        JSON_OBJECT(
          'damage_level_id', d.damage_level_id,
          'level_name', d.level_name,
          'level_description', d.level_description,
          'base_price', d.base_price,
          'sort_order', d.sort_order
        )
      ) as damage_levels
    FROM repair_garment_types g
    LEFT JOIN repair_damage_levels d ON g.repair_garment_id = d.garment_type_id AND d.is_active = 1
    WHERE g.is_active = 1
    GROUP BY g.repair_garment_id
    ORDER BY g.garment_name ASC
  `;
  db.query(sql, callback);
},

createDamageLevel: (damageLevelData, callback) => {
  const { garment_type_id, level_name, level_description, base_price, sort_order } = damageLevelData;
  const sql = `
    INSERT INTO repair_damage_levels (garment_type_id, level_name, level_description, base_price, sort_order)
    VALUES (?, ?, ?, ?, ?)
  `;
  db.query(sql, [garment_type_id, level_name, level_description, base_price, sort_order || 0], callback);
},

updateDamageLevel: (damageLevelId, damageLevelData, callback) => {
  const { level_name, level_description, base_price, sort_order, is_active } = damageLevelData;
  const sql = `
    UPDATE repair_damage_levels 
    SET level_name = ?, level_description = ?, base_price = ?, sort_order = ?, is_active = ?
    WHERE damage_level_id = ?
  `;
  db.query(sql, [level_name, level_description, base_price, sort_order, is_active !== undefined ? is_active : 1, damageLevelId], callback);
},

deleteDamageLevel: (damageLevelId, callback) => {
  const sql = `UPDATE repair_damage_levels SET is_active = 0 WHERE damage_level_id = ?`;
  db.query(sql, [damageLevelId], callback);
}
```

#### Controller Updates
**RepairGarmentTypeController.js** - Add damage level endpoints:
```javascript
// New endpoints to add
exports.getGarmentWithDamageLevels = (req, res) => {
  RepairGarmentType.getWithDamageLevels((err, garments) => {
    if (err) {
      return res.status(500).json({
        success: false,
        message: 'Error fetching garment types with damage levels'
      });
    }
    
    // Parse JSON damage levels
    const processedGarments = garments.map(garment => ({
      ...garment,
      damage_levels: garment.damage_levels ? JSON.parse(garment.damage_levels) : []
    }));
    
    res.json({
      success: true,
      garments: processedGarments
    });
  });
};

exports.createDamageLevel = (req, res) => {
  // Implementation for creating damage levels
};

exports.updateDamageLevel = (req, res) => {
  // Implementation for updating damage levels
};

exports.deleteDamageLevel = (req, res) => {
  // Implementation for deleting damage levels
};
```

### 3. Admin Panel Enhancement

**File**: `repair.jsx`

#### New Damage Level Management UI
- Add damage level configuration section to garment type modal
- List existing damage levels for each garment type
- Add/edit/delete damage levels with pricing
- Drag-and-drop reordering for damage levels

#### Enhanced Garment Type Form
```javascript
// Add to existing repairGarmentTypeForm state
const [repairGarmentTypeForm, setRepairGarmentTypeForm] = useState({
  garment_name: '',
  description: '',
  is_active: 1,
  damage_levels: [
    { level_name: '', level_description: '', base_price: '', sort_order: 0 }
  ]
});

// Add damage level management functions
const addDamageLevel = () => {
  setRepairGarmentTypeForm(prev => ({
    ...prev,
    damage_levels: [...prev.damage_levels, { 
      level_name: '', 
      level_description: '', 
      base_price: '', 
      sort_order: prev.damage_levels.length 
    }]
  }));
};

const updateDamageLevel = (index, field, value) => {
  setRepairGarmentTypeForm(prev => ({
    ...prev,
    damage_levels: prev.damage_levels.map((level, i) => 
      i === index ? { ...level, [field]: value } : level
    )
  }));
};

const removeDamageLevel = (index) => {
  setRepairGarmentTypeForm(prev => ({
    ...prev,
    damage_levels: prev.damage_levels.filter((_, i) => i !== index)
  }));
};
```

### 4. Frontend Form Enhancement

#### Web Implementation - RepairFormModal.jsx
```javascript
// Replace static damage levels with dynamic ones
const [garmentDamageLevels, setGarmentDamageLevels] = useState({});

// Load garment types with damage levels
const loadRepairGarmentTypes = async () => {
  try {
    const result = await getAllRepairGarmentTypesWithDamageLevels();
    if (result.success && result.garments) {
      setRepairGarmentTypes(result.garments);
      
      // Create damage levels lookup
      const damageLevelsLookup = {};
      result.garments.forEach(garment => {
        damageLevelsLookup[garment.repair_garment_id] = garment.damage_levels || [];
      });
      setGarmentDamageLevels(damageLevelsLookup);
    }
  } catch (err) {
    console.error("Load repair garment types error:", err);
  }
};

// Update garment structure
const updateGarment = (id, field, value) => {
  setGarments(garments.map(g => {
    if (g.id === id) {
      const updated = { ...g, [field]: value };
      
      // Reset damage level when garment type changes
      if (field === 'garmentType') {
        updated.damageLevel = '';
      }
      
      return updated;
    }
    return g;
  }));
};

// Enhanced price calculation
const calculateEstimatedPrice = async () => {
  setPriceLoading(true);
  
  try {
    let totalPrice = 0;
    
    garments.forEach(garment => {
      if (garment.garmentType && garment.damageLevel) {
        const garmentTypeId = parseInt(garment.garmentType);
        const damageLevels = garmentDamageLevels[garmentTypeId] || [];
        const selectedDamageLevel = damageLevels.find(level => 
          level.damage_level_id.toString() === garment.damageLevel
        );
        
        if (selectedDamageLevel) {
          totalPrice += parseFloat(selectedDamageLevel.base_price);
        }
      }
    });
    
    setEstimatedPrice(totalPrice);
  } catch (error) {
    console.error('Price calculation error:', error);
  } finally {
    setPriceLoading(false);
  }
};

// Updated form rendering
const renderGarmentFields = (garment, index) => {
  const selectedGarmentTypeId = parseInt(garment.garmentType);
  const availableDamageLevels = garmentDamageLevels[selectedGarmentTypeId] || [];
  
  return (
    <div key={garment.id} className="garment-item">
      {/* Garment Type Selection */}
      <select
        value={garment.garmentType}
        onChange={(e) => updateGarment(garment.id, 'garmentType', e.target.value)}
        className="form-control"
      >
        <option value="">Select Garment Type *</option>
        {repairGarmentTypes.map(type => (
          <option key={type.repair_garment_id} value={type.repair_garment_id}>
            {type.garment_name}
          </option>
        ))}
      </select>
      
      {/* Dynamic Damage Level Selection */}
      {garment.garmentType && (
        <select
          value={garment.damageLevel}
          onChange={(e) => updateGarment(garment.id, 'damageLevel', e.target.value)}
          className="form-control"
        >
          <option value="">Select Damage Level *</option>
          {availableDamageLevels.map(level => (
            <option key={level.damage_level_id} value={level.damage_level_id}>
              {level.level_name} - ₱{parseFloat(level.base_price).toLocaleString()}
            </option>
          ))}
        </select>
      )}
      
      {/* Damage Level Description */}
      {garment.damageLevel && availableDamageLevels.find(level => 
        level.damage_level_id.toString() === garment.damageLevel
      ) && (
        <div className="damage-level-description">
          {
            availableDamageLevels.find(level => 
              level.damage_level_id.toString() === garment.damageLevel
            )?.level_description
          }
        </div>
      )}
      
      {/* Notes field */}
      <textarea
        value={garment.notes}
        onChange={(e) => updateGarment(garment.id, 'notes', e.target.value)}
        placeholder="Additional notes (optional)"
        className="form-control"
        rows="2"
      />
    </div>
  );
};
```

#### React Native Implementation - RepairClothes.tsx
```typescript
// Similar updates for React Native
interface RepairGarmentItem {
  id: number;
  garmentType: string;
  damageLevel: string;
  notes: string;
}

interface DamageLevel {
  damage_level_id: number;
  level_name: string;
  level_description: string;
  base_price: number;
  sort_order: number;
}

interface GarmentType {
  repair_garment_id: number;
  garment_name: string;
  damage_levels: DamageLevel[];
}

// State updates
const [garmentTypesWithDamageLevels, setGarmentTypesWithDamageLevels] = useState<GarmentType[]>([]);

// Load function updates
const loadRepairGarmentTypes = async () => {
  setLoadingGarments(true);
  try {
    const response = await fetch(`${API_BASE_URL}/repair-garment-types/with-damage-levels`);
    const data = await response.json();
    
    if (data.success) {
      setGarmentTypesWithDamageLevels(data.garments);
    }
  } catch (error) {
    console.error('Error loading garment types:', error);
  } finally {
    setLoadingGarments(false);
  }
};

// Price calculation updates
const calculateTotalPrice = (): number => {
  return garments.reduce((total, garment) => {
    if (!garment.garmentType || !garment.damageLevel) return total;
    
    const garmentType = garmentTypesWithDamageLevels.find(
      type => type.repair_garment_id.toString() === garment.garmentType
    );
    
    if (!garmentType) return total;
    
    const damageLevel = garmentType.damage_levels.find(
      level => level.damage_level_id.toString() === garment.damageLevel
    );
    
    return total + (damageLevel ? damageLevel.base_price : 0);
  }, 0);
};
```

### 5. Form Field Reordering

**Current Order**: Damage Level → Garment Type → Notes
**New Order**: Garment Type → Damage Level → Notes

This ensures users select the garment type first, which then dynamically populates the appropriate damage levels.

### 6. Admin Workflow Enhancement

#### Adding New Garment Type with Damage Levels
1. Admin adds garment type (e.g., "T-Shirt")
2. Admin adds damage levels for that garment:
   - "Pristine Condition" - ₱100
   - "Surface Imperfection Only" - ₱200
   - "Minor Localized Damage" - ₱350
   - "Visible Wear Damage" - ₱500

#### Example Damage Level Configurations
```
T-Shirt:
- Pristine Condition (₱100) - Like new condition
- Surface Imperfection Only (₱200) - Minor stains, small pulls
- Minor Localized Damage (₱350) - Small tears, button replacement
- Visible Wear Damage (₱500) - Multiple issues, significant repair

Suit:
- Pristine Condition (₱200) - Like new condition
- Surface Imperfection Only (₱350) - Minor pressing needed
- Minor Localized Damage (₱500) - Seam repair, lining issues
- Visible Wear Damage (₱800) - Multiple alterations needed

Dress:
- Pristine Condition (₱150) - Like new condition
- Surface Imperfection Only (₱300) - Minor hem adjustment
- Minor Localized Damage (₱450) - Zipper replacement, tear repair
- Visible Wear Damage (₱700) - Extensive alterations needed
```

### 7. Data Migration Strategy

```sql
-- Create default damage levels for existing garment types
INSERT INTO repair_damage_levels (garment_type_id, level_name, level_description, base_price, sort_order)
SELECT 
  repair_garment_id,
  'Minor',
  'Small tears, loose threads, missing buttons',
  300,
  0
FROM repair_garment_types WHERE is_active = 1;

INSERT INTO repair_damage_levels (garment_type_id, level_name, level_description, base_price, sort_order)
SELECT 
  repair_garment_id,
  'Moderate',
  'Broken zippers, medium tears, seam repairs',
  500,
  1
FROM repair_garment_types WHERE is_active = 1;

-- Add more default levels as needed
```

### 8. Testing Requirements

#### Unit Tests
- Damage level CRUD operations
- Price calculation accuracy
- Form validation with dynamic damage levels

#### Integration Tests
- End-to-end garment type → damage level selection flow
- Admin panel damage level management
- Cart integration with dynamic pricing

#### Edge Cases
- Garment types with no damage levels
- Empty damage level lists
- Invalid damage level IDs
- Price calculation with mixed garment types

### 9. Implementation Priority

1. **Phase 1**: Database schema and backend API
2. **Phase 2**: Admin panel damage level management
3. **Phase 3**: Web form enhancement (RepairFormModal.jsx)
4. **Phase 4**: React Native form enhancement (RepairClothes.tsx)
5. **Phase 5**: Data migration and testing

### 10. Success Metrics

- Each garment type has custom damage levels
- Pricing accurately reflects damage level selections
- Admin can easily manage damage levels per garment type
- Form flow is intuitive (garment → damage level → price)
- Cross-platform consistency maintained

## Files to Modify

### Backend
- `backend/model/RepairGarmentTypeModel.js`
- `backend/controller/RepairGarmentTypeController.js`
- `backend/routes/RepairGarmentTypeRoutes.js`

### Frontend Web
- `tailoring-management-user/src/user/components/RepairFormModal.jsx`
- `tailoring-management-user/src/admin/repair.jsx`
- `tailoring-management-user/src/api/RepairGarmentTypeApi.js`

### Frontend React Native
- `react-native/my-tailoring-app/app/(tabs)/appointment/RepairClothes.tsx`
- `react-native/my-tailoring-app/utils/repairService.ts`

### Database
- New migration script for damage levels table
- Data migration for existing garment types

This implementation provides a flexible, scalable system where each garment type can have its own specific damage levels and pricing, making the repair service more accurate and tailored to different garment types.
