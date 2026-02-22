import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, ContactShadows, Stage } from '@react-three/drei';
import { useCallback, useEffect, Suspense, useState } from 'react';
import * as THREE from 'three';
import GarmentModel from './GarmentModel';
import DraggableButton from './DraggableButton';
import DraggableAccessory from './DraggableAccessory';

const isWebGLSupported = () => {
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    return !!gl;
  } catch (e) {
    return false;
  }
};

function ExportButton() {
  const { gl, scene, camera } = useThree();
  const onExport = useCallback(() => {
    gl.render(scene, camera);
    const url = gl.domElement.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = 'garment.png';
    a.click();
  }, [gl, scene, camera]);
  useEffect(() => {
    const handler = () => onExport();
    document.addEventListener('export-png', handler);
    return () => document.removeEventListener('export-png', handler);
  }, [onExport]);
  return null;
}

function CameraController() {
  const { camera, gl, scene } = useThree();

  useEffect(() => {
    const handleCaptureAngle = async (event) => {
      const { angle, callbackId } = event.detail;

      const distance = 5;
      const height = 1.6;
      const target = new THREE.Vector3(0, height, 0);

      let x = 0, z = distance;

      switch(angle) {
        case 'front':
          x = 0;
          z = distance;
          break;
        case 'back':
          x = 0;
          z = -distance;
          break;
        case 'right':
          x = distance;
          z = 0;
          break;
        case 'left':
          x = -distance;
          z = 0;
          break;
        default:
          x = 0;
          z = distance;
      }

      camera.position.set(x, height, z);
      camera.lookAt(target);
      camera.updateProjectionMatrix();

      await new Promise(resolve => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            requestAnimationFrame(() => {
              resolve();
            });
          });
        });
      });

      gl.render(scene, camera);
      const imageData = gl.domElement.toDataURL('image/png');

      window.dispatchEvent(new CustomEvent('angle-captured', {
        detail: { angle, imageData, callbackId }
      }));
    };

    window.addEventListener('capture-angle', handleCaptureAngle);
    return () => window.removeEventListener('capture-angle', handleCaptureAngle);
  }, [camera, gl, scene]);

  return null;
}

const isMobile = () => {
  return typeof window !== 'undefined' && (
    window.IS_REACT_NATIVE_WEBVIEW ||
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  );
};

function LoadingFallback() {
  return (
    <mesh>
      <boxGeometry args={[1, 2, 0.5]} />
      <meshStandardMaterial color="#cccccc" transparent opacity={0.5} />
    </mesh>
  );
}

