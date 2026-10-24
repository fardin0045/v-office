import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import * as THREE from 'three';
import {
  Coffee, Cpu, Crown, Layers, LayoutGrid, Lightbulb, LightbulbOff, MousePointerClick, Presentation, RotateCcw, User, Users,
} from 'lucide-react';
import { OfficeFloor } from './OfficeFloor';
import { OfficeFurniture } from './OfficeFurniture';
import { DESK_STATUS_THEME, DeskChair3D } from './DeskChair3D';
import { CameraRig } from './CameraControls';
import { ChairFloatingPanel } from './ChairFloatingPanel';
import { MeetingRoom3D } from './MeetingRoom3D';
import { FloorLamp3D, ZONE_LAMPS } from './FloorLamp3D';
import { useTheme } from '../../lib/theme';
import { MeetingPanel } from './MeetingPanel';
import { activeParticipants, useMeetings } from '../../context/MeetingsContext';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { cn } from '../../lib/utils';
import { Spinner } from '../ui';

// Day: bright, warm daylight. Night: dark sky and cool moonlight, while the ceiling spots,
// cove light strips and screens keep glowing, so the office reads as lit after hours.
const LIGHTING = {
  light: { bg: '#eef5f5', hemi: ['#ffffff', '#d7dfdf', 1.15], ambient: 0.45, sun: 2.1, sunColor: '#fff6e8', fill: 0.5, spot: 5 },
  dark: { bg: '#0a1013', hemi: ['#9fb3d1', '#2a333a', 0.85], ambient: 0.28, sun: 0.8, sunColor: '#a9bcff', fill: 0.25, spot: 40 },
};

// Which zone lamps are switched on (per viewer, remembered in this browser). All on by default.
const LAMPS_KEY = 'voffice_lamps';
function loadLamps() {
  const all = Object.fromEntries(ZONE_LAMPS.map((l) => [l.id, true]));
  try {
    const saved = JSON.parse(localStorage.getItem(LAMPS_KEY) || '{}');
    ZONE_LAMPS.forEach((l) => {
      if (typeof saved[l.id] === 'boolean') all[l.id] = saved[l.id];
    });
  } catch {
    /* ignore unreadable storage */
  }
  return all;
}
function saveLamps(state) {
  try {
    localStorage.setItem(LAMPS_KEY, JSON.stringify(state));
  } catch {
    /* not persisted */
  }
}

const CAMERA_PRESETS = {
  overview: { name: 'Overview', icon: LayoutGrid, position: [0, 28, 28], target: [0, 0, 0] },
  zoneA: { name: 'Front office', icon: Layers, position: [-6, 12, 16], target: [-6, 0, 6] },
  zoneB: { name: 'Lounge', icon: Coffee, position: [-18, 10, 13], target: [-18, 0, 3.8] },
  zoneC: { name: 'Pods', icon: Layers, position: [-4, 12, 5], target: [-4, 0, -3] },
  zoneD: { name: 'CEO suite', icon: Crown, position: [-17.5, 9, -6], target: [-17.5, 0.8, -14] },
  meeting: { name: 'Meeting room', icon: Presentation, position: [-2, 10, -5], target: [-2, 0.8, -15] },
  teamCorner: { name: 'Business team', icon: Users, position: [18, 10, 23], target: [18, 0.8, 15.7] },
  zoneE: { name: 'Engineering', icon: Cpu, position: [18, 14, 12], target: [18, 0, -4] },
};

// Presentation-only positions for desks 8–11. Backend desk data is untouched.
const CORNER_DESK_LAYOUT = {
  8: { x: 16.2, y: 0, z: 14.2, rotation: Math.PI },
  9: { x: 19.6, y: 0, z: 14.2, rotation: Math.PI },
  10: { x: 16.2, y: 0, z: 17.1, rotation: Math.PI },
  11: { x: 19.6, y: 0, z: 17.1, rotation: Math.PI },
};

function applyVisualDeskLayout(desk) {
  const match = String(desk?.deskId || '').match(/(\d+)(?!.*\d)/);
  const visualPosition = CORNER_DESK_LAYOUT[match ? Number(match[1]) : NaN];
  if (!visualPosition) return desk;
  return { ...desk, position: { ...(desk.position || {}), ...visualPosition } };
}

// Visual layout objects are cached per desk object, so unchanged desks keep their identity
// (and their memoized 3D component skips re-rendering) when a single desk updates.
const layoutCache = new WeakMap();
function withLayout(desk) {
  let result = layoutCache.get(desk);
  if (!result) {
    result = applyVisualDeskLayout(desk);
    layoutCache.set(desk, result);
  }
  return result;
}

const cameraViewForDesk = (desk) => {
  const { x = 0, z = 0 } = desk.position || {};
  return { position: [x, 8, z + 6], target: [x, 0.8, z] };
};

/**
 * @param focusDeskId  desk to select and fly to
 * @param focusKey     change this value to re-trigger focusing the same desk
 */
