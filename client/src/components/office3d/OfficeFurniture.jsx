import React from 'react';
import { RoundedBox, Text, useTexture } from '@react-three/drei';
import * as THREE from 'three';
import { SeatedPerson } from './SeatedPerson';
import { useTheme } from '../../lib/theme';

const OAK = '#b88955';
const OAK_LIGHT = '#c99b66';
const BLACK = '#171a1d';
const FABRIC = '#cfd6d6';
const METAL = '#34383b';

export function OfficeFurniture() {
  // Floor lettering is painted on the floor, so it needs a lighter tone on the dark night floor.
  const floorText = useTheme().isDark ? '#a9b8bf' : '#7c8a8a';
  return (
    <group>
      {/* Guest lounge: pale modular sofa with a timber coffee table. */}
      <group position={[-18, 0, 3.8]}>
        <SofaSection position={[0, 0, -0.62]} width={3.2} sitters={[{ x: -0.7, seed: 'lounge-guest-1' }, { x: 0.75, seed: 'lounge-guest-3' }]} />
        <SofaSection position={[-1.55, 0, 0.38]} width={1.9} rotation={Math.PI / 2} sitters={[{ x: 0.2, seed: 'lounge-guest-2' }]} />
        <SofaSection position={[1.55, 0, 0.38]} width={1.9} rotation={-Math.PI / 2} />

        <group position={[0, 0, 1.25]}>
          <RoundedBox args={[1.65, 0.08, 0.78]} radius={0.05} smoothness={3} position={[0, 0.39, 0]} castShadow>
            <meshStandardMaterial color={OAK_LIGHT} roughness={0.5} />
          </RoundedBox>
          <mesh position={[0, 0.2, 0]} castShadow>
            <cylinderGeometry args={[0.36, 0.48, 0.38, 20]} />
            <meshStandardMaterial color={BLACK} roughness={0.55} />
          </mesh>
          <mesh position={[0, 0.45, 0]} castShadow>
            <cylinderGeometry args={[0.12, 0.1, 0.12, 16]} />
            <meshStandardMaterial color="#ded8cb" roughness={0.5} />
          </mesh>
          <PlantLeaves position={[0, 0.62, 0]} scale={0.42} />
        </group>
      </group>

      {/* CEO room storage, display wall and guest seating. */}
      <group position={[-17.5, 0, -18.75]}>
        <RoundedBox args={[3.4, 1.12, 0.52]} radius={0.05} smoothness={3} position={[0, 0.56, 0]} castShadow>
          <meshStandardMaterial color="#2d2119" roughness={0.62} />
        </RoundedBox>
        {[-1.08, 0, 1.08].map((x) => (
          <mesh key={x} position={[x, 0.57, 0.27]}>
            <boxGeometry args={[0.015, 0.82, 0.02]} />
            <meshStandardMaterial color="#6f5540" roughness={0.7} />
          </mesh>
        ))}
        <mesh position={[-0.78, 1.27, 0]} castShadow>
          <boxGeometry args={[0.62, 0.16, 0.22]} />
          <meshStandardMaterial color="#4f6571" roughness={0.5} />
        </mesh>
        <mesh position={[0.72, 1.3, 0]} castShadow>
          <cylinderGeometry args={[0.07, 0.1, 0.28, 10]} />
          <meshStandardMaterial color="#bd8d43" metalness={0.68} roughness={0.24} />
        </mesh>
      </group>

      <GuestChair position={[-18.35, 0, -12.25]} rotation={Math.PI} />
      <GuestChair position={[-16.7, 0, -12.25]} rotation={Math.PI} />

      {/* Arbree Solutions logo on the CEO timber wall. */}
      <BrandLogo position={[-17.5, 2.6, -19.44]} />

      <Text
        position={[-17.5, 0.035, -10.25]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.42}
        color={floorText}
        anchorX="center"
        anchorY="middle"
      >
        CEO ROOM
      </Text>

      <PottedPlant position={[-21, 0, -10.7]} scale={1.25} />
      <PottedPlant position={[-14.1, 0, -18.2]} scale={0.92} />

      {/* Reception desk at the front entrance. */}
      <group position={[0, 0, 16.55]}>
        <RoundedBox args={[4.45, 1.16, 1.25]} radius={0.08} smoothness={3} position={[0, 0.6, 0]} castShadow receiveShadow>
          <meshStandardMaterial color="#ece7dd" roughness={0.54} />
        </RoundedBox>
        <RoundedBox args={[4.65, 0.08, 1.37]} radius={0.035} smoothness={3} position={[0, 1.21, 0]} castShadow>
          <meshStandardMaterial color={OAK_LIGHT} roughness={0.45} />
        </RoundedBox>
        <mesh position={[0, 0.63, 0.631]}>
          <planeGeometry args={[3.15, 0.53]} />
          <meshStandardMaterial color="#292c2e" roughness={0.38} />
        </mesh>
        <Text position={[0, 0.63, 0.645]} fontSize={0.25} color="#f0dec2" anchorX="center" anchorY="middle">
          V — OFFICE
        </Text>

        <mesh position={[-0.7, 1.37, -0.08]} castShadow>
          <boxGeometry args={[0.75, 0.42, 0.035]} />
          <meshStandardMaterial color="#101315" roughness={0.35} />
        </mesh>
        <mesh position={[-0.7, 1.38, -0.055]}>
          <planeGeometry args={[0.68, 0.35]} />
          <meshBasicMaterial color="#193746" />
        </mesh>
      </group>

      {/* Coffee and water station, styled like built-in cabinetry. */}
      <group position={[23.45, 0, 12]}>
        <RoundedBox args={[1.55, 1.08, 3.4]} radius={0.05} smoothness={3} position={[0, 0.54, 0]} castShadow>
          <meshStandardMaterial color="#e9eeee" roughness={0.62} />
        </RoundedBox>
        <RoundedBox args={[1.65, 0.06, 3.5]} radius={0.03} smoothness={3} position={[0, 1.11, 0]} castShadow>
          <meshStandardMaterial color={OAK} roughness={0.5} />
        </RoundedBox>
        <mesh position={[0, 1.42, -0.86]} castShadow>
          <cylinderGeometry args={[0.2, 0.2, 0.62, 20]} />
          <meshPhysicalMaterial color="#a9d1dd" transparent opacity={0.58} transmission={0.62} roughness={0.12} />
        </mesh>
        <RoundedBox args={[0.54, 0.46, 0.44]} radius={0.05} smoothness={3} position={[0, 1.36, 0.68]} castShadow>
          <meshStandardMaterial color="#4a4e50" metalness={0.68} roughness={0.24} />
        </RoundedBox>
      </group>

      {/* Full-height illuminated Arbree Solutions feature wall. */}
      <BrandWall position={[-25.22, 2.5, 4.5]} rotation={[0, Math.PI / 2, 0]} />

      {/* Decorative plants around the open office and room corners. */}
      <PottedPlant position={[-11.5, 0, 10]} scale={0.95} />
      <PottedPlant position={[11.4, 0, 10]} scale={0.95} />
      <PottedPlant position={[-11.45, 0, -7.9]} scale={1.0} />
      <PottedPlant position={[11.5, 0, -8]} scale={1.0} />
      <PottedPlant position={[14.65, 0, 5.4]} scale={0.88} />
      <PottedPlant position={[21.7, 0, -14.2]} scale={1.15} />
      <PottedPlant position={[-23.4, 0, 16.7]} scale={0.88} />
      <PottedPlant position={[23.3, 0, 17.6]} scale={0.9} />

      {/* Green anchors around the Business Team corner cluster. */}
      <PottedPlant position={[14.2, 0, 12.5]} scale={0.82} />
      <PottedPlant position={[22.1, 0, 18.1]} scale={0.9} />
      <Text
        position={[18, 0.035, 11.95]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.34}
        color={floorText}
        anchorX="center"
        anchorY="middle"
      >
        BUSINESS TEAM
      </Text>
    </group>
  );
}

