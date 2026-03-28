import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import Viewer3D from '../components/3d-customizer/Viewer3D';
import CustomizationPanel from '../components/3d-customizer/CustomizationPanel';
import { getAllCustom3DModels } from '../api/CustomizationApi';
import { getAllFabricTypes } from '../api/FabricTypeApi';
import { getAllPatterns } from '../api/PatternApi';
import '../styles/3d-App.css';
import './Customizer3DPage.css';

const isReactNativeWebView = () => {
  return typeof window !== 'undefined' && window.ReactNativeWebView !== undefined;
};

const sendToReactNative = (data) => {
  if (isReactNativeWebView()) {
    window.ReactNativeWebView.postMessage(JSON.stringify(data));
    return true;
  }
  return false;
};

const Customizer3DPage = () => {
  const navigate = useNavigate();
  const [customizationData, setCustomizationData] = useState(null);
  const [garment, setGarment] = useState('coat-men');
  const [size, setSize] = useState('medium');
  const [fit, setFit] = useState('regular');
  const [modelSize, setModelSize] = useState('full');
  const [colors, setColors] = useState({
    fabric: '#3a5a72',
    lining: '#1e2a35',
    button: '#c8a66a',
    stitching: '#e1d6c7',
  });
  const [fabric, setFabric] = useState('wool');
  const [pattern, setPattern] = useState('none');
  const [measurements, setMeasurements] = useState({
    chest: 38,
    waist: 32,
    hips: 38,
    shoulders: 18,
    sleeveLength: 25,
    inseam: 30,
  });
  const [personalization, setPersonalization] = useState({
    initials: '',
    font: 'Serif',
    size: 0.8,
  });
  const [designImage, setDesignImage] = useState(null);
  const [notes, setNotes] = useState('');
  const [buttons, setButtons] = useState([]);
  const [accessories, setAccessories] = useState([]);
  const [pantsType, setPantsType] = useState('casual-men');
  const [isRNWebView, setIsRNWebView] = useState(false);
  const [rnAuthData, setRnAuthData] = useState(null);
  const [customModels, setCustomModels] = useState([]);

  const defaultFabrics = ['silk', 'linen', 'cotton', 'wool', 'jusi', 'Piña'];
  const [fabrics, setFabrics] = useState(defaultFabrics);

  const defaultPatterns = [
    { pattern_code: 'none', pattern_name: 'None (Solid)', pattern_type: 'procedural', procedural_type: 'none' },
    { pattern_code: 'minimal-stripe', pattern_name: 'Minimal Stripe', pattern_type: 'procedural', procedural_type: 'minimal-stripe' },
    { pattern_code: 'minimal-check', pattern_name: 'Minimal Check', pattern_type: 'procedural', procedural_type: 'minimal-check' },
    { pattern_code: 'embroidery-1', pattern_name: 'Embroidery Style 1', pattern_type: 'procedural', procedural_type: 'embroidery-1' },
    { pattern_code: 'embroidery-2', pattern_name: 'Embroidery Style 2', pattern_type: 'procedural', procedural_type: 'embroidery-2' }
  ];
  const [patterns, setPatterns] = useState(defaultPatterns);

  const coatStyle = { lapel: 'notch', buttons: 2, pocket: 'flap', vents: 'single' };
  const barongStyle = { collar: 'classic', sleeves: 'long', transparency: 0.35, embroidery: 'preset-a' };
  const suitStyle = { lapel: 'peak', buttons: 2, pocket: 'jetted', vents: 'double' };
  const pantsStyle = { fit: 'regular', pleats: 'none', cuffs: 'none' };

  const [style, setStyle] = useState(coatStyle);

  useEffect(() => {

    const checkRNWebView = () => {
      if (isReactNativeWebView() || window.IS_REACT_NATIVE_WEBVIEW) {
        setIsRNWebView(true);
        if (window.REACT_NATIVE_AUTH) {
          setRnAuthData(window.REACT_NATIVE_AUTH);
        }
      }
    };

    checkRNWebView();

    const handleRNReady = (event) => {
      setIsRNWebView(true);
      setRnAuthData(event.detail);
      console.log('React Native WebView detected, auth:', event.detail);
    };

    document.addEventListener('reactNativeReady', handleRNReady);

    window.initReactNativeMode = (authData) => {
      setIsRNWebView(true);
      setRnAuthData(authData);
      console.log('React Native mode initialized with auth:', authData);
    };

    return () => {
      document.removeEventListener('reactNativeReady', handleRNReady);
    };
  }, []);

  useEffect(() => {

    const data = sessionStorage.getItem('customizationFormData');
    if (data) {
      try {
        const parsed = JSON.parse(data);
        setCustomizationData(parsed);
        console.log('Loaded customization data:', parsed);
      } catch (error) {
        console.error('Error parsing customization data:', error);
      }
    }

    const saved = localStorage.getItem('tailorDesign');
    if (saved) {
      try {
        const v = JSON.parse(saved);
        if (v) {
          setGarment(v.garment || 'coat-men');
          setSize(v.size || 'medium');
          setFit(v.fit || 'regular');
          setModelSize(v.modelSize || 'full');
          setColors(v.colors || { fabric: '#3a5a72', lining: '#1e2a35', button: '#c8a66a', stitching: '#e1d6c7' });
          setFabric(v.fabric || 'wool');
          setPattern(v.pattern || 'none');
          setMeasurements(v.measurements || { chest: 38, waist: 32, hips: 38, shoulders: 18, sleeveLength: 25, inseam: 30 });
          setPersonalization(v.personalization || { initials: '', font: 'Serif', size: 0.8 });
          setDesignImage(v.designImage || null);
          setNotes(v.notes || '');
          setButtons(v.buttons || []);
          setAccessories(v.accessories || []);
          setPantsType(v.pantsType || 'casual-men');
        }
      } catch (error) {
        console.error('Error loading saved design:', error);
      }
    }
  }, []);

  useEffect(() => {
    const s = garment.startsWith('coat') ? coatStyle : garment === 'barong' ? barongStyle : garment.startsWith('suit') ? suitStyle : pantsStyle;
    setStyle(s);
  }, [garment]);

  useEffect(() => {
    const loadCustomModels = async () => {
      try {
        const result = await getAllCustom3DModels();
        console.log('Custom 3D models loaded:', result);
        if (result.success && result.models) {
          console.log('Setting custom models:', result.models);
          setCustomModels(result.models);
        } else {
          console.warn('No custom models found or failed to load:', result);
        }
      } catch (error) {
        console.error('Error loading custom 3D models:', error);
      }
    };
    loadCustomModels();
  }, []);

  useEffect(() => {
    const loadFabricTypes = async () => {
      try {
        const result = await getAllFabricTypes();

        const fabricNames = [...defaultFabrics];

        if (result.success && result.fabrics && result.fabrics.length > 0) {

          result.fabrics.forEach(fabric => {
            const fabricNameLower = fabric.fabric_name.toLowerCase();

            if (!fabricNames.includes(fabricNameLower)) {
              fabricNames.push(fabricNameLower);
            }
          });
          console.log('✅ Merged fabric types (defaults + API):', fabricNames);
          setFabrics(fabricNames);
        } else {
          console.warn('⚠️ No fabric types found from API, using defaults only');
          setFabrics(defaultFabrics);
        }
      } catch (error) {
        console.error('❌ Error loading fabric types:', error);

        setFabrics(defaultFabrics);
      }
    };
    loadFabricTypes();
  }, []);

  useEffect(() => {
    const loadPatterns = async () => {
      try {
        const result = await getAllPatterns();
        if (result.success && result.patterns && result.patterns.length > 0) {
          console.log('✅ Patterns loaded from API:', result.patterns);

          const sortedPatterns = result.patterns.sort((a, b) => {

            const defaultPatternCodes = ['none', 'minimal-stripe', 'minimal-check', 'embroidery-1', 'embroidery-2'];
            const aIsDefault = defaultPatternCodes.includes(a.pattern_code);
            const bIsDefault = defaultPatternCodes.includes(b.pattern_code);

            if (aIsDefault && !bIsDefault) return -1;
            if (!aIsDefault && bIsDefault) return 1;

            if (aIsDefault && bIsDefault) {
              return (a.sort_order || 0) - (b.sort_order || 0);
            }

            return (a.pattern_name || '').localeCompare(b.pattern_name || '');
          });

          setPatterns(sortedPatterns);
        } else {
          console.warn('⚠️ No patterns found from API, using defaults');
          setPatterns(defaultPatterns);
        }
      } catch (error) {
        console.error('❌ Error loading patterns:', error);

        setPatterns(defaultPatterns);
      }
    };
    loadPatterns();
  }, []);

  const handleSaveDesign = async () => {
    const summary = {
      garment,
      size,
      fit,
      modelSize,
      colors,
      fabric,
      pattern,
      style,
      measurements,
      personalization,
      designImage,
      notes,
      buttons,
      accessories,
      pantsType,
      timestamp: new Date().toISOString(),
    };

    localStorage.setItem('tailorDesign', JSON.stringify(summary));

    try {

      const viewerElement = document.querySelector('.viewer');
      let sourceCanvas = viewerElement ? viewerElement.querySelector('canvas') : document.querySelector('canvas');

      if (sourceCanvas) {

        const combinedCanvas = document.createElement('canvas');
        const ctx = combinedCanvas.getContext('2d');

        const infoHeight = 280;
        combinedCanvas.width = sourceCanvas.width;
        combinedCanvas.height = sourceCanvas.height + infoHeight;

        ctx.fillStyle = '#1a1f3a';
        ctx.fillRect(0, 0, combinedCanvas.width, combinedCanvas.height);

        ctx.drawImage(sourceCanvas, 0, 0);

        ctx.fillStyle = '#0f1419';
        ctx.fillRect(0, sourceCanvas.height, combinedCanvas.width, infoHeight);

        ctx.strokeStyle = '#667eea';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(0, sourceCanvas.height);
        ctx.lineTo(combinedCanvas.width, sourceCanvas.height);
        ctx.stroke();

        const garmentName = garment === 'coat-men' ? 'Blazer (Men)' :
                          garment === 'coat-women' ? 'Blazer (Women)' :
                          garment === 'barong' ? 'Barong Tagalog' :
                          garment === 'suit-1' ? 'Business Suit' :
                          garment === 'pants' ? 'Pants' : garment;

        const buttonsList = buttons && buttons.length > 0
          ? buttons.map(b => b.modelPath?.split('/').pop()?.replace('.glb', '') || 'Button').join(', ')
          : 'None';

        const accessoriesList = accessories && accessories.length > 0
          ? accessories.map(a => a.modelPath?.split('/').pop()?.replace('.glb', '').replace(' 3d model', '') || 'Accessory').join(', ')
          : 'None';

        ctx.fillStyle = '#667eea';
        ctx.font = 'bold 24px Arial, sans-serif';
        ctx.fillText("D'JACKMAN TAILOR DELUXE - Custom Design", 20, sourceCanvas.height + 35);

        ctx.fillStyle = '#e7e9ee';
        ctx.font = '16px Arial, sans-serif';
        const lineHeight = 28;
        let y = sourceCanvas.height + 70;

        const patternObj = patterns.find(p => p.pattern_code === pattern);
        const patternDisplayName = patternObj ? patternObj.pattern_name : (pattern === 'none' ? 'Solid' : pattern);

        const infoLines = [
          `🎨 Garment Type: ${garmentName}`,
          `📏 Size: ${size.charAt(0).toUpperCase() + size.slice(1)} | Fit: ${fit.charAt(0).toUpperCase() + fit.slice(1)}`,
          `🧵 Fabric: ${fabric.charAt(0).toUpperCase() + fabric.slice(1)} | Pattern: ${patternDisplayName}`,
          `🎨 Colors - Fabric: ${colors.fabric} | Lining: ${colors.lining} | Buttons: ${colors.button}`,
          `🔘 Buttons: ${buttonsList}`,
          `✨ Accessories: ${accessoriesList}`,
          `📝 Notes: ${notes || 'None'}`,
          `📅 Created: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`
        ];

        infoLines.forEach(line => {
          ctx.fillText(line, 20, y);
          y += lineHeight;
        });

        const dataUrl = combinedCanvas.toDataURL('image/png');

        if (isRNWebView) {

          sendToReactNative({
            type: 'DESIGN_IMAGE_READY',
            imageData: dataUrl,
            garmentName: garmentName,
          });
          await alert('✓ Design image ready!', 'Success', 'success');
        } else {

          const link = document.createElement('a');
          link.href = dataUrl;
          link.download = `tailoring-design-${garmentName.replace(/[^a-z0-9]/gi, '-')}-${new Date().getTime()}.png`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          await alert('✓ Design image with details saved as PNG!', 'Success', 'success');
        }
      } else {
        await alert('Canvas not found. Design saved to localStorage only.', 'Warning', 'warning');
      }
    } catch (error) {
      console.error('Error saving design as PNG:', error);
      await alert('Error saving image. Design saved to localStorage.', 'Error', 'error');
    }
  };

  const getGarmentTypeName = () => {
    if (garment === 'coat-men') return 'Blazer';
    if (garment === 'coat-women') return 'Blazer';
    if (garment === 'barong') return 'Barong';
    if (garment === 'suit-1') return 'Suit';
    if (garment === 'pants') return 'Pants';

    if (garment.startsWith('custom-')) {
      const modelId = parseInt(garment.replace('custom-', ''));
      const customModel = customModels?.find(m => m.model_id === modelId);
      if (customModel?.garment_category) {

        return customModel.garment_category;
      }
      if (customModel?.model_name) {
        return customModel.model_name;
      }
    }
    return garment;
  };

  const getGarmentCode = () => {

    if (!garment.startsWith('custom-')) {
      return garment;
    }

    const modelId = parseInt(garment.replace('custom-', ''));
    const customModel = customModels?.find(m => m.model_id === modelId);
    if (customModel?.garment_category) {
      return customModel.garment_category;
    }
    return garment;
  };

  const captureCanvasImage = () => {
    try {
      const viewerElement = document.querySelector('.viewer');
      const sourceCanvas = viewerElement ? viewerElement.querySelector('canvas') : document.querySelector('canvas');
      if (sourceCanvas) {
        return sourceCanvas.toDataURL('image/png');
      }
    } catch (error) {
      console.error('Error capturing canvas:', error);
    }
    return null;
  };

  const captureMultipleAngles = async () => {
    const angles = ['front', 'back', 'right', 'left'];
    const images = {};

    return new Promise((resolve) => {
      let capturedCount = 0;
      const callbackId = `capture-${Date.now()}-${Math.random()}`;

      const handleAngleCaptured = (event) => {
        const { angle, imageData, callbackId: eventCallbackId } = event.detail;
        if (eventCallbackId === callbackId) {
          images[angle] = imageData;
          capturedCount++;

          if (capturedCount === angles.length) {
            window.removeEventListener('angle-captured', handleAngleCaptured);
            resolve(images);
          }
        }
      };

      window.addEventListener('angle-captured', handleAngleCaptured);

      angles.forEach((angle, index) => {
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('capture-angle', {
            detail: { angle, callbackId }
          }));
        }, index * 300);
      });

      setTimeout(() => {
        if (capturedCount < angles.length) {
          console.warn('Some angle captures may have failed');
          window.removeEventListener('angle-captured', handleAngleCaptured);
          resolve(images);
        }
      }, 5000);
    });
  };

  const handleApplyDesign = async () => {
    const garmentTypeName = getGarmentTypeName();

    const priceMap = {
      'Blazer (Men)': 2500,
      'Blazer (Women)': 2500,
      'Barong Tagalog': 3000,
      'Business Suit': 4000,
      'Pants': 1200,
    };
    const estimatedPrice = priceMap[garmentTypeName] || 2000;

    const angleImages = await captureMultipleAngles();

    const designImage = angleImages.front || captureCanvasImage();

    const garmentCode = getGarmentCode();

    const finalDesign = {
      ...customizationData,
      targetGarmentId: customizationData?.targetGarmentId || 1,
      design: {
        garment: garmentCode,
        garmentType: garmentTypeName,
        size,
        fit,
        colors,
        fabric,
        pattern,
        measurements,
        personalization,
        notes,
        buttons,
        accessories,
        pantsType,
        designImage: designImage,
        angleImages: angleImages,
      },
      timestamp: new Date().toISOString(),
    };

    if (isRNWebView) {
      sendToReactNative({
        type: 'CUSTOMIZATION_COMPLETE',
        garmentType: garmentTypeName,
        fabricType: fabric,
        designImage: designImage,
        angleImages: angleImages,
        designData: finalDesign.design,
        notes: notes,
        estimatedPrice: estimatedPrice,
        measurements: measurements,
      });

      await alert('✓ Design sent to app!', 'Success', 'success');
      return;
    }

    sessionStorage.setItem('finalDesignData', JSON.stringify(finalDesign));

    navigate('/user-home');
  };

  const handleBackToCustomization = () => {

    if (isRNWebView) {
      sendToReactNative({
        type: 'CUSTOMIZATION_CANCEL',
      });
      return;
    }

    navigate('/user-home');
  };

  const getCustomGarmentNavItems = () => {
    if (!customModels || customModels.length === 0) return [];

    const uniqueModels = customModels
      .filter(model => model.model_type === 'garment')
      .reduce((acc, model) => {
        const exists = acc.find(m => m.model_name.toLowerCase() === model.model_name.toLowerCase());
        if (!exists) acc.push(model);
        return acc;
      }, []);

    return uniqueModels;
  };

  const isCustomModelActive = (modelId) => {
    return garment === `custom-${modelId}`;
  };

  return (
    <div className="app">
      <div className="nav">
        <button
          className={garment.startsWith('coat') && !garment.startsWith('custom-') ? 'active' : ''}
          onClick={() => setGarment('coat-men')}
        >
          Blazer
        </button>
        <button
          className={garment === 'barong' ? 'active' : ''}
          onClick={() => setGarment('barong')}
        >
          Barong
        </button>
        <button
          className={garment.startsWith('suit') && !garment.startsWith('custom-') ? 'active' : ''}
          onClick={() => setGarment('suit-1')}
        >
          Suit
        </button>
        <button
          className={garment === 'pants' ? 'active' : ''}
          onClick={() => setGarment('pants')}
        >
          Pants
        </button>
        {getCustomGarmentNavItems().map(model => (
          <button
            key={model.model_id}
            className={isCustomModelActive(model.model_id) ? 'active custom-model-btn' : 'custom-model-btn'}
            onClick={() => setGarment(`custom-${model.model_id}`)}
            title={model.description || model.model_name}
          >
            {model.model_name}
          </button>
        ))}

        <button
          className="save-btn"
          onClick={handleSaveDesign}
          title="Save design to localStorage"
        >
          💾 Save
        </button>
        <button
          className="apply-btn"
          onClick={handleApplyDesign}
          title="Apply design and return"
        >
          ✓ Apply
        </button>
        <button
          className="back-btn"
          onClick={handleBackToCustomization}
          title="Go back"
        >
          ← Back
        </button>
      </div>

      <div className="panel">
        <CustomizationPanel
          garment={garment}
          setGarment={setGarment}
          size={size}
          setSize={setSize}
          fit={fit}
          setFit={setFit}
          modelSize={modelSize}
          setModelSize={setModelSize}
          colors={colors}
          setColors={setColors}
          fabric={fabric}
          setFabric={setFabric}
          patterns={patterns}
          pattern={pattern}
          setPattern={setPattern}
          fabrics={fabrics}
          designImage={designImage}
          setDesignImage={setDesignImage}
          notes={notes}
          setNotes={setNotes}
          buttons={buttons}
          setButtons={setButtons}
          accessories={accessories}
          setAccessories={setAccessories}
          pantsType={pantsType}
          setPantsType={setPantsType}
          style={style}
          setStyle={setStyle}
          customModels={customModels}
          measurements={measurements}
          setMeasurements={setMeasurements}
        />
      </div>

      <div className="viewer">
        <Viewer3D
          garment={garment}
          size={size}
          fit={fit}
          modelSize={modelSize}
          colors={colors}
          fabric={fabric}
          pattern={pattern}
          style={style}
          measurements={measurements}
          personalization={personalization}
          buttons={buttons}
          setButtons={setButtons}
          accessories={accessories}
          setAccessories={setAccessories}
          pantsType={pantsType}
          customModels={customModels}
          patterns={patterns}
        />
      </div>
    </div>
  );
};

export default Customizer3DPage;
