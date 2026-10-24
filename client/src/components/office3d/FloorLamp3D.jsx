import { memo, useEffect, useState } from 'react';
import { Html } from '@react-three/drei';
import * as THREE from 'three';

// One floor lamp at the front of every zone. Positions sit on free floor, clear of desks and walkways.
export const ZONE_LAMPS = [
  { id: 'front-office', label: 'Front office', position: [-13.2, 0, 9.4] },
  { id: 'lounge', label: 'Lounge', position: [-21.4, 0, 6.2] },
  { id: 'pods', label: 'Pods', position: [-11.3, 0, -0.8] },
  { id: 'ceo', label: 'CEO suite', position: [-14, 0, -10] },
  { id: 'meeting', label: 'Meeting room', position: [1.7, 0, -11.3] },
  { id: 'business', label: 'Business team', position: [14.3, 0, 18.4] },
  { id: 'engineering', label: 'Engineering', position: [22.3, 0, 6.3] },
];

const WARM = '#ffc98a';
const BRASS = '#b08d57';
const POLE_H = 1.92;

// A soft radial pool of light on the floor, drawn once and shared by every lamp.
let poolTexture = null;
function getPoolTexture() {
  if (poolTexture || typeof document === 'undefined') return poolTexture;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  g.addColorStop(0, 'rgba(255, 205, 140, 0.9)');
  g.addColorStop(0.45, 'rgba(255, 190, 120, 0.35)');
  g.addColorStop(1, 'rgba(255, 180, 110, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  poolTexture = new THREE.CanvasTexture(canvas);
  poolTexture.colorSpace = THREE.SRGBColorSpace;
  return poolTexture;
}

/**
 * Floor lamp with a fabric drum shade. At night a lit lamp glows, casts warm light on its zone
 * and leaves a light pool on the floor; clicking it switches it. By day it is simply furniture.
 * The point light stays mounted while off (intensity 0) so switching never recompiles shaders.
 */
function FloorLamp3DComponent({ id, label, position, on, night, onToggle }) {
  const [hovered, setHovered] = useState(false);
  const lit = night && on;
  const interactive = night;

  useEffect(
    () => () => {
      document.body.style.cursor = 'auto';
    },
    []
  );

  const handlers = interactive
    ? {
        onClick: (e) => {
          e.stopPropagation();
          onToggle(id);
        },
        onPointerOver: (e) => {
          e.stopPropagation();
          setHovered(true);
          document.body.style.cursor = 'pointer';
        },
        onPointerOut: (e) => {
          e.stopPropagation();
          setHovered(false);
          document.body.style.cursor = 'auto';
        },
      }
    : {};

  return (
    <group position={position}>
      <group {...handlers}>
        {/* Weighted base with a brass ring */}
        <mesh position={[0, 0.025, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.24, 0.26, 0.05, 32]} />
          <meshStandardMaterial color="#1c2023" metalness={0.6} roughness={0.35} />
        </mesh>
        <mesh position={[0, 0.052, 0]}>
          <torusGeometry args={[0.2, 0.008, 8, 40]} />
          <meshStandardMaterial color={BRASS} metalness={0.85} roughness={0.25} />
        </mesh>

        {/* Slim brass pole */}
        <mesh position={[0, POLE_H / 2 + 0.05, 0]} castShadow>
          <cylinderGeometry args={[0.018, 0.024, POLE_H, 12]} />
          <meshStandardMaterial color={BRASS} metalness={0.85} roughness={0.28} />
        </mesh>

        {/* Bulb */}
        <mesh position={[0, POLE_H - 0.02, 0]}>
          <sphereGeometry args={[0.06, 16, 12]} />
          <meshStandardMaterial
            color={lit ? '#fff4dc' : '#d8d2c6'}
            emissive={lit ? '#ffd9a0' : '#000000'}
            emissiveIntensity={lit ? 3 : 0}
            toneMapped={!lit}
          />
        </mesh>

        {/* Fabric drum shade: glows warm from inside when on */}
        <mesh position={[0, POLE_H + 0.06, 0]} castShadow>
          <cylinderGeometry args={[0.24, 0.31, 0.36, 36, 1, true]} />
          <meshStandardMaterial
            color={lit ? '#fff1d6' : '#ece4d4'}
            emissive={lit ? WARM : hovered ? '#3a3226' : '#000000'}
            emissiveIntensity={lit ? (hovered ? 1.6 : 1.25) : 0.4}
            roughness={0.9}
            side={THREE.DoubleSide}
          />
        </mesh>
        <mesh position={[0, POLE_H + 0.24, 0]}>
          <torusGeometry args={[0.24, 0.007, 6, 36]} />
          <meshStandardMaterial color={BRASS} metalness={0.85} roughness={0.28} />
        </mesh>
        <mesh position={[0, POLE_H - 0.12, 0]}>
          <torusGeometry args={[0.31, 0.007, 6, 36]} />
          <meshStandardMaterial color={BRASS} metalness={0.85} roughness={0.28} />
        </mesh>
      </group>

      {/* Hover ring shows the lamp is switchable */}
      {interactive && hovered && (
        <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.34, 0.39, 40]} />
          <meshBasicMaterial color={lit ? WARM : '#94a3b8'} transparent opacity={0.85} toneMapped={false} />
        </mesh>
      )}

      {night && (
        <>
          <pointLight position={[0, POLE_H - 0.05, 0]} color={WARM} intensity={lit ? 9 : 0} distance={8} decay={1.6} />
          <mesh position={[0, 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]} visible={lit} renderOrder={1}>
            <circleGeometry args={[2.4, 40]} />
            <meshBasicMaterial map={getPoolTexture()} transparent depthWrite={false} opacity={0.55} blending={THREE.AdditiveBlending} toneMapped={false} />
          </mesh>
        </>
      )}

      {interactive && hovered && (
        <Html position={[0, POLE_H + 0.62, 0]} center distanceFactor={14} zIndexRange={[25, 0]} style={{ pointerEvents: 'none' }}>
          <div className="whitespace-nowrap rounded-full bg-elevated/95 px-2.5 py-1 text-[11px] font-semibold text-ink shadow-pop ring-1 ring-slate-200">
            {label} lamp · {on ? 'click to turn off' : 'click to turn on'}
          </div>
        </Html>
      )}
    </group>
  );
}

export const FloorLamp3D = memo(FloorLamp3DComponent);
export default FloorLamp3D;