function SofaSection({ position, width, rotation = 0, sitters = [] }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* Guests relaxing on the sofa, facing the coffee table. */}
      {sitters.map((s) => (
        <SeatedPerson key={s.seed} seed={s.seed} pose="relaxed" position={[s.x, 0.49, 0.02]} rotation={Math.PI} />
      ))}
      <RoundedBox args={[width, 0.38, 0.92]} radius={0.12} smoothness={4} position={[0, 0.3, 0]} castShadow>
        <meshStandardMaterial color={FABRIC} roughness={0.94} />
      </RoundedBox>
      <RoundedBox args={[width, 0.64, 0.22]} radius={0.09} smoothness={4} position={[0, 0.68, -0.38]} castShadow>
        <meshStandardMaterial color="#bcc5c5" roughness={0.92} />
      </RoundedBox>
      <mesh position={[-width / 2 + 0.2, 0.08, 0.26]}>
        <cylinderGeometry args={[0.025, 0.025, 0.16, 8]} />
        <meshStandardMaterial color={METAL} metalness={0.75} roughness={0.25} />
      </mesh>
      <mesh position={[width / 2 - 0.2, 0.08, 0.26]}>
        <cylinderGeometry args={[0.025, 0.025, 0.16, 8]} />
        <meshStandardMaterial color={METAL} metalness={0.75} roughness={0.25} />
      </mesh>
    </group>
  );
}

