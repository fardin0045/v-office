import { memo, useEffect, useMemo, useState } from 'react';
import { Html, RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import { PottedPlant } from './OfficeFurniture';
import { SeatedPerson } from './SeatedPerson';
import { useTheme } from '../../lib/theme';

// Meeting room footprint: east of the CEO suite with a wide 6.5-unit corridor between the two glass walls,
// against the back wall, and ~5 units clear of the open-workspace pods in front.
export const MEETING_ROOM = {
  minX: -6.5,
  maxX: 2.5,
  minZ: -19.7,
  maxZ: -10.5,
  center: [-2, 0, -15.1],
  doorWidth: 2.2,
};

const WALL_H = 3.6;
const GLASS = '#cdeeee';
const FRAME = '#b8c4c4';

const { minX, maxX, minZ, maxZ } = MEETING_ROOM;
const cx = (minX + maxX) / 2;
const cz = (minZ + maxZ) / 2;
const width = maxX - minX;
const depth = maxZ - minZ;

// 10 seats around the table; rotation makes each chair face the table (chairs face -z by default).
// The far side (facing the door and the camera) fills first, so people's faces are visible.
const SEATS = [
  ...[-0.65, 0.65, -1.95, 1.95].map((dx) => ({ x: cx + dx, z: cz - 1.55, r: Math.PI })),
  ...[-0.65, 0.65, -1.95, 1.95].map((dx) => ({ x: cx + dx, z: cz + 1.55, r: 0 })),
  { x: cx - 3.3, z: cz, r: -Math.PI / 2 },
  { x: cx + 3.3, z: cz, r: Math.PI / 2 },
];

const THEME = {
  live: { accent: '#10b981', text: '#047857', textNight: '#34d399', screen: '#1f6f5c', emissive: '#0f5a45' },
  soon: { accent: '#2dd9d6', text: '#107977', textNight: '#5eeae7', screen: '#1d5663', emissive: '#0e3d48' },
  idle: { accent: '#94a3b8', text: '#475569', textNight: '#b4c0cc', screen: '#2c3338', emissive: '#12181b' },
};

function Glass({ position, size }) {
  return (
    <mesh position={position}>
      <boxGeometry args={size} />
      <meshPhysicalMaterial color={GLASS} roughness={0.08} metalness={0.05} transmission={0.72} thickness={0.12} transparent opacity={0.28} />
    </mesh>
  );
}

function Beam({ position, size }) {
  return (
    <mesh position={position} castShadow receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial color={FRAME} metalness={0.48} roughness={0.36} />
    </mesh>
  );
}

function MeetingChair({ x, z, r, person, accent }) {
  const occupied = Boolean(person);
  const seatColor = occupied ? accent : '#2a2f33';
  return (
    <group position={[x, 0, z]} rotation={[0, r, 0]}>
      <mesh position={[0, 0.23, 0]}>
        <cylinderGeometry args={[0.035, 0.045, 0.34, 12]} />
        <meshStandardMaterial color="#6d7478" metalness={0.7} roughness={0.2} />
      </mesh>
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[0.26, 0.28, 0.04, 20]} />
        <meshStandardMaterial color="#24282a" metalness={0.6} roughness={0.35} />
      </mesh>
      <RoundedBox args={[0.52, 0.11, 0.5]} radius={0.08} smoothness={3} position={[0, 0.46, 0]} castShadow>
        <meshStandardMaterial color={seatColor} emissive={occupied ? accent : '#000000'} emissiveIntensity={occupied ? 0.25 : 0} roughness={0.75} />
      </RoundedBox>
      <RoundedBox args={[0.5, 0.6, 0.08]} radius={0.07} smoothness={3} position={[0, 0.82, 0.22]} rotation={[-0.08, 0, 0]} castShadow>
        <meshStandardMaterial color={seatColor} emissive={occupied ? accent : '#000000'} emissiveIntensity={occupied ? 0.25 : 0} roughness={0.72} />
      </RoundedBox>
      {person && <SeatedPerson seed={person.user._id} position={[0, 0.515, 0.02]} />}
    </group>
  );
}

