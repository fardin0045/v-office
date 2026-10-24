import { memo, useEffect, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { SeatedPerson } from './SeatedPerson';

// Shared with the legend in OfficeScene.
export const DESK_STATUS_THEME = {
  available: { main: '#2dd9d6', emissive: '#0e9895', text: '#107977', textNight: '#5eeae7', glow: 'rgba(45, 217, 214, 0.35)' },
  working: { main: '#10b981', emissive: '#065f46', text: '#047857', textNight: '#34d399', glow: 'rgba(16, 185, 129, 0.4)' },
  occupied: { main: '#f59e0b', emissive: '#92400e', text: '#b45309', textNight: '#fbbf24', glow: 'rgba(245, 158, 11, 0.35)' },
  // Checked in, but the person has closed V-Office (auto-checked-out if they don't return).
  away: { main: '#f59e0b', emissive: '#92400e', text: '#b45309', textNight: '#fbbf24', glow: 'rgba(245, 158, 11, 0.35)' },
  locked: { main: '#94a3b8', emissive: '#475569', text: '#64748b', textNight: '#b4c0cc', glow: 'rgba(148, 163, 184, 0.25)' },
};

const STATUS_LABEL = { available: 'Available', working: 'Working', occupied: 'Occupied', away: 'Away', locked: 'Locked' };

function DeskChair3DComponent({ desk, isSelected, isUserAssigned, isAway, onSelect }) {
  const [hovered, setHovered] = useState(false);
  const pulseRingRef = useRef();

  const { deskId, status = 'available', locked, assignedEmployeeName, position, zone } = desk;
  const { x = 0, y = 0, z = 0, rotation = 0 } = position || {};
  const baseStatus = locked ? 'locked' : resolveStatus(status);
  const statusKey = baseStatus === 'working' && isAway ? 'away' : baseStatus;
  const theme = DESK_STATUS_THEME[statusKey];
  const isWorking = baseStatus === 'working';
  const isLive = statusKey === 'working';
  const highlighted = hovered || isSelected;

  useFrame(({ clock }) => {
    if (!isLive || !pulseRingRef.current) return;
    const scale = 1 + Math.sin(clock.getElapsedTime() * 3) * 0.08;
    pulseRingRef.current.scale.set(scale, scale, scale);
  });

  // Never leave the page with a pointer cursor if the desk unmounts while hovered.
  useEffect(
    () => () => {
      document.body.style.cursor = 'auto';
    },
    []
  );

  const handlePointerOver = (event) => {
    event.stopPropagation();
    setHovered(true);
    document.body.style.cursor = 'pointer';
  };

  const handlePointerOut = (event) => {
    event.stopPropagation();
    setHovered(false);
    document.body.style.cursor = 'auto';
  };

  const handleClick = (event) => {
    event.stopPropagation();
    onSelect(deskId);
  };

  const isCeo = zone === 'ZONE_D';
  const deskWidth = isCeo ? 2.5 : 1.82;
  const deskDepth = isCeo ? 1.12 : 0.92;
  const numberMatch = String(deskId || '').match(/(\d+)(?!.*\d)/);
  const deskNumber = numberMatch ? String(Number(numberMatch[1])).padStart(2, '0') : String(deskId || '');
  const occupantName = isWorking ? desk.currentSessionId?.employeeId?.name : null;
  const occupantId = isWorking ? desk.currentSessionId?.employeeId?._id : null;
  const labelName = occupantName || assignedEmployeeName;
  const firstName = labelName ? labelName.split(' ')[0] : null;
  const employeeLabel = statusKey === 'away' ? [firstName, 'Away'].filter(Boolean).join(' · ') : firstName || STATUS_LABEL[statusKey];

  return (
    <group position={[x, y, z]} rotation={[0, rotation, 0]}>
      {/* Oak desk with matte-black steel frame */}
      <group>
        <RoundedBox args={[deskWidth, 0.09, deskDepth]} radius={0.045} smoothness={3} position={[0, 0.75, 0]} castShadow receiveShadow>
          <meshStandardMaterial color={isCeo ? '#9b6a3f' : '#c99b66'} roughness={0.48} metalness={0.02} />
        </RoundedBox>
        <mesh position={[0, 0.71, deskDepth / 2 - 0.018]}>
          <boxGeometry args={[deskWidth - 0.08, 0.055, 0.035]} />
          <meshStandardMaterial color="#7a5638" roughness={0.62} />
        </mesh>

        <DeskLeg position={[-deskWidth / 2 + 0.12, 0.36, deskDepth / 2 - 0.1]} />
        <DeskLeg position={[deskWidth / 2 - 0.12, 0.36, deskDepth / 2 - 0.1]} />
        <DeskLeg position={[-deskWidth / 2 + 0.12, 0.36, -deskDepth / 2 + 0.1]} />
        <DeskLeg position={[deskWidth / 2 - 0.12, 0.36, -deskDepth / 2 + 0.1]} />

        <mesh position={[0, 0.48, -deskDepth / 2 + 0.08]}>
          <boxGeometry args={[deskWidth - 0.3, 0.25, 0.035]} />
          <meshStandardMaterial color="#2c3033" roughness={0.7} />
        </mesh>

        {/* Monitor, keyboard and desk accessories */}
        <mesh position={[0, 0.85, -0.25]}>
          <cylinderGeometry args={[0.11, 0.13, 0.035, 18]} />
          <meshStandardMaterial color="#1b1e20" metalness={0.58} roughness={0.3} />
        </mesh>
        <mesh position={[0, 0.99, -0.27]}>
          <cylinderGeometry args={[0.025, 0.025, 0.28, 10]} />
          <meshStandardMaterial color="#34383b" metalness={0.72} roughness={0.24} />
        </mesh>
        <RoundedBox
          args={[isCeo ? 1.2 : 0.88, isCeo ? 0.53 : 0.46, 0.055]}
          radius={0.035}
          smoothness={3}
          position={[0, 1.11, -0.23]}
          castShadow
        >
          <meshStandardMaterial color="#141719" roughness={0.32} metalness={0.24} />
        </RoundedBox>
        <mesh position={[0, 1.11, -0.199]}>
          <planeGeometry args={[isCeo ? 1.12 : 0.81, isCeo ? 0.45 : 0.39]} />
          <meshStandardMaterial
            color={isWorking ? '#1f6f5c' : locked ? '#3a3f44' : '#1d5663'}
            emissive={isWorking ? '#0f5a45' : '#0e3d48'}
            emissiveIntensity={0.45}
            roughness={0.38}
          />
        </mesh>

        <RoundedBox args={[0.46, 0.022, 0.16]} radius={0.018} smoothness={2} position={[0, 0.81, 0.14]}>
          <meshStandardMaterial color="#2a2d2f" roughness={0.58} />
        </RoundedBox>
        <mesh position={[0.32, 0.797, 0.14]}>
          <boxGeometry args={[0.2, 0.008, 0.23]} />
          <meshStandardMaterial color="#3c3d3e" roughness={0.82} />
        </mesh>
        <RoundedBox args={[0.065, 0.035, 0.11]} radius={0.02} smoothness={2} position={[0.32, 0.827, 0.14]}>
          <meshStandardMaterial color="#202326" roughness={0.5} />
        </RoundedBox>
        <mesh position={[-0.48, 0.84, 0.16]}>
          <cylinderGeometry args={[0.045, 0.04, 0.1, 14]} />
          <meshStandardMaterial color="#f3efe6" roughness={0.45} />
        </mesh>
        <mesh position={[0.61, 0.83, -0.02]}>
          <cylinderGeometry args={[0.055, 0.045, 0.11, 12]} />
          <meshStandardMaterial color="#e5ddd0" roughness={0.62} />
        </mesh>
        <mesh position={[0.61, 0.94, -0.02]}>
          <sphereGeometry args={[0.1, 10, 8]} />
          <meshStandardMaterial color="#4f7d52" roughness={0.82} />
        </mesh>
      </group>

      {/* Clickable chair */}
      <group
        position={[0, 0, 0.58]}
        onClick={handleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <mesh ref={pulseRingRef} position={[0, 0.014, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.4, 0.455, 36]} />
          <meshBasicMaterial
            color={theme.main}
            transparent
            opacity={highlighted ? 0.9 : isWorking ? 0.6 : 0.35}
            side={THREE.DoubleSide}
            toneMapped={false}
          />
        </mesh>

        {[0, 1, 2, 3, 4].map((index) => (
          <group key={index} rotation={[0, (index * Math.PI * 2) / 5, 0]}>
            <mesh position={[0, 0.075, 0.19]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.022, 0.035, 0.38, 8]} />
              <meshStandardMaterial color="#24282a" metalness={0.68} roughness={0.32} />
            </mesh>
            <mesh position={[0, 0.045, 0.38]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.035, 0.035, 0.075, 10]} />
              <meshStandardMaterial color="#181b1d" roughness={0.48} />
            </mesh>
          </group>
        ))}

        <mesh position={[0, 0.25, 0]}>
          <cylinderGeometry args={[0.035, 0.045, 0.34, 12]} />
          <meshStandardMaterial color="#6d7478" metalness={0.7} roughness={0.2} />
        </mesh>

        <RoundedBox args={[0.55, 0.12, 0.52]} radius={0.09} smoothness={4} position={[0, 0.47, 0]} castShadow>
          <meshStandardMaterial
            color={highlighted ? theme.main : isCeo ? '#2c2926' : '#2a2f33'}
            emissive={highlighted ? theme.emissive : '#000000'}
            emissiveIntensity={highlighted ? 0.3 : 0}
            roughness={0.78}
          />
        </RoundedBox>
        <RoundedBox
          args={[0.51, 0.67, 0.09]}
          radius={0.075}
          smoothness={4}
          position={[0, 0.86, 0.23]}
          rotation={[-0.08, 0, 0]}
          castShadow
        >
          <meshStandardMaterial
            color={highlighted ? theme.main : isCeo ? '#292624' : '#262a2d'}
            emissive={highlighted ? theme.emissive : '#000000'}
            emissiveIntensity={highlighted ? 0.34 : 0}
            roughness={0.74}
          />
        </RoundedBox>
        <mesh position={[0, 0.72, 0.282]} rotation={[-0.08, 0, 0]}>
          <boxGeometry args={[0.38, 0.035, 0.016]} />
          <meshStandardMaterial color="#555b5e" roughness={0.52} />
        </mesh>

        <ArmRest x={-0.28} />
        <ArmRest x={0.28} />

        {/* Someone is at the desk while they are checked in and have V-Office open. */}
        {isLive && <SeatedPerson seed={occupantId || occupantName || deskId} position={[0, 0.53, 0.02]} />}

        {isUserAssigned && (
          <mesh position={[0, isLive ? 1.62 : 1.34, 0.22]} rotation={[0, 0, Math.PI]}>
            <coneGeometry args={[0.075, 0.14, 4]} />
            <meshBasicMaterial color="#14bcb9" toneMapped={false} />
          </mesh>
        )}
      </group>

      {/* Floating desk label */}
      <Html
        position={[0, 1.62, 0.18]}
        center
        distanceFactor={15}
        zIndexRange={[20, 0]}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <div
          className={`w-[84px] rounded-xl border bg-white/30 px-2.5 py-2 text-slate-900 transition-transform duration-200 ${
            isLive ? 'working-desk-animation' : ''
          } ${highlighted ? '-translate-y-0.5 scale-105' : ''}`}
          style={{
            borderColor: highlighted ? theme.main : `${theme.main}99`,
            boxShadow: highlighted
              ? `0 8px 22px ${theme.glow}, 0 0 0 1px ${theme.main}`
              : isLive
                ? undefined
                : '0 4px 12px rgba(15, 23, 42, 0.12)',
          }}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="whitespace-nowrap text-[15px] font-extrabold leading-none tracking-tight">Desk {deskNumber}</span>
            <span
              className={`h-2 w-2 shrink-0 rounded-full ${isLive ? 'animate-pulse' : ''}`}
              style={{ backgroundColor: theme.main }}
            />
          </div>
          <div className="mt-1 flex items-center justify-between gap-1 border-t border-slate-100 pt-1">
            <span
              className="status-text max-w-[54px] truncate whitespace-nowrap text-[9px] font-semibold"
              style={{ '--status-day': theme.text, '--status-night': theme.textNight }}
            >
              {employeeLabel}
            </span>
            {isUserAssigned && (
              <span className="rounded bg-brand px-1 py-0.5 text-[7px] font-black leading-none text-brand-ink">YOU</span>
            )}
          </div>
        </div>
      </Html>
    </group>
  );
}

function resolveStatus(status) {
  return DESK_STATUS_THEME[status] ? status : 'available';
}

function DeskLeg({ position }) {
  return (
    <mesh position={position}>
      <boxGeometry args={[0.055, 0.72, 0.055]} />
      <meshStandardMaterial color="#25292b" metalness={0.58} roughness={0.34} />
    </mesh>
  );
}

function ArmRest({ x }) {
  return (
    <group position={[x, 0.6, 0.04]}>
      <mesh>
        <boxGeometry args={[0.035, 0.24, 0.035]} />
        <meshStandardMaterial color="#3b4144" metalness={0.52} roughness={0.38} />
      </mesh>
      <RoundedBox args={[0.075, 0.035, 0.26]} radius={0.018} smoothness={2} position={[0, 0.12, 0]}>
        <meshStandardMaterial color="#202426" roughness={0.64} />
      </RoundedBox>
    </group>
  );
}

// Only desks whose data or selection changed re-render when a realtime update arrives.
export const DeskChair3D = memo(DeskChair3DComponent);
export default DeskChair3D;
