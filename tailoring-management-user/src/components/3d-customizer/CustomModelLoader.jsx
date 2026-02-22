import { useGLTF } from '@react-three/drei';
import { useMemo, useLayoutEffect, Suspense } from 'react';
import * as THREE from 'three';

function CustomModelContent({ modelUrl, materialProps, fabricColor, onLoad, map, pattern }) {

  const { scene } = useGLTF(modelUrl);

  const clonedScene = useMemo(() => {
    if (scene) {
      const cloned = scene.clone();
      console.log('Custom model scene cloned successfully, pattern:', pattern);
      return cloned;
    }
    return null;
  }, [scene, pattern, map]);

  useLayoutEffect(() => {
    if (clonedScene) {
      console.log('Applying materials to custom model, pattern:', pattern, 'hasMap:', !!map);

      clonedScene.traverse((child) => {
        if (child.isMesh) {
          if (child.material && child.material.dispose) {
            child.material.dispose();
          }
          if (materialProps && fabricColor) {
            const newMaterial = new THREE.MeshPhysicalMaterial({
              ...materialProps,
              color: fabricColor.clone(),
              sheenColor: fabricColor.clone(),
              map: map,
              needsUpdate: true
            });
            newMaterial.needsUpdate = true;
            child.material = newMaterial;
          }
          child.castShadow = true;
          child.receiveShadow = true;
        }
      });

      clonedScene.rotation.y = -Math.PI / 2;
      if (onLoad) {
        onLoad(clonedScene);
      }
    }
  }, [clonedScene, onLoad, materialProps, fabricColor, map, pattern]);

  if (!clonedScene) {
    return null;
  }

  return <primitive object={clonedScene} />;
}

function ModelLoadingFallback() {
  return (
    <mesh>
      <boxGeometry args={[1, 2, 0.5]} />
      <meshStandardMaterial color="#cccccc" />
    </mesh>
  );
}

function ModelErrorFallback() {
  return (
    <mesh>
      <boxGeometry args={[1, 2, 0.5]} />
      <meshStandardMaterial color="#ff0000" />
    </mesh>
  );
}

export default function CustomModelLoader({ modelUrl, onLoad, materialProps, fabricColor, map, pattern }) {
  if (!modelUrl) {
    console.warn('CustomModelLoader: No model URL provided');
    return <ModelErrorFallback />;
  }

  console.log('CustomModelLoader loading model from:', modelUrl, 'pattern:', pattern);

  return (
    <Suspense fallback={<ModelLoadingFallback />}>
      <CustomModelContent
        modelUrl={modelUrl}
        materialProps={materialProps}
        fabricColor={fabricColor}
        onLoad={onLoad}
        map={map}
        pattern={pattern}
      />
    </Suspense>
  );
}