function MeetingRoom3DComponent({ current, next, participants = [], selected, signedIn, onSelect }) {
  const [hovered, setHovered] = useState(false);
  const { isDark } = useTheme();

  useEffect(
    () => () => {
      document.body.style.cursor = 'auto';
    },
    []
  );

  const state = current ? 'live' : next ? 'soon' : 'idle';
  const theme = THEME[state];
  const highlighted = hovered || selected;
  const seated = participants.slice(0, SEATS.length);
  const overflow = Math.max(0, participants.length - SEATS.length);

  const statusLine = useMemo(() => {
    if (!signedIn) return 'Sign in to see meetings';
    if (current) return `Live · ${participants.length} joined`;
    if (next) {
      const t = new Date(next.startsAt);
      const sameDay = t.toDateString() === new Date().toDateString();
      return `Next · ${sameDay ? '' : `${t.toLocaleDateString([], { weekday: 'short' })} `}${t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    return 'Available';
  }, [signedIn, current, next, participants.length]);

  const handlers = {
    onClick: (e) => {
      e.stopPropagation();
      onSelect();
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
  };

  const doorLeft = cx - MEETING_ROOM.doorWidth / 2;
  const doorRight = cx + MEETING_ROOM.doorWidth / 2;
  const frontLeftLen = doorLeft - minX;
  const frontRightLen = maxX - doorRight;

  return (
    <group>
      {/* Clickable carpet covering the whole room */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[cx, -0.004, cz]} receiveShadow {...handlers}>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial
          color={isDark ? (highlighted ? '#2c4a4c' : '#39434a') : highlighted ? '#d9f6f5' : '#e3ebeb'}
          emissive={highlighted ? theme.accent : '#000000'}
          emissiveIntensity={highlighted ? 0.08 : 0}
          roughness={0.95}
        />
      </mesh>

      {/* Glass walls: west, east, and front with a centred door opening */}
      <Glass position={[minX, WALL_H / 2, cz]} size={[0.08, WALL_H, depth]} />
      <Glass position={[maxX, WALL_H / 2, cz]} size={[0.08, WALL_H, depth]} />
      <Glass position={[minX + frontLeftLen / 2, WALL_H / 2, maxZ]} size={[frontLeftLen, WALL_H, 0.08]} />
      <Glass position={[doorRight + frontRightLen / 2, WALL_H / 2, maxZ]} size={[frontRightLen, WALL_H, 0.08]} />
      <Beam position={[minX, WALL_H, cz]} size={[0.16, 0.14, depth]} />
      <Beam position={[maxX, WALL_H, cz]} size={[0.16, 0.14, depth]} />
      <Beam position={[cx, WALL_H, maxZ]} size={[width, 0.14, 0.16]} />
      {[minX, doorLeft, doorRight, maxX].map((x) => (
        <Beam key={x} position={[x, WALL_H / 2, maxZ]} size={[0.12, WALL_H, 0.14]} />
      ))}

      {/* Conference table */}
      <group {...handlers}>
        <RoundedBox args={[5.2, 0.1, 2.2]} radius={0.05} smoothness={4} position={[cx, 0.76, cz]} castShadow receiveShadow>
          <meshStandardMaterial color="#c99b66" roughness={0.45} />
        </RoundedBox>
        {[-1.6, 1.6].map((dx) => (
          <mesh key={dx} position={[cx + dx, 0.36, cz]} castShadow>
            <boxGeometry args={[0.18, 0.72, 1.2]} />
            <meshStandardMaterial color="#25292b" metalness={0.58} roughness={0.34} />
          </mesh>
        ))}
        {/* Conference phone */}
        <mesh position={[cx, 0.83, cz]}>
          <cylinderGeometry args={[0.16, 0.2, 0.05, 3]} />
          <meshStandardMaterial color="#1b1e20" roughness={0.4} />
        </mesh>
      </group>

      {SEATS.map((seat, i) => (
        <MeetingChair key={i} {...seat} person={seated[i]} accent={theme.accent} />
      ))}

      {/* Name tags above occupied chairs */}
      {seated.map((p, i) => (
        <Html key={p.user._id} position={[SEATS[i].x, 1.72, SEATS[i].z]} center distanceFactor={14} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
          <div className="whitespace-nowrap rounded-full bg-white/95 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 shadow ring-1 ring-emerald-300">
            {p.user.name.split(' ')[0]}
          </div>
        </Html>
      ))}

      {/* Wall screen */}
      <group position={[cx, 1.95, minZ + 0.12]}>
        <RoundedBox args={[3.2, 1.8, 0.08]} radius={0.04} smoothness={3} castShadow>
          <meshStandardMaterial color="#141719" roughness={0.3} metalness={0.3} />
        </RoundedBox>
        <mesh position={[0, 0, 0.045]}>
          <planeGeometry args={[3.0, 1.6]} />
          <meshStandardMaterial color={theme.screen} emissive={theme.emissive} emissiveIntensity={0.6} side={THREE.FrontSide} />
        </mesh>
      </group>

      <PottedPlant position={[maxX - 0.6, 0, minZ + 0.6]} scale={0.85} />
      <PottedPlant position={[minX + 0.6, 0, minZ + 0.6]} scale={0.85} />

      {/* Room label, above the wall screen so it never hides the people at the table */}
      <Html position={[cx, 3.3, minZ + 0.3]} center distanceFactor={15} zIndexRange={[20, 0]} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <div
          className={`w-[150px] rounded-xl border bg-white/95 px-3 py-2 text-slate-900 transition-transform duration-200 ${
            highlighted ? '-translate-y-0.5 scale-105' : ''
          } ${state === 'live' ? 'working-desk-animation' : ''}`}
          style={{ borderColor: highlighted ? theme.accent : `${theme.accent}99`, boxShadow: '0 4px 12px rgba(15, 23, 42, 0.12)' }}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="whitespace-nowrap text-[15px] font-extrabold leading-none tracking-tight">Meeting Room</span>
            <span className={`h-2 w-2 shrink-0 rounded-full ${state === 'live' ? 'animate-pulse' : ''}`} style={{ backgroundColor: theme.accent }} />
          </div>
          {signedIn && (current || next) && (
            <p className="mt-1 truncate text-[10px] font-semibold text-slate-700">{(current || next).title}</p>
          )}
          <p className="status-text mt-0.5 border-t border-slate-100 pt-1 text-[9px] font-semibold" style={{ '--status-day': theme.text, '--status-night': theme.textNight }}>
            {statusLine}
            {overflow > 0 ? ` (+${overflow} not seated)` : ''}
          </p>
        </div>
      </Html>
    </group>
  );
}

export const MeetingRoom3D = memo(MeetingRoom3DComponent);
export default MeetingRoom3D;