function GuestChair({ position, rotation }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <RoundedBox args={[0.62, 0.11, 0.57]} radius={0.08} smoothness={3} position={[0, 0.48, 0]} castShadow>
        <meshStandardMaterial color="#34302c" roughness={0.72} />
      </RoundedBox>
      <RoundedBox args={[0.6, 0.62, 0.1]} radius={0.06} smoothness={3} position={[0, 0.82, 0.24]} castShadow>
        <meshStandardMaterial color="#302c29" roughness={0.72} />
      </RoundedBox>
      {[-0.23, 0.23].map((x) => (
        <mesh key={x} position={[x, 0.23, 0]}>
          <cylinderGeometry args={[0.022, 0.022, 0.46, 8]} />
          <meshStandardMaterial color={METAL} metalness={0.74} roughness={0.28} />
        </mesh>
      ))}
    </group>
  );
}

const LOGO_URL = '/arbree-solutions.png';
const configureLogo = (loaded) => {
  loaded.colorSpace = THREE.SRGBColorSpace;
  loaded.anisotropy = 8;
  loaded.needsUpdate = true;
};

// Framed square logo panel with a soft backlight halo.
function BrandLogo({ position }) {
  const texture = useTexture(LOGO_URL, configureLogo);
  return (
    <group position={position}>
      <RoundedBox args={[2.36, 2.26, 0.1]} radius={0.05} smoothness={4} castShadow>
        <meshStandardMaterial color="#181c1e" roughness={0.38} metalness={0.45} />
      </RoundedBox>
      <mesh position={[0, 0, 0.056]}>
        <planeGeometry args={[2.16, 2.06]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
      <mesh position={[0, 1.2, 0.03]}>
        <boxGeometry args={[2.2, 0.035, 0.035]} />
        <meshStandardMaterial color="#fff0d5" emissive="#ffd79b" emissiveIntensity={3} toneMapped={false} />
      </mesh>
    </group>
  );
}

function BrandWall({ position, rotation }) {
  // Configure the texture once, when it loads, instead of mutating it on every render.
  const texture = useTexture(LOGO_URL, configureLogo);

  return (
    <group position={position} rotation={rotation}>
      {/* Dark reveal frame and warm backlight around the brand panel. */}
      <RoundedBox args={[14.6, 4.35, 0.2]} radius={0.08} smoothness={4} position={[0, 0, -0.04]} castShadow>
        <meshStandardMaterial color="#181c1e" roughness={0.38} metalness={0.45} />
      </RoundedBox>

      <RoundedBox args={[14.12, 3.92, 0.08]} radius={0.06} smoothness={4} position={[0, 0, 0.08]}>
        <meshStandardMaterial
          color="#53ece9"
          emissive="#14bcb9"
          emissiveIntensity={0.35}
          roughness={0.34}
        />
      </RoundedBox>

      <mesh position={[0, 0, 0.22]} renderOrder={10}>
        <planeGeometry args={[13.92, 3.72]} />
        <meshBasicMaterial
          map={texture}
          side={THREE.DoubleSide}
          toneMapped={false}
          depthWrite={false}
          polygonOffset
          polygonOffsetFactor={-4}
          polygonOffsetUnits={-4}
        />
      </mesh>

      {/* Slim light bars make the complete side wall read as a feature installation. */}
      <mesh position={[0, 2.08, 0.12]}>
        <boxGeometry args={[14.05, 0.045, 0.045]} />
        <meshStandardMaterial color="#fff0d5" emissive="#ffd79b" emissiveIntensity={3} toneMapped={false} />
      </mesh>
      <mesh position={[0, -2.08, 0.12]}>
        <boxGeometry args={[14.05, 0.045, 0.045]} />
        <meshStandardMaterial color="#fff0d5" emissive="#ffd79b" emissiveIntensity={3} toneMapped={false} />
      </mesh>
      <mesh position={[-7.22, 0, 0.12]}>
        <boxGeometry args={[0.045, 4.05, 0.045]} />
        <meshStandardMaterial color="#fff0d5" emissive="#ffd79b" emissiveIntensity={3} toneMapped={false} />
      </mesh>
      <mesh position={[7.22, 0, 0.12]}>
        <boxGeometry args={[0.045, 4.05, 0.045]} />
        <meshStandardMaterial color="#fff0d5" emissive="#ffd79b" emissiveIntensity={3} toneMapped={false} />
      </mesh>
    </group>
  );
}

export function PottedPlant({ position, scale = 1 }) {
  return (
    <group position={position} scale={[scale, scale, scale]}>
      <mesh position={[0, 0.35, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.31, 0.24, 0.7, 18]} />
        <meshStandardMaterial color="#2b2d2d" roughness={0.76} />
      </mesh>
      <mesh position={[0, 0.69, 0]}>
        <cylinderGeometry args={[0.285, 0.285, 0.045, 18]} />
        <meshStandardMaterial color="#3b2a1d" roughness={1} />
      </mesh>
      <mesh position={[0, 1.04, 0]} castShadow>
        <cylinderGeometry args={[0.025, 0.04, 0.72, 9]} />
        <meshStandardMaterial color="#375138" roughness={0.8} />
      </mesh>
      <PlantLeaves position={[0, 1.25, 0]} />
    </group>
  );
}

function PlantLeaves({ position, scale = 1 }) {
  const leaves = [
    [0.18, 0.08, 0.05, 0.52, 0.18, 0.28],
    [-0.2, 0.02, -0.08, 0.55, 0.2, 0.3],
    [0.05, 0.25, -0.14, 0.48, 0.19, 0.31],
    [-0.08, 0.28, 0.16, 0.5, 0.18, 0.27],
    [0.27, 0.31, -0.03, 0.43, 0.16, 0.25],
    [-0.27, 0.35, 0.02, 0.44, 0.17, 0.26],
  ];

  return (
    <group position={position} scale={[scale, scale, scale]}>
      {leaves.map(([x, y, z, sx, sy, sz], index) => (
        <mesh
          key={index}
          position={[x, y, z]}
          scale={[sx, sy, sz]}
          rotation={[0.2 * index, 0.7 * index, index % 2 ? -0.25 : 0.25]}
          castShadow
        >
          <sphereGeometry args={[1, 12, 8]} />
          <meshStandardMaterial color={index % 3 === 0 ? '#426b3d' : '#315b34'} roughness={0.82} />
        </mesh>
      ))}
    </group>
  );
}

export default OfficeFurniture;
