import { useEffect, useState } from 'react';
import styles from './CustomizationPanel.module.css';
import { API_BASE_URL } from '../../api/config';

export default function CustomizationPanel({ garment, setGarment, size, setSize, fit, setFit, modelSize, setModelSize, colors, setColors, fabric, setFabric, patterns, pattern, setPattern, fabrics, designImage, setDesignImage, notes, setNotes, buttons, setButtons, accessories, setAccessories, pantsType, setPantsType, style, setStyle, onReview, customModels = [], measurements, setMeasurements, userMeasurements, setUserMeasurements, provideOwnMeasurements, setProvideOwnMeasurements, garmentTypes = [] }) {
  const [selectedButtonModel, setSelectedButtonModel] = useState('/orange button 3d model.glb');
  const [selectedAccessoryModel, setSelectedAccessoryModel] = useState('/accessories/gold lion pendant 3d model.glb');
  const [selectedButtonId, setSelectedButtonId] = useState(null);
  const [selectedAccessoryId, setSelectedAccessoryId] = useState(null);

  const [expandedSections, setExpandedSections] = useState({
    garmentType: true,
    colors: true,
    fabric: true,
    buttons: false,
    accessories: false,
    position: true,
    details: false,
    measurements: true,
    sizeDetails: false,
    userMeasurements: true
  });

  const availableButtonModels = [
    { name: 'Orange Button', path: '/orange button 3d model.glb' },
    { name: 'Four Hole Button', path: '/four hole button 3d model (1).glb' },
  ];

  const availableAccessoryModels = [
    { name: 'Pendant', path: '/accessories/gold lion pendant 3d model.glb' },
    { name: 'Brooch', path: '/accessories/flower brooch 3d model.glb' },
    { name: 'Flower', path: '/accessories/fabric rose 3d model.glb' },
  ];

  const customGarmentModels = customModels.filter(m => m.is_active && m.model_type === 'garment');
  const customButtonModels = customModels.filter(m => m.is_active && m.model_type === 'button');
  const customAccessoryModels = customModels.filter(m => m.is_active && m.model_type === 'accessory');

  const defaultSizeCharts = {
    coat: {
      small: { chest: 36, waist: 30, shoulders: 16, sleeveLength: 24, neck: 14, backLength: 28 },
      medium: { chest: 40, waist: 34, shoulders: 18, sleeveLength: 25, neck: 15, backLength: 29 },
      large: { chest: 44, waist: 38, shoulders: 20, sleeveLength: 26, neck: 16, backLength: 30 }
    },
    pants: {
      small: { waist: 28, hips: 36, inseam: 28, outseam: 40, thigh: 22, cuff: 14 },
      medium: { waist: 32, hips: 40, inseam: 30, outseam: 42, thigh: 24, cuff: 15 },
      large: { waist: 36, hips: 44, inseam: 32, outseam: 44, thigh: 26, cuff: 16 }
    },
    barong: {
      small: { chest: 36, waist: 30, shoulders: 16, sleeveLength: 24, neck: 14, length: 28 },
      medium: { chest: 40, waist: 34, shoulders: 18, sleeveLength: 25, neck: 15, length: 29 },
      large: { chest: 44, waist: 38, shoulders: 20, sleeveLength: 26, neck: 16, length: 30 }
    },
    suit: {
      small: { chest: 36, waist: 30, hips: 36, shoulders: 16, sleeveLength: 24, neck: 14, inseam: 28, outseam: 40 },
      medium: { chest: 40, waist: 34, hips: 40, shoulders: 18, sleeveLength: 25, neck: 15, inseam: 30, outseam: 42 },
      large: { chest: 44, waist: 38, hips: 44, shoulders: 20, sleeveLength: 26, neck: 16, inseam: 32, outseam: 44 }
    }
  };

  const getMatchingGarmentType = () => {
    if (!garmentTypes || garmentTypes.length === 0) return null;
    let garmentCode = garment;
    if (garment.startsWith('custom-')) {
      const modelId = garment.replace('custom-', '');
      const model = customGarmentModels.find(m => String(m.model_id) === modelId);
      if (model?.garment_category) garmentCode = model.garment_category;
    } else if (garment === 'pants') {
      garmentCode = pantsType || garment;
    }

    return garmentTypes.find(gt => {
      const code = (gt.garment_code || '').toLowerCase();
      const source = (garmentCode || '').toLowerCase();
      if (!code || !source) return false;
      return code === source || source.startsWith(code) || code.startsWith(source.split('-')[0]);
    }) || null;
  };

  const matchedGarmentType = getMatchingGarmentType();
  const selectedCustomGarmentModel = garment.startsWith('custom-')
    ? customGarmentModels.find((m) => String(m.model_id) === garment.replace('custom-', ''))
    : null;

  const normalizeSizeKey = (value) => String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, '-')
    .replace(/-+/g, '-');

  const normalizeMeasurementFields = (value) => {
    if (!value) return [];
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return normalizeMeasurementFields(parsed);
      } catch (e) {
        return [];
      }
    }
    if (Array.isArray(value)) return value;
    if (typeof value === 'object') {
      return Object.entries(value).map(([field, config]) => ({
        field,
        label: config?.label || field.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        unit: config?.unit || 'inches'
      }));
    }
    return [];
  };

  const normalizeSizeChart = (value) => {
    if (!value) return null;
    if (typeof value === 'string') {
      try {
        const parsed = JSON.parse(value);
        return parsed && typeof parsed === 'object' ? parsed : null;
      } catch (e) {
        return null;
      }
    }
    return typeof value === 'object' ? value : null;
  };

  const activeMeasurementFields = selectedCustomGarmentModel?.measurement_fields ?? matchedGarmentType?.measurement_fields;
  const activeSizeChart = normalizeSizeChart(selectedCustomGarmentModel?.size_chart) || normalizeSizeChart(matchedGarmentType?.size_chart);

  const getAvailableSizes = () => {
    const chart = activeSizeChart;
    if (chart && typeof chart === 'object') {
      const keys = Object.keys(chart).filter(Boolean);
      if (keys.length > 0) return keys;
    }
    return ['small', 'medium', 'large'];
  };

  const resolveSizeKey = (targetSize, availableSizeKeys) => {
    const normalizedTarget = normalizeSizeKey(targetSize);
    return availableSizeKeys.find((key) => normalizeSizeKey(key) === normalizedTarget) || null;
  };

  const availableSizes = getAvailableSizes();
  const selectedSizeKey = resolveSizeKey(size, availableSizes) || availableSizes[0] || size;

  useEffect(() => {
    if (availableSizes.length > 0 && size !== selectedSizeKey) {
      setSize(selectedSizeKey);
    }
  }, [availableSizes.join('|'), selectedSizeKey, setSize, size]);

  const getSizeLabel = (sizeKey) => {
    if (!sizeKey) return 'Size';
    return sizeKey
      .replace(/_/g, '-')
      .split('-')
      .map(part => part.charAt(0).toUpperCase() + part.slice(1))
      .join(' ');
  };

  const getActiveSizeValues = () => {
    const chart = activeSizeChart;
    if (!chart || typeof chart !== 'object') return null;

    const targetKey = normalizeSizeKey(selectedSizeKey);
    const matchedKey = Object.keys(chart).find((key) => normalizeSizeKey(key) === targetKey);
    if (!matchedKey) return null;

    return chart[matchedKey] && typeof chart[matchedKey] === 'object' ? chart[matchedKey] : null;
  };

  const getSizeMeasurement = (field) => {
    const activeSizeValues = getActiveSizeValues();
    if (activeSizeValues && activeSizeValues[field] !== undefined) {
      const val = activeSizeValues[field];
      return (val !== '' && val !== null) ? val : '--';
    }

    const sizeCharts = {
      coat: {
        small: { chest: 36, waist: 30, shoulders: 16, sleeveLength: 24, neck: 14, backLength: 28 },
        medium: { chest: 40, waist: 34, shoulders: 18, sleeveLength: 25, neck: 15, backLength: 29 },
        large: { chest: 44, waist: 38, shoulders: 20, sleeveLength: 26, neck: 16, backLength: 30 }
      },
      pants: {
        small: { waist: 28, hips: 36, inseam: 28, outseam: 40, thigh: 22, cuff: 14 },
        medium: { waist: 32, hips: 40, inseam: 30, outseam: 42, thigh: 24, cuff: 15 },
        large: { waist: 36, hips: 44, inseam: 32, outseam: 44, thigh: 26, cuff: 16 }
      },
      barong: {
        small: { chest: 36, waist: 30, shoulders: 16, sleeveLength: 24, neck: 14, length: 28 },
        medium: { chest: 40, waist: 34, shoulders: 18, sleeveLength: 25, neck: 15, length: 29 },
        large: { chest: 44, waist: 38, shoulders: 20, sleeveLength: 26, neck: 16, length: 30 }
      },
      suit: {
        small: { chest: 36, waist: 30, hips: 36, shoulders: 16, sleeveLength: 24, neck: 14, inseam: 28, outseam: 40 },
        medium: { chest: 40, waist: 34, hips: 40, shoulders: 18, sleeveLength: 25, neck: 15, inseam: 30, outseam: 42 },
        large: { chest: 44, waist: 38, hips: 44, shoulders: 20, sleeveLength: 26, neck: 16, inseam: 32, outseam: 44 }
      }
    };

    let chartType = 'coat'; // default
    if (garment === 'pants' || isPantsType) chartType = 'pants';
    else if (garment === 'barong' || isBarongType) chartType = 'barong';
    else if (garment.startsWith('suit') || isSuitType) chartType = 'suit';

    return sizeCharts[chartType]?.[size]?.[field] || '--';
  };

  const updateMeasurement = (field, value) => {
    if (setMeasurements) {
      setMeasurements(prev => ({
        ...prev,
        [field]: parseFloat(value) || 0
      }));
    }
  };

  const updateUserMeasurement = (field, value) => {
    if (setUserMeasurements) {
      setUserMeasurements(prev => ({
        ...prev,
        [field]: value === '' ? '' : (parseFloat(value) || 0)
      }));
    }
  };

  const getGarmentMeasurements = () => {
    const dynamicFields = normalizeMeasurementFields(activeMeasurementFields);
    if (dynamicFields.length > 0) {
      return dynamicFields;
    }

    const sizeChart = activeSizeChart;
    if (sizeChart && typeof sizeChart === 'object') {
      const firstSize = Object.keys(sizeChart)[0];
      const firstSizeValues = firstSize ? sizeChart[firstSize] : null;
      if (firstSizeValues && typeof firstSizeValues === 'object') {
        const derivedFields = Object.keys(firstSizeValues).map((field) => ({
          field,
          label: field.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
          unit: 'inches'
        }));
        if (derivedFields.length > 0) {
          return derivedFields;
        }
      }
    }
    if (garment.startsWith('coat') || isCoatType) {
      return [
        { field: 'chest', label: 'Chest', unit: 'inches' },
        { field: 'waist', label: 'Waist', unit: 'inches' },
        { field: 'shoulders', label: 'Shoulders', unit: 'inches' },
        { field: 'sleeveLength', label: 'Sleeve Length', unit: 'inches' },
        { field: 'neck', label: 'Neck', unit: 'inches' },
        { field: 'backLength', label: 'Back Length', unit: 'inches' }
      ];
    } else if (garment === 'pants' || isPantsType) {
      return [
        { field: 'waist', label: 'Waist', unit: 'inches' },
        { field: 'hips', label: 'Hips', unit: 'inches' },
        { field: 'inseam', label: 'Inseam', unit: 'inches' },
        { field: 'outseam', label: 'Outseam', unit: 'inches' },
        { field: 'thigh', label: 'Thigh', unit: 'inches' },
        { field: 'cuff', label: 'Cuff/Bottom', unit: 'inches' }
      ];
    } else if (garment === 'barong' || isBarongType) {
      return [
        { field: 'chest', label: 'Chest', unit: 'inches' },
        { field: 'waist', label: 'Waist', unit: 'inches' },
        { field: 'shoulders', label: 'Shoulders', unit: 'inches' },
        { field: 'sleeveLength', label: 'Sleeve Length', unit: 'inches' },
        { field: 'neck', label: 'Neck', unit: 'inches' },
        { field: 'length', label: 'Length', unit: 'inches' }
      ];
    } else if (garment.startsWith('suit') || isSuitType) {
      return [
        { field: 'chest', label: 'Chest', unit: 'inches' },
        { field: 'waist', label: 'Waist', unit: 'inches' },
        { field: 'hips', label: 'Hips', unit: 'inches' },
        { field: 'shoulders', label: 'Shoulders', unit: 'inches' },
        { field: 'sleeveLength', label: 'Sleeve Length', unit: 'inches' },
        { field: 'neck', label: 'Neck', unit: 'inches' },
        { field: 'inseam', label: 'Inseam (Pants)', unit: 'inches' },
        { field: 'outseam', label: 'Outseam (Pants)', unit: 'inches' }
      ];
    }
    
    // Fallback measurements for any garment type
    return [
      { field: 'chest', label: 'Chest', unit: 'inches' },
      { field: 'waist', label: 'Waist', unit: 'inches' },
      { field: 'shoulders', label: 'Shoulders', unit: 'inches' },
      { field: 'sleeveLength', label: 'Sleeve Length', unit: 'inches' }
    ];
  };

  const addButton = () => {
    const newButton = {
      id: Date.now(),
      modelPath: selectedButtonModel,
      position: [0, 1.2, 0.5],
      color: colors.button,
      scale: 0.15,
    };
    setButtons([...buttons, newButton]);
  };

  const deleteButton = (id) => {
    setButtons(buttons.filter(btn => btn.id !== id));
  };

  const updateButtonColor = (id, color) => {
    setButtons(buttons.map(btn => btn.id === id ? { ...btn, color } : btn));
  };

  const updateButtonScale = (id, scale) => {
    setButtons(buttons.map(btn => btn.id === id ? { ...btn, scale } : btn));
  };

  const addAccessory = () => {
    const newAccessory = {
      id: Date.now(),
      modelPath: selectedAccessoryModel,
      position: [0, 1.3, 0.5],
      color: colors.fabric,
      scale: 0.2,
    };
    setAccessories([...accessories, newAccessory]);
  };

  const deleteAccessory = (id) => {
    setAccessories(accessories.filter(acc => acc.id !== id));
  };

  const updateAccessoryColor = (id, color) => {
    setAccessories(accessories.map(acc => acc.id === id ? { ...acc, color } : acc));
  };

  const updateAccessoryScale = (id, scale) => {
    setAccessories(accessories.map(acc => acc.id === id ? { ...acc, scale } : acc));
  };

  const moveStep = 0.05;

  const moveSelectedItem = (axis, direction) => {
    const delta = direction * moveStep;

    if (selectedButtonId) {
      setButtons(buttons.map(btn => {
        if (btn.id === selectedButtonId) {
          const newPosition = [...btn.position];
          if (axis === 'x') newPosition[0] += delta;
          if (axis === 'y') newPosition[1] += delta;
          if (axis === 'z') newPosition[2] += delta;
          return { ...btn, position: newPosition };
        }
        return btn;
      }));
    }

    if (selectedAccessoryId) {
      setAccessories(accessories.map(acc => {
        if (acc.id === selectedAccessoryId) {
          const newPosition = [...acc.position];
          if (axis === 'x') newPosition[0] += delta;
          if (axis === 'y') newPosition[1] += delta;
          if (axis === 'z') newPosition[2] += delta;
          return { ...acc, position: newPosition };
        }
        return acc;
      }));
    }
  };

  const getSelectedItemName = () => {
    if (selectedButtonId) {
      const btn = buttons.find(b => b.id === selectedButtonId);
      if (btn) {
        const index = buttons.indexOf(btn);
        return `Button ${index + 1}`;
      }
    }
    if (selectedAccessoryId) {
      const acc = accessories.find(a => a.id === selectedAccessoryId);
      if (acc) {
        const index = accessories.indexOf(acc);
        return `Accessory ${index + 1}`;
      }
    }
    return null;
  };

  const toggleSection = (section) => {
    setExpandedSections(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const presetColors = [
    { name: 'Classic Black', value: '#1a1a1a' },
    { name: 'Navy Blue', value: '#1e3a5f' },
    { name: 'Burgundy', value: '#6b1e3d' },
    { name: 'Forest Green', value: '#2d5a3d' },
    { name: 'Charcoal Gray', value: '#4a4a4a' },
    { name: 'Camel Tan', value: '#c9a66b' },
    { name: 'Cream White', value: '#f5e6d3' },
    { name: 'Chocolate Brown', value: '#5D4037' },
    { name: 'Royal Blue', value: '#2a4d8f' },
    { name: 'Wine Red', value: '#722F37' },
  ];
  const isCustomModelWithCategory = (categoryPrefix) => {
    if (!garment.startsWith('custom-')) return false;
    const modelId = garment.replace('custom-', '');
    const model = customGarmentModels.find(m => String(m.model_id) === modelId);
    return model && model.garment_category && model.garment_category.startsWith(categoryPrefix);
  };

  const isCoatType = garment.startsWith('coat-') || isCustomModelWithCategory('coat');

  const isSuitType = (garment === 'suit-1' || garment === 'suit-2') || isCustomModelWithCategory('suit');

  const isBarongType = garment === 'barong' || isCustomModelWithCategory('barong');

  const isPantsType = garment === 'pants' || isCustomModelWithCategory('pants');

  const builtInGarmentPrefixes = ['coat-', 'suit-', 'barong', 'pants'];
  const activeGarmentCategoryCode = (() => {
    if (garment.startsWith('custom-')) {
      const modelId = garment.replace('custom-', '');
      const model = customGarmentModels.find(m => String(m.model_id) === modelId);
      return (model?.garment_category || '').toLowerCase();
    }
    return (garment || '').toLowerCase();
  })();
  const isDynamicGarmentType = Boolean(
    activeGarmentCategoryCode &&
    !builtInGarmentPrefixes.some(prefix => activeGarmentCategoryCode === prefix || activeGarmentCategoryCode.startsWith(prefix))
  );
  const dynamicGarmentLabel = matchedGarmentType?.garment_name || activeGarmentCategoryCode;
  const normalizeOptionLabel = (value) => String(value || '').trim().toLowerCase();
  const dynamicCustomModelOptions = customGarmentModels.filter((model, index, self) => {
    const category = (model.garment_category || '').toLowerCase();
    if (category !== activeGarmentCategoryCode) return false;
    return index === self.findIndex((m) => m.model_name.toLowerCase() === model.model_name.toLowerCase());
  }).filter((model) => normalizeOptionLabel(model.model_name) !== normalizeOptionLabel(dynamicGarmentLabel));

  return (
    <div className="group">
      {(garment.startsWith('coat-') || isCoatType) && (
        <>
          <h3 onClick={() => toggleSection('garmentType')} className={styles.collapsibleHeader}>
            <span>Coat Type</span>
            <span className={styles.toggleIcon}>{expandedSections.garmentType ? '−' : '+'}</span>
          </h3>
          {expandedSections.garmentType && (
            <div className={styles.sectionContent}>
              <div className="row">
                <label>Select Type
                  <select value={garment} onChange={e => setGarment(e.target.value)}>
                    <option value="coat-men">Blazer (Men)</option>
                    <option value="coat-men-plain">Blazer Coat (Men) Plain</option>
                    <option value="coat-women">Blazer (Women)</option>
                    <option value="coat-women-plain">Blazer Coat (Women) Plain</option>
                    <option value="coat-teal">Teal Long Coat</option>
                    {customGarmentModels
                      .filter((model, index, self) => {

                        const isUnique = index === self.findIndex(m =>
                          m.model_name.toLowerCase() === model.model_name.toLowerCase()
                        );
                        if (!isUnique) return false;

                        const category = model.garment_category || '';
                        return category === 'coat-men' ||
                               category === 'coat-women' ||
                               (category.startsWith('coat-') && category.length > 5);
                      })
                      .map(model => {

                        const value = `custom-${model.model_id}`;
                        console.log('Adding custom model to coat dropdown:', model.model_name, 'with value:', value);
                        return (
                          <option key={model.model_id} value={value}>
                            {model.model_name}
                          </option>
                        );
                      })}
                  </select>
                </label>
              </div>
              <div className="row">
                <label className={styles.sizeLabel}>Size
                  <div className={styles.sizeFieldRow}>
                    <select value={selectedSizeKey} onChange={e => setSize(e.target.value)}>
                      {availableSizes.map(s => (
                        <option key={s} value={s}>{getSizeLabel(s)}</option>
                      ))}
                    </select>
                  </div>
                </label>
              </div>
              <h3 onClick={() => toggleSection('sizeDetails')} className={styles.collapsibleHeader}>
                <span>{getSizeLabel(selectedSizeKey)} Size Details</span>
                <span className={styles.toggleIcon}>{expandedSections.sizeDetails ? '−' : '+'}</span>
              </h3>
              {expandedSections.sizeDetails && (
                <div className={styles.sectionContent} style={{ marginTop: '0', paddingTop: '0' }}>
                  <div className={styles.measurementDetails}>
                    {getGarmentMeasurements().map((measurement) => (
                      <div key={measurement.field} className={styles.measurementDetail}>
                        <span className={styles.measurementName}>{measurement.label}:</span>
                        <span className={styles.measurementValue}>
                          {getSizeMeasurement(measurement.field)} {measurement.unit}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="row">
                <label>Fit
                  <select value={fit} onChange={e => setFit(e.target.value)}>
                    <option value="regular">Regular</option>
                    <option value="loose">Loose</option>
                    <option value="fitted">Fitted</option>
                  </select>
                </label>
              </div>
            </div>
          )}
        </>
      )}

      {(garment === 'suit-1' || garment === 'suit-2' || isSuitType) && (
        <>
          <h3 onClick={() => toggleSection('garmentType')} className={styles.collapsibleHeader}>
            <span>Suit Type</span>
            <span className={styles.toggleIcon}>{expandedSections.garmentType ? '−' : '+'}</span>
          </h3>
          {expandedSections.garmentType && (
            <div className={styles.sectionContent}>
              <div className="row">
                <label>Select Type
                  <select value={garment} onChange={e => setGarment(e.target.value)}>
                    <option value="suit-1">Business Suit Style 1</option>
                    <option value="suit-2">Business Suit Style 2</option>
                    {customGarmentModels
                      .filter((model, index, self) => {

                        const isUnique = index === self.findIndex(m =>
                          m.model_name.toLowerCase() === model.model_name.toLowerCase()
                        );
                        if (!isUnique) return false;

                        const category = model.garment_category || '';
                        return category === 'suit-1' || category === 'suit-2';
                      })
                      .map(model => {

                        const value = `custom-${model.model_id}`;
                        return (
                          <option key={model.model_id} value={value}>
                            {model.model_name}
                          </option>
                        );
                      })}
                  </select>
                </label>
              </div>
              <div className="row">
                <label className={styles.sizeLabel}>Size
                  <div className={styles.sizeFieldRow}>
                    <select value={selectedSizeKey} onChange={e => setSize(e.target.value)}>
                      {availableSizes.map(s => (
                        <option key={s} value={s}>{getSizeLabel(s)}</option>
                      ))}
                    </select>
                  </div>
                </label>
              </div>
              <h3 onClick={() => toggleSection('sizeDetails')} className={styles.collapsibleHeader}>
                <span>{getSizeLabel(selectedSizeKey)} Size Details</span>
                <span className={styles.toggleIcon}>{expandedSections.sizeDetails ? '−' : '+'}</span>
              </h3>
              {expandedSections.sizeDetails && (
                <div className={styles.sectionContent} style={{ marginTop: '0', paddingTop: '0' }}>
                  <div className={styles.measurementDetails}>
                    {getGarmentMeasurements().map((measurement) => (
                      <div key={measurement.field} className={styles.measurementDetail}>
                        <span className={styles.measurementName}>{measurement.label}:</span>
                        <span className={styles.measurementValue}>
                          {getSizeMeasurement(measurement.field)} {measurement.unit}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="row">
                <label>Fit
                  <select value={fit} onChange={e => setFit(e.target.value)}>
                    <option value="regular">Regular</option>
                    <option value="loose">Loose</option>
                    <option value="fitted">Fitted</option>
                  </select>
                </label>
              </div>
            </div>
          )}
        </>
      )}

      {garment === 'barong' && (
        <>
          <h3 onClick={() => toggleSection('garmentType')} className={styles.collapsibleHeader}>
            <span>Barong Settings</span>
            <span className={styles.toggleIcon}>{expandedSections.garmentType ? '−' : '+'}</span>
          </h3>
          {expandedSections.garmentType && (
            <div className={styles.sectionContent}>
              <div className="row">
                <label>Select Type
                  <select value={garment} onChange={e => setGarment(e.target.value)}>
                    <option value="barong">Barong Tagalog (Default)</option>
                    {customGarmentModels
                      .filter((model, index, self) => {

                        const isUnique = index === self.findIndex(m =>
                          m.model_name.toLowerCase() === model.model_name.toLowerCase()
                        );
                        if (!isUnique) return false;

                        const category = model.garment_category || '';
                        return category === 'barong';
                      })
                      .map(model => {

                        const value = `custom-${model.model_id}`;
                        return (
                          <option key={model.model_id} value={value}>
                            {model.model_name}
                          </option>
                        );
                      })}
                  </select>
                </label>
              </div>
              <div className="row">
                <label className={styles.sizeLabel}>Size
                  <div className={styles.sizeFieldRow}>
                    <select value={selectedSizeKey} onChange={e => setSize(e.target.value)}>
                      {availableSizes.map(s => (
                        <option key={s} value={s}>{getSizeLabel(s)}</option>
                      ))}
                    </select>
                  </div>
                </label>
              </div>
              <h3 onClick={() => toggleSection('sizeDetails')} className={styles.collapsibleHeader}>
                <span>{getSizeLabel(selectedSizeKey)} Size Details</span>
                <span className={styles.toggleIcon}>{expandedSections.sizeDetails ? '−' : '+'}</span>
              </h3>
              {expandedSections.sizeDetails && (
                <div className={styles.sectionContent} style={{ marginTop: '0', paddingTop: '0' }}>
                  <div className={styles.measurementDetails}>
                    {getGarmentMeasurements().map((measurement) => (
                      <div key={measurement.field} className={styles.measurementDetail}>
                        <span className={styles.measurementName}>{measurement.label}:</span>
                        <span className={styles.measurementValue}>
                          {getSizeMeasurement(measurement.field)} {measurement.unit}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="row">
                <label>Fit
                  <select value={fit} onChange={e => setFit(e.target.value)}>
                    <option value="regular">Regular</option>
                    <option value="loose">Loose</option>
                    <option value="fitted">Fitted</option>
                  </select>
                </label>
              </div>
            </div>
          )}
        </>
      )}

      {(garment === 'pants' || isPantsType) && (
        <>
          <h3 onClick={() => toggleSection('garmentType')} className={styles.collapsibleHeader}>
            <span>Pants Type</span>
            <span className={styles.toggleIcon}>{expandedSections.garmentType ? '−' : '+'}</span>
          </h3>
          {expandedSections.garmentType && (
            <div className={styles.sectionContent}>
              <div className="row">
                <label>Select Type
                  <select value={pantsType} onChange={e => setPantsType(e.target.value)}>
                    <option value="casual-men">Pants (Men Casual)</option>
                    <option value="formal-men">Pants (Men Formal)</option>
                    <option value="formal-women">Pants (Women Formal)</option>
                    {customGarmentModels
                      .filter((model, index, self) => {

                        const isUnique = index === self.findIndex(m =>
                          m.model_name.toLowerCase() === model.model_name.toLowerCase()
                        );
                        if (!isUnique) return false;

                        const category = model.garment_category || '';
                        return category === 'pants';
                      })
                      .map(model => {

                        const value = `custom-${model.model_id}`;
                        return (
                          <option key={model.model_id} value={value}>
                            {model.model_name}
                          </option>
                        );
                      })}
                  </select>
                </label>
              </div>
              <div className="row">
                <label>Fit
                  <select value={fit} onChange={e => setFit(e.target.value)}>
                    <option value="regular">Regular</option>
                    <option value="loose">Loose</option>
                    <option value="fitted">Fitted</option>
                  </select>
                </label>
              </div>
            </div>
          )}
        </>
      )}

      {isDynamicGarmentType && (
        <>
          <h3 onClick={() => toggleSection('garmentType')} className={styles.collapsibleHeader}>
            <span>{dynamicGarmentLabel} Settings</span>
            <span className={styles.toggleIcon}>{expandedSections.garmentType ? '−' : '+'}</span>
          </h3>
          {expandedSections.garmentType && (
            <div className={styles.sectionContent}>
              <div className="row">
                <label>Select Type
                  <select
                    value={garment.startsWith('custom-') ? garment : activeGarmentCategoryCode}
                    onChange={(e) => setGarment(e.target.value)}
                  >
                    <option value={activeGarmentCategoryCode}>{dynamicGarmentLabel}</option>
                    {dynamicCustomModelOptions.map((model) => (
                      <option key={model.model_id} value={`custom-${model.model_id}`}>
                        {model.model_name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="row">
                <label className={styles.sizeLabel}>Size
                  <div className={styles.sizeFieldRow}>
                    <select value={selectedSizeKey} onChange={e => setSize(e.target.value)}>
                      {availableSizes.map(s => (
                        <option key={s} value={s}>{getSizeLabel(s)}</option>
                      ))}
                    </select>
                  </div>
                </label>
              </div>
              <h3 onClick={() => toggleSection('sizeDetails')} className={styles.collapsibleHeader}>
                <span>{getSizeLabel(selectedSizeKey)} Size Details</span>
                <span className={styles.toggleIcon}>{expandedSections.sizeDetails ? '−' : '+'}</span>
              </h3>
              {expandedSections.sizeDetails && (
                <div className={styles.sectionContent} style={{ marginTop: '0', paddingTop: '0' }}>
                  <div className={styles.measurementDetails}>
                    {getGarmentMeasurements().map((measurement) => (
                      <div key={measurement.field} className={styles.measurementDetail}>
                        <span className={styles.measurementName}>{measurement.label}:</span>
                        <span className={styles.measurementValue}>
                          {getSizeMeasurement(measurement.field)} {measurement.unit}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="row">
                <label>Fit
                  <select value={fit} onChange={e => setFit(e.target.value)}>
                    <option value="regular">Regular</option>
                    <option value="loose">Loose</option>
                    <option value="fitted">Fitted</option>
                  </select>
                </label>
              </div>
            </div>
          )}
        </>
      )}

      <h3 onClick={() => toggleSection('colors')} className={styles.collapsibleHeader}>
        <span>Colors</span>
        <span className={styles.toggleIcon}>{expandedSections.colors ? '−' : '+'}</span>
      </h3>
      {expandedSections.colors && (
        <div className={styles.sectionContent}>
          <div className="row">
            <label>Fabric color<input className="color-input" type="color" value={colors.fabric} onChange={e => setColors({ ...colors, fabric: e.target.value })} /></label>
          </div>
          <div className={styles.presetColorsContainer}>
            <label className={styles.presetColorsLabel}>Preset Fabric Colors</label>
            <div className={styles.presetColorsGrid}>
              {presetColors.map((color) => (
                <div key={color.value} className={styles.presetColorWrapper}>
                  <button
                    onClick={() => setColors({ ...colors, fabric: color.value })}
                    className={`${styles.presetColorButton} ${colors.fabric === color.value ? styles.selected : styles.unselected}`}
                    style={{
                      '--preset-color': color.value,
                      backgroundColor: color.value,
                      background: color.value
                    }}
                    title={color.name}
                  />
                  <span className={styles.presetColorName}>{color.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <h3 onClick={() => toggleSection('fabric')} className={styles.collapsibleHeader}>
        <span>Fabric & Pattern</span>
        <span className={styles.toggleIcon}>{expandedSections.fabric ? '−' : '+'}</span>
      </h3>
      {expandedSections.fabric && (
        <div className={styles.sectionContent}>
          <div className="row">
            <label>Fabric
              <select value={fabric} onChange={e => setFabric(e.target.value)}>
                {fabrics
                  .filter(f => {

                    if (f === 'jusi' || f === 'Piña') {
                      return garment === 'barong';
                    }

                    if (garment === 'barong') {
                      return f === 'jusi' || f === 'Piña';
                    }
                    return f !== 'jusi' && f !== 'Piña';
                  })
                  .map(f => <option key={f} value={f}>{f}</option>)
                }
              </select>
            </label>
            <label>Pattern
              <select value={pattern} onChange={e => setPattern(e.target.value)}>
                {patterns.map(p => (
                  <option key={p.pattern_code || p} value={p.pattern_code || p}>
                    {p.pattern_name || p}
                  </option>
                ))}
              </select>
            </label>
          </div>
          {garment === 'barong' && (
            <div className="row" style={{ marginTop: '16px' }}>
              <label style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                Transparency: {Math.round((style?.transparency || 0.35) * 100)}%
                <input
                  type="range"
                  min="0.15"
                  max="0.85"
                  step="0.05"
                  value={style?.transparency || 0.35}
                  onChange={e => {
                    const newTransparency = parseFloat(e.target.value);
                    if (setStyle) {
                      setStyle({ ...style, transparency: newTransparency });
                    }
                  }}
                  style={{ width: '100%' }}
                />
              </label>
            </div>
          )}
        </div>
      )}

      <h3 onClick={() => toggleSection('buttons')} className={styles.collapsibleHeader}>
        <span>3D Buttons {buttons.length > 0 && `(${buttons.length})`}</span>
        <span className={styles.toggleIcon}>{expandedSections.buttons ? '−' : '+'}</span>
      </h3>
      {expandedSections.buttons && (
        <div className={styles.sectionContent}>
          <div className={styles.accessoryRow}>
            <label>Button Model
              <select className={styles.modelTypeSelect} value={selectedButtonModel} onChange={e => setSelectedButtonModel(e.target.value)}>
                {availableButtonModels.map(model => (
                  <option key={model.path} value={model.path}>{model.name}</option>
                ))}
                {customButtonModels.map(model => (
                  <option key={model.model_id} value={model.file_url.startsWith('http') ? model.file_url : `${API_BASE_URL}${model.file_url}`}>
                    {model.model_name} (Custom)
                  </option>
                ))}
              </select>
            </label>
            <button onClick={addButton} className={styles.compactButton}>Add Button</button>
          </div>

          {buttons && buttons.length > 0 && (
            <div className={styles.itemsList}>
              <label className={styles.itemsLabel}>Current Buttons ({buttons.length})</label>
              {buttons.map((btn, index) => (
                <div key={btn.id} className={styles.itemCard}>
                  <div className={styles.itemCardHeader}>
                    <span className={styles.itemCardTitle}>Button {index + 1}</span>
                    <div className={styles.itemCardActions}>
                      <button
                        onClick={() => setSelectedButtonId(btn.id === selectedButtonId ? null : btn.id)}
                        className={`${styles.selectButton} ${selectedButtonId === btn.id ? styles.selected : styles.unselected}`}
                      >
                        {selectedButtonId === btn.id ? '✓ Selected' : 'Select'}
                      </button>
                      <button onClick={() => deleteButton(btn.id)} className={styles.deleteButton}>Delete</button>
                    </div>
                  </div>
                  <div className={styles.rangeContainer}>
                    <label className={styles.rangeLabel}>Size:</label>
                    <input
                      type="range"
                      min="0.05"
                      max="0.3"
                      step="0.01"
                      value={btn.scale || 0.15}
                      onChange={(e) => updateButtonScale(btn.id, parseFloat(e.target.value))}
                      className={styles.rangeSlider}
                    />
                    <span className={styles.rangeValue}>{((btn.scale || 0.15) * 100).toFixed(0)}%</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <h3 onClick={() => toggleSection('accessories')} className={styles.collapsibleHeader}>
        <span>Accessories {accessories.length > 0 && `(${accessories.length})`}</span>
        <span className={styles.toggleIcon}>{expandedSections.accessories ? '−' : '+'}</span>
      </h3>
      {expandedSections.accessories && (
        <div className={styles.sectionContent}>
          <div className={styles.accessoryRow}>
            <label>Accessory Type
              <select className={styles.modelTypeSelect} value={selectedAccessoryModel} onChange={e => setSelectedAccessoryModel(e.target.value)}>
                {availableAccessoryModels.map(model => (
                  <option key={model.path} value={model.path}>{model.name}</option>
                ))}
                {customAccessoryModels.map(model => {

                  const modelUrl = model.file_url.startsWith('http')
                    ? model.file_url
                    : model.file_url.startsWith('/')
                    ? `${API_BASE_URL}${model.file_url}`
                    : `${API_BASE_URL}/${model.file_url}`;
                  return (
                    <option key={model.model_id} value={modelUrl}>
                      {model.model_name} (Custom)
                    </option>
                  );
                })}
              </select>
            </label>
            <button onClick={addAccessory} className={styles.compactButton}>Add Accessory</button>
          </div>

          {accessories && accessories.length > 0 && (
            <div className={styles.itemsList}>
              <label className={styles.itemsLabel}>Current Accessories ({accessories.length})</label>
              {accessories.map((acc, index) => (
                <div key={acc.id} className={styles.itemCard}>
                  <div className={styles.itemCardHeader}>
                    <span className={styles.itemCardTitle}>Accessory {index + 1}</span>
                    <div className={styles.itemCardActions}>
                      <button
                        onClick={() => setSelectedAccessoryId(acc.id === selectedAccessoryId ? null : acc.id)}
                        className={`${styles.selectButton} ${selectedAccessoryId === acc.id ? styles.selected : styles.unselected}`}
                      >
                        {selectedAccessoryId === acc.id ? '✓ Selected' : 'Select'}
                      </button>
                      <button onClick={() => deleteAccessory(acc.id)} className={styles.deleteButton}>Delete</button>
                    </div>
                  </div>
                  <div className={styles.rangeContainer}>
                    <label className={styles.rangeLabel}>Size:</label>
                    <input
                      type="range"
                      min="0.1"
                      max="0.5"
                      step="0.01"
                      value={acc.scale || 0.2}
                      onChange={(e) => updateAccessoryScale(acc.id, parseFloat(e.target.value))}
                      className={styles.rangeSlider}
                    />
                    <span className={styles.rangeValue}>{((acc.scale || 0.2) * 100).toFixed(0)}%</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <h3 onClick={() => toggleSection('userMeasurements')} className={styles.collapsibleHeader}>
        <span>📏 My Body Measurements (Optional)</span>
        <span className={styles.toggleIcon}>{expandedSections.userMeasurements ? '−' : '+'}</span>
      </h3>
      {expandedSections.userMeasurements && (
        <div className={styles.sectionContent}>
          <div className={styles.measurementToggleContainer}>
            <label className={styles.measurementToggleLabel}>
              <input
                type="checkbox"
                checked={provideOwnMeasurements || false}
                onChange={(e) => {
                  if (setProvideOwnMeasurements) {
                    setProvideOwnMeasurements(e.target.checked);
                    if (!e.target.checked && setUserMeasurements) {
                      setUserMeasurements({});
                    }
                  }
                }}
                className={styles.measurementToggleCheckbox}
              />
              <span className={styles.measurementToggleText}>I want to input my own measurements</span>
            </label>
            <p className={styles.measurementToggleHint}>
              If you already know your body measurements, you can input them here. Otherwise, measurements will be taken at your appointment.
            </p>
          </div>

          {provideOwnMeasurements && (
            <div className={styles.userMeasurementsForm}>
              <div className={styles.measurementsGrid}>
                {getGarmentMeasurements().map((measurement) => (
                  <div key={measurement.field} className={styles.measurementField}>
                    <label className={styles.measurementLabel}>
                      <span>{measurement.label} ({measurement.unit})</span>
                      <input
                        type="number"
                        step="0.5"
                        min="0"
                        max="100"
                        value={userMeasurements?.[measurement.field] || ''}
                        onChange={(e) => updateUserMeasurement(measurement.field, e.target.value)}
                        placeholder={`Enter ${measurement.label.toLowerCase()}`}
                        className={styles.measurementInput}
                      />
                    </label>
                  </div>
                ))}
              </div>
              <div className={styles.measurementNote}>
                <small>💡 These measurements are optional and will be shown to the admin. The admin can update them if you choose to be re-measured at the store.</small>
              </div>
            </div>
          )}
        </div>
      )}

      {(selectedButtonId || selectedAccessoryId) && (
        <div className={styles.positionController}>
          <div className={styles.controllerTitle}>
            Controlling: {getSelectedItemName()}
          </div>

          <div className={styles.controllerSection}>
            <label className={styles.controllerSectionLabel}>Vertical (Up/Down)</label>
            <div className={styles.controllerButtons}>
              <button
                onClick={() => moveSelectedItem('y', 1)}
                className={`${styles.controlButton} ${styles.controlButtonVertical}`}
              >
                ↑ Up
              </button>
              <button
                onClick={() => moveSelectedItem('y', -1)}
                className={`${styles.controlButton} ${styles.controlButtonVertical}`}
              >
                ↓ Down
              </button>
            </div>
          </div>

          <div className={styles.controllerSection}>
            <label className={styles.controllerSectionLabel}>Horizontal (Left/Right)</label>
            <div className={styles.controllerButtons}>
              <button
                onClick={() => moveSelectedItem('x', -1)}
                className={`${styles.controlButton} ${styles.controlButtonHorizontal}`}
              >
                ← Left
              </button>
              <button
                onClick={() => moveSelectedItem('x', 1)}
                className={`${styles.controlButton} ${styles.controlButtonHorizontal}`}
              >
                → Right
              </button>
            </div>
          </div>

          <div className={styles.controllerSection}>
            <label className={styles.controllerSectionLabel}>Depth (Forward/Backward)</label>
            <div className={styles.controllerButtons}>
              <button
                onClick={() => moveSelectedItem('z', 1)}
                className={`${styles.controlButton} ${styles.controlButtonDepth}`}
              >
                ⬆ Forward
              </button>
              <button
                onClick={() => moveSelectedItem('z', -1)}
                className={`${styles.controlButton} ${styles.controlButtonDepth}`}
              >
                ⬇ Backward
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
