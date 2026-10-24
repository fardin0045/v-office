import React, { useRef, useEffect } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';

const CAMERA_SMOOTHING = 4.6;
const POSITION_EPSILON = 0.025;
const TARGET_EPSILON = 0.02;

export function CameraRig({ targetView, onTransitionComplete }) {
  const { camera } = useThree();
  const controlsRef = useRef(null);
  const desiredCamPos = useRef(new THREE.Vector3(0, 26, 26));
  const desiredLookAt = useRef(new THREE.Vector3(0, 0, 0));
  const isTransitioning = useRef(false);
  const completionCallback = useRef(onTransitionComplete);

  useEffect(() => {
    completionCallback.current = onTransitionComplete;
  }, [onTransitionComplete]);

  useEffect(() => {
    if (!targetView?.position || !targetView?.target) return;

    desiredCamPos.current.fromArray(targetView.position);
    desiredLookAt.current.fromArray(targetView.target);
    isTransitioning.current = true;
  }, [targetView]);

  useFrame((_, delta) => {
    const controls = controlsRef.current;
    if (!controls || !isTransitioning.current) return;

    // Delta-based exponential easing gives the same smoothness on 30/60/120 Hz displays.
    const safeDelta = Math.min(delta, 0.1);
    const alpha = 1 - Math.exp(-CAMERA_SMOOTHING * safeDelta);

    camera.position.lerp(desiredCamPos.current, alpha);
    controls.target.lerp(desiredLookAt.current, alpha);
    controls.update();

    const positionDistance = camera.position.distanceTo(desiredCamPos.current);
    const targetDistance = controls.target.distanceTo(desiredLookAt.current);

    if (positionDistance <= POSITION_EPSILON && targetDistance <= TARGET_EPSILON) {
      camera.position.copy(desiredCamPos.current);
      controls.target.copy(desiredLookAt.current);
      controls.update();
      isTransitioning.current = false;
      completionCallback.current?.();
    }
  });

  const handleUserControlStart = () => {
    // A manual orbit/pan/zoom immediately takes priority over an automatic flight.
    isTransitioning.current = false;
  };

  return (
    <OrbitControls
      ref={controlsRef}
      enableDamping
      dampingFactor={0.075}
      rotateSpeed={0.72}
      panSpeed={0.78}
      zoomSpeed={0.85}
      maxPolarAngle={Math.PI / 2.05}
      minDistance={4}
      maxDistance={65}
      target={[0, 0, 0]}
      onStart={handleUserControlStart}
    />
  );
}

export default CameraRig;