export default function Viewer3D({ garment, size, fit, modelSize, colors, fabric, pattern, style, measurements, personalization, buttons, setButtons, accessories, setAccessories, pantsType, customModels = [], patterns = [] }) {
  const [selectedButton, setSelectedButton] = useState(null);
  const [selectedAccessory, setSelectedAccessory] = useState(null);
  const [isAnyButtonMoving, setIsAnyButtonMoving] = useState(false);
  const [isAnyAccessoryMoving, setIsAnyAccessoryMoving] = useState(false);
  const [contextLost, setContextLost] = useState(false);
  const [contextLostCount, setContextLostCount] = useState(0);
  const [canvasKey, setCanvasKey] = useState(0);
  const [webglSupported, setWebglSupported] = useState(true);
  const [renderError, setRenderError] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const isMobileDevice = isMobile();
  const devicePixelRatio = isMobileDevice ? [1, 1] : [1, 2];

  useEffect(() => {

    const timer = setTimeout(() => {
      setIsLoading(false);
    }, isMobileDevice ? 3000 : 2000);
    return () => clearTimeout(timer);
  }, [canvasKey, isMobileDevice]);

  useEffect(() => {
    const supported = isWebGLSupported();
    setWebglSupported(supported);
    if (!supported) {
      console.error('WebGL is not supported on this device');
    } else {
      console.log('WebGL is supported, initializing 3D viewer...');
    }
  }, []);

  const handleContextLost = (event) => {
    event.nativeEvent?.preventDefault?.();
    console.log('THREE.WebGLRenderer: Context Lost. Attempting to restore...');
    setContextLost(true);
    setContextLostCount(prev => prev + 1);
  };

  const handleContextRestored = () => {
    console.log('THREE.WebGLRenderer: Context Restored.');
    setContextLost(false);

    setCanvasKey(prev => prev + 1);
  };

  useEffect(() => {
    if (contextLost) {

      if (isMobileDevice && contextLostCount >= 3) {
        setRenderError('3D viewer ran out of memory. Please try refreshing the page.');
        return;
      }

      const timer = setTimeout(() => {
        setContextLost(false);
        setCanvasKey(prev => prev + 1);
      }, isMobileDevice ? 2000 : 1000);
      return () => clearTimeout(timer);
    }
  }, [contextLost, isMobileDevice, contextLostCount]);

  if (!webglSupported) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#fff', padding: '20px', textAlign: 'center' }}>
        <p style={{ fontSize: '18px', color: '#333', marginBottom: '10px' }}>⚠️ WebGL Not Supported</p>
        <p style={{ fontSize: '14px', color: '#666' }}>Your browser or device does not support WebGL, which is required for 3D viewing.</p>
        <p style={{ fontSize: '12px', color: '#999', marginTop: '10px' }}>Try using a different browser or enabling hardware acceleration.</p>
      </div>
    );
  }

  if (contextLost) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#f5f5f5', padding: '20px' }}>
        <div style={{ width: '40px', height: '40px', border: '4px solid #e0e0e0', borderTop: '4px solid #667eea', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <p style={{ marginTop: '15px', color: '#666' }}>Restoring 3D view...</p>
        <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (renderError) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#fff', padding: '20px', textAlign: 'center' }}>
        <p style={{ fontSize: '18px', color: '#d32f2f', marginBottom: '10px' }}>❌ Rendering Error</p>
        <p style={{ fontSize: '14px', color: '#666' }}>{renderError}</p>
        <button
          onClick={() => { setRenderError(null); setCanvasKey(prev => prev + 1); }}
          style={{ marginTop: '15px', padding: '10px 20px', background: '#667eea', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', height: '100%', background: '#ffffff', position: 'relative' }}>
      {isLoading && (
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'rgba(255,255,255,0.9)',
          zIndex: 10
        }}>
          <div style={{
            width: '50px',
            height: '50px',
            border: '4px solid #f3f3f3',
            borderTop: '4px solid #667eea',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite'
          }} />
          <p style={{ marginTop: '15px', color: '#666', fontSize: '14px' }}>Loading 3D Model...</p>
          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
        </div>
      )}
      <Canvas
        key={canvasKey}
        camera={{ position: [0, 1.6, 5], fov: 50 }}
        shadows
        dpr={devicePixelRatio}
        onCreated={({ gl }) => {
          console.log('Canvas created successfully, WebGL version:', gl.capabilities.isWebGL2 ? 'WebGL2' : 'WebGL1');

          gl.domElement.addEventListener('webglcontextlost', handleContextLost, false);
          gl.domElement.addEventListener('webglcontextrestored', handleContextRestored, false);

          setTimeout(() => setIsLoading(false), 500);
        }}
        onError={(error) => {
          console.error('Canvas error:', error);
          setRenderError(error?.message || 'Failed to render 3D view');
          setIsLoading(false);
        }}
        gl={{
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.4,
          preserveDrawingBuffer: true,
          powerPreference: isMobile() ? 'default' : 'high-performance',
          antialias: !isMobile(),
          failIfMajorPerformanceCaveat: false,
        }}
      >
        <color attach="background" args={[1, 1, 1]} />
        <fog attach="fog" args={[0xffffff, 10, 30]} />
        <Stage intensity={0.6} adjustCamera={false} shadows="accumulative" environment={null}>
          <Suspense fallback={<LoadingFallback />}>
            <GarmentModel garment={garment} size={size} fit={fit} modelSize={modelSize} colors={colors} fabric={fabric} pattern={pattern} style={style} measurements={measurements} personalization={personalization} pantsType={pantsType} customModels={customModels} patterns={patterns} />
          </Suspense>
        </Stage>
        <directionalLight position={[4, 6, -3]} intensity={0.8} color="#ffffff" />
        <directionalLight position={[-5, 3, 5]} intensity={0.5} color="#ffffff" />
        <directionalLight position={[0, 5, 0]} intensity={0.3} color="#ffffff" />
        <ambientLight intensity={0.6} />

        <ContactShadows position={[0, 0, 0]} opacity={0.4} scale={10} blur={2.6} far={4.5} />
        <OrbitControls enablePan={false} enabled={!isAnyButtonMoving && !isAnyAccessoryMoving} />
        <CameraController />
        {buttons && buttons.map((btn) => (
          <Suspense key={btn.id} fallback={null}>
            <DraggableButton
              id={btn.id}
              modelPath={btn.modelPath}
              position={btn.position}
              color={btn.color}
              scale={btn.scale || 0.15}
              isSelected={selectedButton === btn.id}
              onSelect={setSelectedButton}
              onPositionChange={(id, newPos) => {
                setButtons((prev) => prev.map((b) => b.id === id ? { ...b, position: newPos } : b));
              }}
              onMovingChange={setIsAnyButtonMoving}
            />
          </Suspense>
        ))}
        {accessories && accessories.map((acc) => (
          <Suspense key={acc.id} fallback={null}>
            <DraggableAccessory
              id={acc.id}
              modelPath={acc.modelPath}
              position={acc.position}
              color={acc.color}
              scale={acc.scale || 0.2}
              isSelected={selectedAccessory === acc.id}
              onSelect={setSelectedAccessory}
              onPositionChange={(id, newPos) => {
                setAccessories((prev) => prev.map((a) => a.id === id ? { ...a, position: newPos } : a));
              }}
              onMovingChange={setIsAnyAccessoryMoving}
            />
          </Suspense>
        ))}
        <ExportButton />
      </Canvas>
    </div>
  );
}