export function OfficeScene({ focusDeskId = null, focusKey = 0, focusRoom = false, className }) {
  const { user, isAuthenticated } = useAuth();
  const { desks, desksLoaded, isUserAway } = useSocket();
  const { current: liveMeeting, upcoming } = useMeetings();
  const { isDark } = useTheme();
  const light = LIGHTING[isDark ? 'dark' : 'light'];

  const [selectedDeskId, setSelectedDeskId] = useState(null);
  const [roomSelected, setRoomSelected] = useState(false);
  const [lamps, setLamps] = useState(loadLamps);
  const litCount = ZONE_LAMPS.filter((l) => lamps[l.id]).length;
  const toggleLamp = useCallback((id) => {
    setLamps((prev) => {
      const next = { ...prev, [id]: !prev[id] };
      saveLamps(next);
      return next;
    });
  }, []);
  const toggleAllLamps = useCallback(() => {
    setLamps((prev) => {
      const turnOn = !ZONE_LAMPS.some((l) => prev[l.id]);
      const next = Object.fromEntries(ZONE_LAMPS.map((l) => [l.id, turnOn]));
      saveLamps(next);
      return next;
    });
  }, []);

  // People are seated in the room for a live meeting, or one that has opened for joining.
  const roomMeeting = liveMeeting || upcoming.find((m) => m.status === 'joinable') || null;
  const nextMeeting = upcoming[0] || null;
  const roomParticipants = useMemo(() => activeParticipants(roomMeeting), [roomMeeting]);
  const [activePreset, setActivePreset] = useState('overview');
  const [cameraView, setCameraView] = useState(CAMERA_PRESETS.overview);

  const visualDesks = useMemo(() => desks.map(withLayout), [desks]);
  const selectedDesk = useMemo(
    () => visualDesks.find((d) => d.deskId === selectedDeskId) || null,
    [visualDesks, selectedDeskId]
  );

  const deskById = useRef(new Map());
  deskById.current = new Map(visualDesks.map((d) => [d.deskId, d]));

  const focusDesk = useCallback((deskId) => {
    const desk = deskById.current.get(deskId);
    if (!desk) return false;
    setSelectedDeskId(deskId);
    setRoomSelected(false);
    setActivePreset(null);
    setCameraView(cameraViewForDesk(desk));
    return true;
  }, []);

  const selectRoom = useCallback(() => {
    setSelectedDeskId(null);
    setRoomSelected(true);
    setActivePreset('meeting');
    setCameraView(CAMERA_PRESETS.meeting);
  }, []);

  const clearSelection = () => {
    setSelectedDeskId(null);
    setRoomSelected(false);
  };

  useEffect(() => {
    if (focusRoom) selectRoom();
  }, [focusRoom, selectRoom]);

  // Focus the requested desk once it exists — not again on every realtime update.
  const appliedFocus = useRef(null);
  useEffect(() => {
    if (!focusDeskId) return;
    const requestKey = `${focusDeskId}:${focusKey}`;
    if (appliedFocus.current === requestKey) return;
    if (focusDesk(focusDeskId)) appliedFocus.current = requestKey;
  }, [focusDeskId, focusKey, visualDesks, focusDesk]);

  const selectPreset = (key) => {
    if (key === 'meeting') {
      selectRoom();
      return;
    }
    setActivePreset(key);
    setCameraView(CAMERA_PRESETS[key]);
  };

  const resetCamera = () => {
    selectPreset('overview');
    clearSelection();
  };

  const myDeskExists = Boolean(user?.assignedDesk && visualDesks.some((d) => d.deskId === user.assignedDesk));

  return (
    <div className={cn('relative h-full min-h-[480px] w-full select-none overflow-hidden', className)} style={{ background: light.bg }}>
      <Canvas
        shadows
        dpr={[1, 1.75]}
        camera={{ position: [0, 28, 28], fov: 45 }}
        gl={{
          antialias: true,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.0,
        }}
        onPointerMissed={clearSelection}
      >
        <color attach="background" args={[light.bg]} />
        <fog attach="fog" args={[light.bg, 40, 85]} />

        <hemisphereLight args={light.hemi} />
        <ambientLight intensity={light.ambient} color="#fffaf2" />
        {/* The only shadow caster — spotlight shadows were costly and barely visible. */}
        <directionalLight
          position={[12, 30, 14]}
          intensity={light.sun}
          color={light.sunColor}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-29}
          shadow-camera-right={29}
          shadow-camera-top={25}
          shadow-camera-bottom={-25}
          shadow-camera-near={1}
          shadow-camera-far={70}
          shadow-bias={-0.00012}
          shadow-normalBias={0.025}
        />
        <directionalLight position={[-18, 16, -18]} intensity={light.fill} color="#e2f4f4" />
        <spotLight position={[-7, 10, 9]} intensity={light.spot} distance={24} angle={0.72} penumbra={0.85} color="#fff1dc" />
        <spotLight position={[-4, 11, -5]} intensity={light.spot} distance={24} angle={0.68} penumbra={0.88} color="#fff4e4" />
        <spotLight position={[18, 11, -4]} intensity={light.spot} distance={25} angle={0.7} penumbra={0.88} color="#fff4e4" />

        {/* Decorative assets load independently so a slow texture or font never hides the desks. */}
        <OfficeFloor night={isDark} />
        <Suspense fallback={null}>
          <OfficeFurniture />
        </Suspense>
        {visualDesks.map((desk) => (
          <DeskChair3D
            key={desk.deskId}
            desk={desk}
            isSelected={selectedDeskId === desk.deskId}
            isUserAssigned={user?.assignedDesk === desk.deskId}
            isAway={desk.status === 'working' && isUserAway(desk.currentSessionId?.employeeId?._id)}
            onSelect={focusDesk}
          />
        ))}
        <MeetingRoom3D
          current={liveMeeting}
          next={liveMeeting ? null : nextMeeting}
          participants={roomParticipants}
          selected={roomSelected}
          signedIn={isAuthenticated}
          onSelect={selectRoom}
        />
        {ZONE_LAMPS.map((lamp) => (
          <FloorLamp3D key={lamp.id} {...lamp} on={lamps[lamp.id]} night={isDark} onToggle={toggleLamp} />
        ))}
        <CameraRig targetView={cameraView} />
      </Canvas>

      {!desksLoaded && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/40 backdrop-blur-[1px]">
          <span className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-card">
            <Spinner className="text-brand-600" /> Loading workstations…
          </span>
        </div>
      )}

      {/* Camera presets */}
      <div className="absolute left-3 right-3 top-3 z-30 sm:right-auto">
        <div className="flex items-center gap-1 overflow-x-auto rounded-xl border border-slate-200 bg-white/90 p-1 shadow-card backdrop-blur-md">
          {Object.entries(CAMERA_PRESETS).map(([key, preset]) => {
            const Icon = preset.icon;
            const active = activePreset === key && !selectedDeskId;
            return (
              <button
                key={key}
                type="button"
                onClick={() => selectPreset(key)}
                className={cn(
                  'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition-colors',
                  active ? 'bg-brand text-brand-ink' : 'text-slate-600 hover:bg-slate-100 hover:text-ink'
                )}
                aria-pressed={active}
                title={preset.name}
              >
                <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                <span className="hidden lg:inline">{preset.name}</span>
              </button>
            );
          })}
          {myDeskExists && (
            <button
              type="button"
              onClick={() => focusDesk(user.assignedDesk)}
              className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg bg-slate-900 px-2.5 text-xs font-semibold text-white transition-colors hover:bg-slate-800"
              title={`Go to ${user.assignedDesk}`}
            >
              <User className="h-3.5 w-3.5" aria-hidden="true" />
              My desk
              <span className="rounded bg-white/15 px-1 font-mono text-[10px]">{user.assignedDesk}</span>
            </button>
          )}
          <span className="mx-0.5 h-5 w-px shrink-0 bg-slate-200" aria-hidden="true" />
          {isDark && (
            <button
              type="button"
              onClick={toggleAllLamps}
              className={cn(
                'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition-colors',
                litCount ? 'bg-amber-100 text-amber-800 hover:bg-amber-200' : 'text-slate-600 hover:bg-slate-100 hover:text-ink'
              )}
              aria-pressed={litCount > 0}
              title={litCount ? 'Turn all zone lamps off (or click a lamp to switch just that one)' : 'Turn all zone lamps on'}
            >
              {litCount ? <Lightbulb className="h-3.5 w-3.5" aria-hidden="true" /> : <LightbulbOff className="h-3.5 w-3.5" aria-hidden="true" />}
              <span>Lights</span>
              <span className="rounded bg-slate-900/10 px-1 font-mono text-[10px] tabular-nums">
                {litCount}/{ZONE_LAMPS.length}
              </span>
            </button>
          )}
          <button
            type="button"
            onClick={resetCamera}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-100 hover:text-ink"
            title="Reset view"
            aria-label="Reset camera view"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="absolute bottom-3 left-3 z-30 hidden items-center gap-4 rounded-xl border border-slate-200 bg-white/90 px-4 py-2 text-xs font-medium text-slate-600 shadow-card backdrop-blur-md sm:flex">
        {[
          ['available', 'Available'],
          ['working', 'Working'],
          ['away', 'Away'],
          ['locked', 'Locked'],
        ].map(([key, label]) => (
          <span key={key} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: DESK_STATUS_THEME[key].main }} />
            {label}
          </span>
        ))}
      </div>

      {!selectedDesk && !roomSelected && (
        <div className="pointer-events-none absolute bottom-3 left-1/2 z-20 hidden -translate-x-1/2 xl:block">
          <p className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-slate-200 bg-white/85 px-4 py-1.5 text-xs text-slate-500 shadow-card backdrop-blur">
            <MousePointerClick className="h-3.5 w-3.5 text-brand-700" aria-hidden="true" />
            Drag to orbit · Right-drag to pan · Scroll to zoom · Click a chair to interact
          </p>
        </div>
      )}

      {selectedDesk && <ChairFloatingPanel key={selectedDesk.deskId} desk={selectedDesk} onClose={() => setSelectedDeskId(null)} />}
      {roomSelected && !selectedDesk && <MeetingPanel onClose={() => setRoomSelected(false)} />}
    </div>
  );
}

export default OfficeScene;
