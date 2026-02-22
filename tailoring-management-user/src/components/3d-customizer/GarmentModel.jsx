import { RoundedBox, Capsule, Text, Edges, useGLTF, useTexture } from '@react-three/drei';
import React, { useMemo, useLayoutEffect, Suspense, useEffect, useState, useRef } from 'react';
import * as THREE from 'three';
import CustomModelLoader from './CustomModelLoader';
import { API_BASE_URL } from '../../api/config';

const isMobile = () => {
  return typeof window !== 'undefined' && (
    window.IS_REACT_NATIVE_WEBVIEW ||
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  );
};

const logModelLoad = (name, scene) => {
  if (scene) {
    console.log(`✅ Model loaded: ${name}`, scene);
  } else {
    console.warn(`⚠️ Model failed to load: ${name}`);
  }
};

function makeProceduralPattern(type, base, accent, repeatX = 2, repeatY = 2) {
  const c = document.createElement('canvas');

  c.width = 512; c.height = 512;
  const ctx = c.getContext('2d');
  ctx.fillStyle = base; ctx.fillRect(0, 0, 512, 512);

  if (type === 'minimal-stripe') {
    ctx.fillStyle = accent;
    for (let i = 0; i < 512; i += 24) { ctx.fillRect(i, 0, 4, 512); }
  } else if (type === 'minimal-check') {
    ctx.strokeStyle = accent; ctx.lineWidth = 2;
    for (let i = 0; i < 512; i += 28) {
      ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 512); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(512, i); ctx.stroke();
    }
  } else if (type === 'embroidery-1') {
    ctx.strokeStyle = accent; ctx.lineWidth = 3;
    for (let i = 0; i < 12; i++) {
      const x = 40 + i * 40;
      ctx.beginPath(); ctx.arc(256, x, 24, 0, Math.PI * 2); ctx.stroke();
    }
  } else if (type === 'embroidery-2') {
    ctx.fillStyle = accent;
    for (let i = 0; i < 10; i++) {
      ctx.beginPath();
      ctx.moveTo(48 + i * 48, 80);
      ctx.lineTo(72 + i * 48, 112);
      ctx.lineTo(24 + i * 48, 112);
      ctx.closePath(); ctx.fill();
    }
  }

  const tex = new THREE.CanvasTexture(c);

  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);

  tex.anisotropy = 16;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;

  return tex;
}

function makePattern(type, base, accent) {
  return makeProceduralPattern(type, base, accent);
}

function makeBump() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 256;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(256, 256);
  for (let y = 0; y < 256; y++) {
    for (let x = 0; x < 256; x++) {
      const i = (y * 256 + x) * 4;
      const n = (Math.sin(x * 0.15) + Math.cos(y * 0.13)) * 0.5 + Math.random() * 0.05;
      const v = Math.floor(128 + 20 * n);
      img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 4);
  return tex;
}

