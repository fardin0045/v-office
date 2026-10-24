import React from 'react';

const WALL_TRIM = '#b8c4c4';
const GLASS = '#cdeeee';

// Day: warm light concrete. Night: dark polished concrete with a soft sheen that picks up the
// ceiling spots, charcoal walls and a deep blue night sky behind the windows.
const PALETTE = {
  day: {
    floor: '#f1eee8', floorRough: 0.86, floorMetal: 0.02, joints: '#d8d2c8', jointLine: '#cfc8bc', jointOpacity: 0.5,
    rugs: ['#e3ddd3', '#d8cdbd', '#e7e3dc', '#e5e0d8'], wall: '#e4eaea',
    window: '#bfe7ec', windowGlow: '#000000', windowGlowIntensity: 0,
  },
  night: {
    floor: '#353d42', floorRough: 0.48, floorMetal: 0.12, joints: '#434c52', jointLine: '#454f55', jointOpacity: 0.28,
    rugs: ['#40464a', '#463d35', '#3c4448', '#3f4549'], wall: '#2b3337',
    window: '#0f2436', windowGlow: '#16395a', windowGlowIntensity: 0.55,
  },
};

export function OfficeFloor({ night = false }) {
  const c = PALETTE[night ? 'night' : 'day'];
  const WALL = c.wall;
  return (
    <group>
      {/* Light warm concrete floor. */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.035, 0]}
        receiveShadow
      >
        <planeGeometry args={[52, 42]} />
        <meshStandardMaterial
          color={c.floor}
          roughness={c.floorRough}
          metalness={c.floorMetal}
        />
      </mesh>

      {/* Fine large-format concrete tile joints. */}
      <gridHelper
        key={night ? 'night-grid' : 'day-grid'}
        args={[52, 26, c.joints, c.joints]}
        position={[0, -0.012, 0]}
      >
        <lineBasicMaterial
          attach="material"
          color={c.jointLine}
          transparent
          opacity={c.jointOpacity}
        />
      </gridHelper>

      {/* Area rugs visually group the lounge, CEO suite, engineering room, and corner team. */}
      <FloorInset
        position={[-18, -0.005, 3.8]}
        size={[8.5, 5.8]}
        color={c.rugs[0]}
      />
      <FloorInset
        position={[-17.5, -0.003, -13.5]}
        size={[8.6, 8.6]}
        color={c.rugs[1]}
      />
      <FloorInset
        position={[18.3, -0.002, -4]}
        size={[8.2, 20]}
        color={c.rugs[2]}
      />
      <FloorInset
        position={[18, -0.003, 15.7]}
        size={[8.6, 7.1]}
        color={c.rugs[3]}
      />

      {/* Back wall and panoramic windows. */}
      <mesh position={[0, 2.45, -20]} receiveShadow>
        <boxGeometry args={[52, 4.9, 0.46]} />
        <meshStandardMaterial color={WALL} roughness={0.68} />
      </mesh>

      <mesh position={[0, 3.05, -19.755]}>
        <planeGeometry args={[43.5, 2.7]} />
        <meshPhysicalMaterial
          color={c.window}
          emissive={c.windowGlow}
          emissiveIntensity={c.windowGlowIntensity}
          roughness={0.22}
          metalness={0.05}
          transmission={0.38}
          transparent
          opacity={0.72}
        />
      </mesh>

      {/* Window head, sill, and repeated mullions. */}
      <FrameBeam position={[0, 4.48, -19.68]} size={[44, 0.12, 0.14]} />
      <FrameBeam position={[0, 1.62, -19.68]} size={[44, 0.12, 0.14]} />
      {[-21, -17.5, -14, -10.5, -7, -3.5, 0, 3.5, 7, 10.5, 14, 17.5, 21].map(
        (x) => (
          <FrameBeam
            key={x}
            position={[x, 3.05, -19.67]}
            size={[0.09, 2.9, 0.14]}
          />
        ),
      )}

      {/* Side walls remain tall; the front wall is cut down for the dollhouse view. */}
      <mesh position={[-25.5, 2.45, 0]} receiveShadow>
        <boxGeometry args={[0.46, 4.9, 40]} />
        <meshStandardMaterial color={WALL} roughness={0.68} />
      </mesh>
      <mesh position={[25.5, 2.45, 0]} receiveShadow>
        <boxGeometry args={[0.46, 4.9, 40]} />
        <meshStandardMaterial color={WALL} roughness={0.68} />
      </mesh>
      <mesh position={[0, 0.6, 20]} receiveShadow>
        <boxGeometry args={[52, 1.2, 0.5]} />
        <meshStandardMaterial color={WALL} roughness={0.62} />
      </mesh>

      {/* Thick charcoal caps create the architectural cutaway edge. */}
      <FrameBeam position={[0, 4.95, -20]} size={[52.5, 0.28, 0.62]} />
      <FrameBeam position={[-25.5, 4.95, 0]} size={[0.62, 0.28, 40.5]} />
      <FrameBeam position={[25.5, 4.95, 0]} size={[0.62, 0.28, 40.5]} />
      <FrameBeam position={[0, 1.28, 20]} size={[52.5, 0.18, 0.62]} />

      {/* Warm perimeter cove lights. */}
      <LightStrip position={[0, 4.6, -19.58]} size={[50.5, 0.055, 0.055]} />
      <LightStrip position={[-25.08, 4.55, 0]} size={[0.055, 0.055, 39]} />
      <LightStrip position={[25.08, 4.55, 0]} size={[0.055, 0.055, 39]} />
      <LightStrip position={[0, 1.12, 19.62]} size={[50.5, 0.045, 0.045]} />

      {/* CEO private suite: clear glass with dark frames. */}
      <GlassWall position={[-19.5, 2.05, -9]} size={[5, 4.1, 0.08]} />
      <GlassWall position={[-13, 2.05, -13.5]} size={[0.08, 4.1, 9]} />
      <FrameBeam position={[-17.5, 4.14, -9]} size={[9, 0.14, 0.16]} />
      <FrameBeam position={[-13, 4.14, -13.5]} size={[0.16, 0.14, 9]} />
      <FrameBeam position={[-22, 2.05, -9]} size={[0.12, 4.1, 0.14]} />
      <FrameBeam position={[-17, 2.05, -9]} size={[0.12, 4.1, 0.14]} />
      <FrameBeam position={[-15.45, 2.05, -9]} size={[0.12, 4.1, 0.14]} />
      <FrameBeam position={[-13, 2.05, -9]} size={[0.12, 4.1, 0.14]} />

      {/* CEO timber feature wall. */}
      <mesh position={[-17.5, 2.15, -19.58]} receiveShadow>
        <boxGeometry args={[8.2, 4.25, 0.16]} />
        <meshStandardMaterial color="#8a6a4f" roughness={0.72} />
      </mesh>
      {[-20.6, -19.8, -19, -18.2, -17.4, -16.6, -15.8, -15, -14.2].map((x) => (
        <mesh key={x} position={[x, 2.15, -19.47]}>
          <boxGeometry args={[0.035, 4.1, 0.025]} />
          <meshStandardMaterial color="#a8876a" roughness={0.8} />
        </mesh>
      ))}

      {/* Engineering suite on the right. */}
      <GlassWall position={[13.5, 2.05, -4]} size={[0.08, 4.1, 22]} />
      <FrameBeam position={[13.5, 4.14, -4]} size={[0.16, 0.14, 22]} />
      <FrameBeam position={[13.5, 2.05, 7]} size={[0.14, 4.1, 0.16]} />
      <FrameBeam position={[13.5, 2.05, 2.4]} size={[0.14, 4.1, 0.16]} />
      <FrameBeam position={[13.5, 2.05, -4]} size={[0.14, 4.1, 0.16]} />
      <FrameBeam position={[13.5, 2.05, -10.4]} size={[0.14, 4.1, 0.16]} />
      <FrameBeam position={[13.5, 2.05, -15]} size={[0.14, 4.1, 0.16]} />

      {/* Open glass entrance at the front centre. */}
      <GlassWall position={[-4.4, 1.45, 19.55]} size={[3.6, 2.9, 0.08]} />
      <GlassWall position={[4.4, 1.45, 19.55]} size={[3.6, 2.9, 0.08]} />
      <FrameBeam position={[-6.2, 1.45, 19.5]} size={[0.12, 2.9, 0.14]} />
      <FrameBeam position={[-2.6, 1.45, 19.5]} size={[0.12, 2.9, 0.14]} />
      <FrameBeam position={[2.6, 1.45, 19.5]} size={[0.12, 2.9, 0.14]} />
      <FrameBeam position={[6.2, 1.45, 19.5]} size={[0.12, 2.9, 0.14]} />
    </group>
  );
}

function FloorInset({ position, size, color }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={position} receiveShadow>
      <planeGeometry args={size} />
      <meshStandardMaterial color={color} roughness={0.96} metalness={0} />
    </mesh>
  );
}

function FrameBeam({ position, size }) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={WALL_TRIM}
        metalness={0.48}
        roughness={0.36}
      />
    </mesh>
  );
}

function LightStrip({ position, size }) {
  return (
    <mesh position={position}>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color="#ffe8bd"
        emissive="#ffcf87"
        emissiveIntensity={3.2}
        toneMapped={false}
      />
    </mesh>
  );
}

function GlassWall({ position, size }) {
  return (
    <mesh position={position}>
      <boxGeometry args={size} />
      <meshPhysicalMaterial
        color={GLASS}
        roughness={0.08}
        metalness={0.05}
        transmission={0.72}
        thickness={0.12}
        transparent
        opacity={0.28}
      />
    </mesh>
  );
}

export default OfficeFloor;