export default function GarmentModel({ garment, size, fit, modelSize, colors, fabric, pattern, style, measurements, personalization, pantsType, customModels = [], patterns = [] }) {
  const baseColor = colors.fabric;
  const accent = colors.stitching;

  const [imageTexture, setImageTexture] = useState(null);

  const [isLoadingTexture, setIsLoadingTexture] = useState(false);

  const textureRef = React.useRef(null);

  const currentPatternCodeRef = React.useRef(pattern);

  const currentPattern = useMemo(() => {
    if (!patterns || patterns.length === 0) return null;
    const found = patterns.find(p => p.pattern_code === pattern);
    console.log('🔍 Looking for pattern:', pattern, 'Found:', found?.pattern_name, 'Type:', found?.pattern_type);
    return found;
  }, [patterns, pattern]);

  useEffect(() => {

    currentPatternCodeRef.current = pattern;

    if (textureRef.current) {
      textureRef.current.dispose();
      textureRef.current = null;
    }
    setImageTexture(null);
    setIsLoadingTexture(false);

    if (currentPattern && currentPattern.pattern_type === 'image' && currentPattern.image_url) {
      console.log('🖼️ Loading image pattern:', currentPattern.pattern_name, 'URL:', currentPattern.image_url);
      setIsLoadingTexture(true);

      let imageUrl = currentPattern.image_url;
      if (!imageUrl.startsWith('http')) {
        imageUrl = `${API_BASE_URL}${imageUrl.startsWith('/') ? '' : '/'}${imageUrl}`;
      }

      console.log('📥 Full image URL:', imageUrl);

      const loader = new THREE.TextureLoader();
      loader.setCrossOrigin('anonymous');

      const loadingForPattern = pattern;

      loader.load(
        imageUrl,
        (texture) => {

          if (currentPatternCodeRef.current !== loadingForPattern) {
            console.log('⚠️ Pattern changed while loading, discarding texture for:', loadingForPattern);
            texture.dispose();
            return;
          }

          texture.wrapS = THREE.RepeatWrapping;
          texture.wrapT = THREE.RepeatWrapping;

          const baseRepeatX = parseFloat(currentPattern.repeat_x) || 2;
          const baseRepeatY = parseFloat(currentPattern.repeat_y) || 2;

          const garmentRepeatMultiplier = getGarmentRepeatMultiplier(garment);
          texture.repeat.set(
            baseRepeatX * garmentRepeatMultiplier.x,
            baseRepeatY * garmentRepeatMultiplier.y
          );

          texture.anisotropy = 16;

          texture.minFilter = THREE.LinearMipmapLinearFilter;
          texture.magFilter = THREE.LinearFilter;

          texture.generateMipmaps = true;

          texture.colorSpace = THREE.SRGBColorSpace;

          texture.offset.set(0, 0);

          texture.needsUpdate = true;

          textureRef.current = texture;
          setImageTexture(texture);
          setIsLoadingTexture(false);
          console.log('✅ Pattern image texture loaded:', currentPattern.pattern_name,
            'Repeat:', texture.repeat.x.toFixed(2), 'x', texture.repeat.y.toFixed(2));
        },
        (progress) => {
          if (progress.total > 0) {
            console.log('⏳ Loading pattern texture:', Math.round((progress.loaded / progress.total) * 100), '%');
          }
        },
        (error) => {
          console.error('❌ Error loading pattern texture:', error);
          console.error('❌ Failed URL:', imageUrl);
          setIsLoadingTexture(false);
          setImageTexture(null);
        }
      );
    } else if (currentPattern) {
      console.log('📐 Using procedural pattern:', currentPattern.procedural_type || pattern);
    }

    return () => {
      if (textureRef.current) {
        textureRef.current.dispose();
        textureRef.current = null;
      }
    };
  }, [currentPattern, pattern, garment]);

  function getGarmentRepeatMultiplier(garmentType) {
    const multipliers = {

      'coat-men': { x: 1.5, y: 1.8 },
      'coat-men-plain': { x: 1.5, y: 1.8 },
      'coat-women': { x: 1.4, y: 1.7 },
      'coat-women-plain': { x: 1.4, y: 1.7 },
      'coat-teal': { x: 1.5, y: 1.8 },

      'suit-1': { x: 1.5, y: 2.0 },
      'suit-2': { x: 1.5, y: 2.0 },

      'barong': { x: 1.2, y: 1.5 },

      'pants': { x: 1.0, y: 1.5 },

      'default': { x: 1.0, y: 1.0 }
    };

    return multipliers[garmentType] || multipliers['default'];
  }

  const map = useMemo(() => {

    if (currentPattern?.pattern_type === 'image' && imageTexture) {
      console.log('🎨 Using image texture for pattern:', currentPattern.pattern_name, 'on garment:', garment);
      return imageTexture;
    }

    if (isLoadingTexture && currentPattern?.pattern_type === 'image') {
      console.log('⏳ Loading image texture, showing solid color temporarily');

      return makeProceduralPattern('none', baseColor, accent, 1, 1);
    }

    const proceduralType = currentPattern?.procedural_type || pattern;

    const repeatMultiplier = getGarmentRepeatMultiplier(garment);
    const baseRepeat = 2;

    console.log('🎨 Using procedural pattern:', proceduralType, 'on garment:', garment,
      'Repeat:', (baseRepeat * repeatMultiplier.x).toFixed(2), 'x', (baseRepeat * repeatMultiplier.y).toFixed(2));

    return makeProceduralPattern(
      proceduralType,
      baseColor,
      accent,
      baseRepeat * repeatMultiplier.x,
      baseRepeat * repeatMultiplier.y
    );
  }, [imageTexture, isLoadingTexture, currentPattern, pattern, baseColor, accent, garment]);

  const bump = useMemo(() => makeBump(), []);
  const fabricColor = useMemo(() => {
    const color = new THREE.Color(baseColor);

    const brightness = (0.299 * color.r + 0.587 * color.g + 0.114 * color.b);

    if (brightness < 0.5) {

      let brightenFactor;
      if (brightness < 0.2) {

        brightenFactor = 1.0 + (0.2 - brightness) * 2.0 + 0.6;
      } else {

        brightenFactor = 1.0 + (0.5 - brightness) * 0.67;
      }

      const maxComponent = Math.max(color.r, color.g, color.b);
      if (maxComponent > 0) {

        const normalizedR = color.r / maxComponent;
        const normalizedG = color.g / maxComponent;
        const normalizedB = color.b / maxComponent;

        const targetBrightness = Math.min(0.6, brightness * brightenFactor);
        const scale = targetBrightness / (0.299 * normalizedR + 0.587 * normalizedG + 0.114 * normalizedB);

        color.r = Math.min(1.0, normalizedR * scale);
        color.g = Math.min(1.0, normalizedG * scale);
        color.b = Math.min(1.0, normalizedB * scale);
      }
    }
    return color;
  }, [baseColor]);

  const materialProps = useMemo(() => {

    let rough, metal, bumpScale;
    if (fabric === 'silk') {
      rough = 0.25;
      metal = 0.1;
      bumpScale = 0.02;
    } else if (fabric === 'linen') {
      rough = 0.85;
      metal = 0.0;
      bumpScale = 0.08;
    } else if (fabric === 'cotton') {
      rough = 0.6;
      metal = 0.0;
      bumpScale = 0.06;
    } else if (fabric === 'jusi') {

      rough = 0.3;
      metal = 0.05;
      bumpScale = 0.03;
    } else if (fabric === 'Piña' || fabric === 'pina') {

      rough = 0.25;
      metal = 0.08;
      bumpScale = 0.02;
    } else {

      rough = 0.9;
      metal = 0.0;
      bumpScale = 0.07;
    }

    const transparent = garment === 'barong';
    const opacity = garment === 'barong' ? Math.max(0.15, Math.min(0.85, style.transparency || 0.35)) : 1;

    const brightness = (0.299 * fabricColor.r + 0.587 * fabricColor.g + 0.114 * fabricColor.b);

    const adjustedSheen = brightness < 0.3 ? 0.2 : brightness < 0.5 ? 0.4 : 1.0;

    return {
      roughness: rough,
      metalness: metal,
      map,
      color: fabricColor,
      transparent,
      opacity,
      sheen: adjustedSheen,
      sheenColor: fabricColor,
      bumpMap: bump,
      bumpScale
    };
  }, [fabric, fabricColor, map, garment, style, bump]);

  const chestS = measurements.chest / 38;
  const waistS = measurements.waist / 32;
  const hipsS = measurements.hips / 38;
  const shoulderS = measurements.shoulders / 18;
  const sleeveS = measurements.sleeveLength / 25;
  const inseamS = measurements.inseam / 30;

  const buttonColor = new THREE.Color(colors.button);
  const liningColor = new THREE.Color(colors.lining);

  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [modelError, setModelError] = useState(null);

  const isMobileDevice = isMobile();

  const blackBlazer = useGLTF('/black blazer 3d model.glb');
  const blackBlazerPlain = useGLTF('/black blazer plain 3d model.glb');
  const blazerWomen = useGLTF('/blazer 3d model.glb');
  const blazerWomenPlain = useGLTF('/blazer 3d women plain model.glb');
  const tealCoat = useGLTF('/teal long coat 3d model.glb');
  const barongModel = useGLTF('/barong tagalog shirt 3d model.glb');
  const suit1 = useGLTF('/business suit 3d model.glb');
  const suit2 = useGLTF('/business suit 3d model (1).glb');
  const pantsCasualMen = useGLTF('/pants 3d model.glb');
  const pantsFormalMen = useGLTF('/dress pants 3d model.glb');
  const pantsFormalWomen = useGLTF('/denim jeans 3d model.glb');

  const blackBlazerShort = useGLTF('/short3d/blazer short model.glb');
  const blackBlazerPlainShort = useGLTF('/short3d/blazer short plain M model.glb');
  const blazerWomenShort = useGLTF('/short3d/blazer W short model.glb');
  const blazerWomenPlainShort = useGLTF('/short3d/blazer woman short plain model.glb');
  const tealCoatShort = useGLTF('/short3d/trench coat 3d  short model.glb');

  useEffect(() => {
    console.log('🔄 Model loading status...');
    console.log('Current garment type:', garment);
    console.log('Is mobile:', isMobileDevice);

    if (blackBlazer?.scene) {
      setModelsLoaded(true);
      console.log('✅ Models loaded successfully');
    }
  }, [garment, modelSize, blackBlazer?.scene, isMobileDevice]);

  const matchingCustomModel = useMemo(() => {
    if (!customModels || customModels.length === 0) {
      return null;
    }

    const builtInGarments = [
      'coat-men', 'coat-men-plain', 'coat-women', 'coat-women-plain', 'coat-teal',
      'suit-1', 'suit-2',
      'barong',
      'pants'
    ];

    if (builtInGarments.includes(garment)) {
      console.log('Built-in garment detected:', garment, '- Using built-in model, not custom');
      return null;
    }

    if (garment.startsWith('custom-')) {
      const modelId = garment.replace('custom-', '');
      const match = customModels.find(model =>
        model.is_active &&
        model.model_type === 'garment' &&
        String(model.model_id) === modelId
      );
      if (match) {
        console.log('Found custom model by ID:', match.model_name);
        return match;
      }
    }

    const match = customModels.find(model =>
      model.is_active &&
      model.model_type === 'garment' &&
      model.garment_category &&
      model.garment_category === garment &&
      !builtInGarments.includes(garment)
    );

    if (match) {
      console.log('Found custom model by category:', match.model_name);
      return match;
    }

    return null;
  }, [customModels, garment]);

  let selectedModel = null;
  let use3DModel = false;
  let isCustomModel = false;

  if (matchingCustomModel) {
    use3DModel = true;
    isCustomModel = true;

  } else {

  if (garment === 'coat-men') {
    use3DModel = true;
    selectedModel = modelSize === 'short' ? blackBlazerShort.scene : blackBlazer.scene;
  } else if (garment === 'coat-men-plain') {
    use3DModel = true;
    selectedModel = modelSize === 'short' ? blackBlazerPlainShort.scene : blackBlazerPlain.scene;
  } else if (garment === 'coat-women') {
    use3DModel = true;
    selectedModel = modelSize === 'short' ? blazerWomenShort.scene : blazerWomen.scene;
  } else if (garment === 'coat-women-plain') {
    use3DModel = true;
    selectedModel = modelSize === 'short' ? blazerWomenPlainShort.scene : blazerWomenPlain.scene;
  } else if (garment === 'coat-teal') {
    use3DModel = true;
    selectedModel = modelSize === 'short' ? tealCoatShort.scene : tealCoat.scene;
  } else if (garment === 'barong') {
    use3DModel = true;
    selectedModel = barongModel.scene;
  } else if (garment === 'suit-1') {
    use3DModel = true;
    selectedModel = suit1.scene;
  } else if (garment === 'suit-2') {
    use3DModel = true;
    selectedModel = suit2.scene;
  }
  }

  const modelScene = useMemo(() => selectedModel ? selectedModel.clone() : null, [selectedModel, pattern, imageTexture]);

  const sizeScale = useMemo(() => {
    let baseScale;
    switch (size) {
      case 'small':
        baseScale = 1.4;
        break;
      case 'large':
        baseScale = 1.6;
        break;
      case 'medium':
      default:
        baseScale = 1.5;
        break;
    }

    switch (fit) {
      case 'loose':
        return baseScale * 1.05;
      case 'fitted':
        return baseScale * 0.95;
      case 'regular':
      default:
        return baseScale;
    }
  }, [size, fit]);

  useLayoutEffect(() => {
    if (use3DModel && modelScene) {
      console.log('🔄 Applying material to model, pattern:', pattern, 'hasImageTexture:', !!imageTexture);

      modelScene.rotation.y = -Math.PI / 2;

      modelScene.traverse((child) => {
        if (child.isMesh) {

          if (child.material && child.material.dispose) {
            child.material.dispose();
          }

          const newMaterial = new THREE.MeshPhysicalMaterial({
            ...materialProps,
            color: fabricColor.clone(),
            sheenColor: fabricColor.clone(),
            map: map,
            needsUpdate: true
          });
          newMaterial.needsUpdate = true;
          child.material = newMaterial;
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
    }
  }, [modelScene, garment, materialProps, use3DModel, fabricColor, pattern, imageTexture, map]);

  const pantsModel = useMemo(() => {
    if (garment !== 'pants') return null;

    if (pantsType === 'casual-men') {
      return pantsCasualMen.scene;
    } else if (pantsType === 'formal-men') {
      return pantsFormalMen.scene;
    } else if (pantsType === 'formal-women') {
      return pantsFormalWomen.scene;
    }

    return pantsCasualMen.scene;
  }, [garment, pantsType, pantsCasualMen.scene, pantsFormalMen.scene, pantsFormalWomen.scene]);

  const pantsModelScene = useMemo(() => pantsModel ? pantsModel.clone() : null, [pantsModel, pattern, imageTexture]);

  useLayoutEffect(() => {
    if (pantsModelScene) {
      console.log('🔄 Applying material to pants model, pattern:', pattern, 'hasImageTexture:', !!imageTexture);

      pantsModelScene.rotation.y = -Math.PI / 2;

      pantsModelScene.traverse((child) => {
        if (child.isMesh) {

          if (child.material && child.material.dispose) {
            child.material.dispose();
          }

          const newMaterial = new THREE.MeshPhysicalMaterial({
            ...materialProps,
            color: fabricColor.clone(),
            sheenColor: fabricColor.clone(),
            map: map,
            needsUpdate: true
          });
          newMaterial.needsUpdate = true;
          child.material = newMaterial;
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });
    }
  }, [pantsModelScene, materialProps, fabricColor, pattern, imageTexture, map]);

  const isCoat = garment.startsWith('coat') || garment === 'suit';
  const lapel = isCoat ? style.lapel : 'shawl';
  const buttonsCount = isCoat ? style.buttons : 0;
  const torsoH = garment.startsWith('coat') ? 3.0 * waistS : 2.4 * waistS;

  const customModelToRender = useMemo(() => {

    const builtInGarments = [
      'coat-men', 'coat-men-plain', 'coat-women', 'coat-women-plain', 'coat-teal',
      'suit-1', 'suit-2',
      'barong',
      'pants'
    ];

    console.log('=== CHECKING FOR CUSTOM MODEL ===');
    console.log('Current garment:', garment);
    console.log('Available custom models:', customModels);

    if (builtInGarments.includes(garment)) {
      console.log('✓ Built-in garment detected:', garment, '- Using built-in model, NOT custom');
      return null;
    }

    if (garment.startsWith('custom-')) {
      const modelId = garment.replace('custom-', '');
      const match = customModels.find(m =>
        m.is_active &&
        m.model_type === 'garment' &&
        String(m.model_id) === modelId
      );
      if (match) {
        console.log('✓ Found custom model by ID:', match.model_name);
        return match;
      }
    }

    if (matchingCustomModel) {
      console.log('✓ Found custom model by category:', matchingCustomModel.model_name);
      return matchingCustomModel;
    }

    console.log('✗ No custom model match found - will use built-in model');
    return null;
  }, [garment, customModels, matchingCustomModel]);

  if (garment === 'pants') {
    if (!pantsModelScene) {

      return (
        <mesh position={[0, 0.5, 0]}>
          <boxGeometry args={[1, 1.5, 0.5]} />
          <meshStandardMaterial color="#cccccc" transparent opacity={0.5} />
        </mesh>
      );
    }

    return (
      <group position={[0, 0, 0]} scale={sizeScale}>
        <primitive object={pantsModelScene} />
        {personalization.initials && (
          <Text position={[0, 1.5, 0.3]} fontSize={personalization.size * 0.25} color={colors.stitching}>
            {personalization.initials}
          </Text>
        )}
      </group>
    );
  }

  if (customModelToRender && customModelToRender.file_url) {

    let modelUrl = customModelToRender.file_url;
    if (!modelUrl.startsWith('http')) {
      modelUrl = `${API_BASE_URL}${modelUrl.startsWith('/') ? '' : '/'}${modelUrl}`;
    }

    console.log('=== RENDERING CUSTOM MODEL ===');
    console.log('Model name:', customModelToRender.model_name);
    console.log('Model URL:', modelUrl);
    console.log('Garment value:', garment);
    console.log('Model category:', customModelToRender.garment_category);
    console.log('Size scale:', sizeScale);

    return (
      <group position={[0, 0, 0]} scale={sizeScale}>
        <Suspense fallback={
          <mesh>
            <boxGeometry args={[1, 2, 0.5]} />
            <meshStandardMaterial color="#cccccc" />
          </mesh>
        }>
          <CustomModelLoader
            modelUrl={modelUrl}
            materialProps={materialProps}
            fabricColor={fabricColor}
            map={map}
            pattern={pattern}
            onLoad={() => {
              console.log('✓ Custom model loaded successfully:', customModelToRender.model_name);
            }}
          />
        </Suspense>
        {personalization.initials && (
          <Text position={[0, 1.5, 0.3]} fontSize={personalization.size * 0.25} color={colors.stitching}>
            {personalization.initials}
          </Text>
        )}
      </group>
    );
  }

  if (garment.startsWith('coat') || garment.startsWith('suit') || garment === 'barong' || garment === 'pants') {

    if (!modelScene) return null;
    return (
      <group position={[0, 0, 0]} scale={sizeScale}>
        <primitive object={modelScene} />
        {personalization.initials && (
          <Text position={[0, 1.5, 0.3]} fontSize={personalization.size * 0.25} color={colors.stitching}>
            {personalization.initials}
          </Text>
        )}
      </group>
    );
  }

  if (garment === 'barong') {

    if (!modelScene) return null;
    return (
      <group position={[0, 0, 0]} scale={sizeScale}>
        <primitive object={modelScene} />
        {personalization.initials && (
          <Text position={[0, 1.5, 0.3]} fontSize={personalization.size * 0.25} color={colors.stitching}>
            {personalization.initials}
          </Text>
        )}
      </group>
    );
  }

  if (garment.startsWith('suit') || (garment.startsWith('custom-') && matchingCustomModel && matchingCustomModel.garment_category && matchingCustomModel.garment_category.startsWith('suit'))) {

    if (matchingCustomModel && matchingCustomModel.file_url) {
      const modelUrl = matchingCustomModel.file_url.startsWith('http')
        ? matchingCustomModel.file_url
        : `${API_BASE_URL}${matchingCustomModel.file_url}`;

      return (
        <group position={[0, 0, 0]} scale={sizeScale}>
          <CustomModelLoader
            modelUrl={modelUrl}
            materialProps={materialProps}
            fabricColor={fabricColor}
            map={map}
            pattern={pattern}
            onLoad={() => {}}
          />
          {personalization.initials && (
            <Text position={[0, 1.5, 0.3]} fontSize={personalization.size * 0.25} color={colors.stitching}>
              {personalization.initials}
            </Text>
          )}
        </group>
      );
    }

    if (!modelScene) return null;
    return (
      <group position={[0, 0, 0]} scale={sizeScale}>
        <primitive object={modelScene} />
        {personalization.initials && (
          <Text position={[0, 1.5, 0.3]} fontSize={personalization.size * 0.25} color={colors.stitching}>
            {personalization.initials}
          </Text>
        )}
      </group>
    );
  }

  if (garment.startsWith('custom-') && matchingCustomModel && matchingCustomModel.file_url) {
    const modelUrl = matchingCustomModel.file_url.startsWith('http')
      ? matchingCustomModel.file_url
      : `${API_BASE_URL}${matchingCustomModel.file_url}`;

    const customModelScale = sizeScale * 3;

    return (
      <group position={[0, 0.8, 2]} scale={customModelScale}>
        <CustomModelLoader
          modelUrl={modelUrl}
          materialProps={materialProps}
          fabricColor={fabricColor}
          map={map}
          pattern={pattern}
          onLoad={() => {}}
        />
        {personalization.initials && (
          <Text position={[0, 1.5, 0.3]} fontSize={personalization.size * 0.25} color={colors.stitching}>
            {personalization.initials}
          </Text>
        )}
      </group>
    );
  }

  return (
    <group>
      <RoundedBox args={[1.05 * chestS, torsoH, 0.4]} radius={0.2} smoothness={8} position={[-0.52 * chestS, 1.2, 0]}>
        <meshPhysicalMaterial {...materialProps} />
        <Edges scale={1} threshold={12} color={colors.lining} />
      </RoundedBox>
      <RoundedBox args={[1.05 * chestS, torsoH, 0.4]} radius={0.2} smoothness={8} position={[0.52 * chestS, 1.2, 0]}>
        <meshPhysicalMaterial {...materialProps} />
        <Edges scale={1} threshold={12} color={colors.lining} />
      </RoundedBox>
      <mesh position={[0, 1.55, 0.38]}>
        <boxGeometry args={[1.4 * chestS, 0.22, 0.06]} />
        <meshPhysicalMaterial color={liningColor} roughness={0.7} metalness={0.05} sheen={0.6} />
      </mesh>
      <Capsule args={[0.35 * shoulderS, 1.4 * sleeveS, 8, 16]} position={[-1.2 * shoulderS, 1.2, 0]} rotation={[0, 0, Math.PI / 16]}>
        <meshPhysicalMaterial color={liningColor} roughness={0.9} opacity={materialProps.opacity} transparent={materialProps.transparent} sheen={0.4} />
        <Edges scale={1} threshold={12} color={colors.stitching} />
      </Capsule>
      <Capsule args={[0.35 * shoulderS, 1.4 * sleeveS, 8, 16]} position={[1.2 * shoulderS, 1.2, 0]} rotation={[0, 0, -Math.PI / 16]}>
        <meshPhysicalMaterial color={liningColor} roughness={0.9} opacity={materialProps.opacity} transparent={materialProps.transparent} sheen={0.4} />
        <Edges scale={1} threshold={12} color={colors.stitching} />
      </Capsule>
      {isCoat && Array.from({ length: buttonsCount }).map((_, i) => (
        <mesh key={`L${i}`} position={[-0.2, 1.1 - i * 0.25, 0.42]}>
          <sphereGeometry args={[0.05, 16, 16]} />
          <meshPhysicalMaterial color={buttonColor} metalness={0.2} roughness={0.5} />
        </mesh>
      ))}
      {isCoat && Array.from({ length: buttonsCount }).map((_, i) => (
        <mesh key={`R${i}`} position={[0.2, 1.1 - i * 0.25, 0.42]}>
          <sphereGeometry args={[0.05, 16, 16]} />
          <meshPhysicalMaterial color={buttonColor} metalness={0.2} roughness={0.5} />
        </mesh>
      ))}
      {garment === 'barong' && style.embroidery && (
        <mesh position={[0, 1.2, 0.41]}>
          <planeGeometry args={[1.2 * chestS, 1.6 * waistS]} />
          <meshPhysicalMaterial map={makePattern('embroidery-1', '#00000000', accent)} transparent />
        </mesh>
      )}
      {personalization.initials && (
        <Text position={[-0.5 * chestS + 0.2, 1.3, 0.41]} fontSize={personalization.size * 0.25} color={colors.stitching}>
          {personalization.initials}
        </Text>
      )}
      {lapel === 'peak' && (
        <mesh position={[0, 1.6, 0.41]}>
          <boxGeometry args={[1.2 * chestS, 0.1, 0.02]} />
          <meshPhysicalMaterial color={colors.lining} />
        </mesh>
      )}
      {lapel === 'shawl' && (
        <mesh position={[0, 1.6, 0.41]}>
          <torusGeometry args={[0.7 * chestS, 0.06, 16, 64, Math.PI]} />
          <meshPhysicalMaterial color={colors.lining} />
        </mesh>
      )}
      {isCoat && (
        <>
          <mesh position={[-0.25 * chestS, 1.45, 0.41]} rotation={[0, 0, Math.PI / 14]}>
            <boxGeometry args={[0.5 * chestS, 0.18, 0.02]} />
            <meshPhysicalMaterial color={colors.lining} roughness={0.6} />
          </mesh>
          <mesh position={[0.25 * chestS, 1.45, 0.41]} rotation={[0, 0, -Math.PI / 14]}>
            <boxGeometry args={[0.5 * chestS, 0.18, 0.02]} />
            <meshPhysicalMaterial color={colors.lining} roughness={0.6} />
          </mesh>
        </>
      )}
      {isCoat && (style.pocket !== 'none') && (
        <>
          <mesh position={[-0.45 * chestS, 0.7, 0.41]}>
            <boxGeometry args={[0.38, 0.12, 0.02]} />
            <meshPhysicalMaterial color={colors.lining} roughness={0.8} />
          </mesh>
          <mesh position={[0.45 * chestS, 0.7, 0.41]}>
            <boxGeometry args={[0.38, 0.12, 0.02]} />
            <meshPhysicalMaterial color={colors.lining} roughness={0.8} />
          </mesh>
        </>
      )}
      {garment.startsWith('coat') && style.vents !== 'none' && (
        <mesh position={[0, 0.6, -0.39]}>
          <boxGeometry args={[0.04, 0.8, 0.01]} />
          <meshPhysicalMaterial color={colors.stitching} roughness={0.8} />
        </mesh>
      )}
      {isCoat && (
        <>
          <mesh position={[-1.2 * shoulderS, 0.5, 0]}>
            <boxGeometry args={[0.24, 0.06, 0.12]} />
            <meshPhysicalMaterial color={colors.lining} roughness={0.7} />
          </mesh>
          <mesh position={[1.2 * shoulderS, 0.5, 0]}>
            <boxGeometry args={[0.24, 0.06, 0.12]} />
            <meshPhysicalMaterial color={colors.lining} roughness={0.7} />
          </mesh>
        </>
      )}
      {garment === 'barong' && (
        <>
          <mesh position={[0, 1.58, 0.41]}>
            <boxGeometry args={[0.9 * chestS, 0.06, 0.02]} />
            <meshPhysicalMaterial color={liningColor} roughness={0.7} opacity={materialProps.opacity} transparent={materialProps.transparent} />
          </mesh>
          <mesh position={[0, 1.35, 0.42]}>
            <boxGeometry args={[0.18, 1.2, 0.02]} />
            <meshPhysicalMaterial color={liningColor} roughness={0.7} opacity={materialProps.opacity} transparent={materialProps.transparent} />
          </mesh>
          {Array.from({ length: 4 }).map((_, i) => (
            <mesh key={`B${i}`} position={[0, 1.5 - i * 0.22, 0.43]}>
              <sphereGeometry args={[0.035, 16, 16]} />
              <meshPhysicalMaterial color={buttonColor} roughness={0.5} />
            </mesh>
          ))}
          {style.collar === 'mandarin' && (
            <mesh position={[0, 1.62, 0.38]}>
              <torusGeometry args={[0.36 * shoulderS, 0.035, 16, 64]} />
              <meshPhysicalMaterial color={liningColor} roughness={0.6} opacity={materialProps.opacity} transparent />
            </mesh>
          )}
          {style.collar === 'classic' && (
            <>
              <mesh position={[-0.22, 1.62, 0.41]} rotation={[0, 0, Math.PI / 9]}>
                <boxGeometry args={[0.36, 0.1, 0.02]} />
                <meshPhysicalMaterial color={liningColor} roughness={0.6} opacity={materialProps.opacity} transparent />
              </mesh>
              <mesh position={[0.22, 1.62, 0.41]} rotation={[0, 0, -Math.PI / 9]}>
                <boxGeometry args={[0.36, 0.1, 0.02]} />
                <meshPhysicalMaterial color={liningColor} roughness={0.6} opacity={materialProps.opacity} transparent />
              </mesh>
            </>
          )}
        </>
      )}
      {garment === 'suit' && (
        <>
          <mesh position={[0, 1.35, 0.43]}>
            <coneGeometry args={[0.12, 0.32, 24]} />
            <meshPhysicalMaterial color={colors.button} roughness={0.4} metalness={0.2} />
          </mesh>
          <mesh position={[-0.18, 1.55, 0.41]} rotation={[0, 0, Math.PI / 8]}>
            <boxGeometry args={[0.35, 0.1, 0.02]} />
            <meshPhysicalMaterial color={liningColor} />
          </mesh>
          <mesh position={[0.18, 1.55, 0.41]} rotation={[0, 0, -Math.PI / 8]}>
            <boxGeometry args={[0.35, 0.1, 0.02]} />
            <meshPhysicalMaterial color={liningColor} />
          </mesh>
          <Capsule args={[0.38 * hipsS, 1.35 * inseamS, 8, 16]} position={[-0.42 * hipsS, 0.7 * inseamS, 0]}>
            <meshPhysicalMaterial {...materialProps} />
            <Edges scale={1} threshold={15} color={colors.lining} />
          </Capsule>
          <Capsule args={[0.38 * hipsS, 1.35 * inseamS, 8, 16]} position={[0.42 * hipsS, 0.7 * inseamS, 0]}>
            <meshPhysicalMaterial {...materialProps} />
            <Edges scale={1} threshold={15} color={colors.lining} />
          </Capsule>
        </>
      )}
    </group>
  );
}

useGLTF.preload('/teal long coat 3d model.glb');
useGLTF.preload('/black blazer 3d model.glb');
useGLTF.preload('/black blazer plain 3d model.glb');
useGLTF.preload('/blazer 3d model.glb');
useGLTF.preload('/blazer 3d women plain model.glb');
useGLTF.preload('/barong tagalog shirt 3d model.glb');
useGLTF.preload('/business suit 3d model.glb');
useGLTF.preload('/business suit 3d model (1).glb');
useGLTF.preload('/pants 3d model.glb');
useGLTF.preload('/dress pants 3d model.glb');
useGLTF.preload('/denim jeans 3d model.glb');

useGLTF.preload('/short3d/blazer short model.glb');
useGLTF.preload('/short3d/blazer short plain M model.glb');
useGLTF.preload('/short3d/blazer W short model.glb');
useGLTF.preload('/short3d/blazer woman short plain model.glb');
useGLTF.preload('/short3d/trench coat 3d  short model.glb');

