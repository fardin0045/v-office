import { memo, useMemo } from 'react';
import { RoundedBox } from '@react-three/drei';

const SKIN = ['#f1c7a5', '#e0ac85', '#c68b62', '#a0694a', '#7a4b33', '#f6d5bd'];
const HAIR = ['#2b211c', '#4a3226', '#1b1b1d', '#7b5234', '#b9874f', '#56463f'];
const SHIRT = ['#2dd9d6', '#3b82f6', '#6366f1', '#f97316', '#10b981', '#e11d48', '#8b5cf6', '#0ea5e9', '#475569', '#f59e0b'];
const PANTS = ['#1f2937', '#334155', '#374151', '#3f3a36', '#1e3a5f'];

// Stable colours per person, so someone looks the same at their desk, in meetings and after reloads.
function hash(value) {
  // FNV-1a with a final mix, so similar ids (e.g. "guest-1", "guest-2") still get different looks.
  let h = 2166136261;
  for (const ch of String(value || '')) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  h = Math.imul(h ^ (h >>> 15), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return (h ^ (h >>> 16)) >>> 0;
}

export function personLook(seed) {
  const h = hash(seed);
  return {
    skin: SKIN[h % SKIN.length],
    hair: HAIR[(h >>> 3) % HAIR.length],
    shirt: SHIRT[(h >>> 6) % SHIRT.length],
    pants: PANTS[(h >>> 9) % PANTS.length],
    longHair: ((h >>> 12) & 1) === 1,
  };
}

function Limb({ args, position, rotation = [0, 0, 0], color }) {
  return (
    <RoundedBox args={args} radius={Math.min(...args) / 2 - 0.001} smoothness={2} position={position} rotation={rotation} castShadow>
      <meshStandardMaterial color={color} roughness={0.8} />
    </RoundedBox>
  );
}

/**
 * A simple seated figure. The origin is the top of the seat and the person faces -z
 * (the same way as the office chairs, whose backrest is at +z).
 *   pose="desk"    forearms forward, hands resting on a desk or table in front
 *   pose="relaxed" hands resting on the lap (sofa)
 */
function SeatedPersonComponent({ seed, look: lookOverride, pose = 'desk', position = [0, 0, 0], rotation = 0 }) {
  const look = useMemo(() => lookOverride || personLook(seed), [lookOverride, seed]);
  const desk = pose === 'desk';

  return (
    <group position={position} rotation={[0, rotation, 0]}>
      {/* Legs: thighs on the seat, shins down to the floor */}
      {[-0.1, 0.1].map((x) => (
        <group key={x}>
          <Limb args={[0.14, 0.13, 0.44]} position={[x, 0.07, -0.13]} color={look.pants} />
          <Limb args={[0.12, 0.44, 0.12]} position={[x, -0.16, -0.34]} color={look.pants} />
          <Limb args={[0.12, 0.08, 0.22]} position={[x, -0.42, -0.4]} color="#1a1c1e" />
        </group>
      ))}

      {/* Torso, leaning back slightly into the backrest */}
      <group position={[0, 0.02, 0.06]} rotation={[desk ? -0.04 : 0.12, 0, 0]}>
        <Limb args={[0.4, 0.5, 0.24]} position={[0, 0.3, 0]} color={look.shirt} />
        <mesh position={[0, 0.58, 0]}>
          <cylinderGeometry args={[0.05, 0.055, 0.08, 10]} />
          <meshStandardMaterial color={look.skin} roughness={0.7} />
        </mesh>

        {/* Head and hair */}
        <mesh position={[0, 0.71, -0.01]} castShadow>
          <sphereGeometry args={[0.12, 20, 16]} />
          <meshStandardMaterial color={look.skin} roughness={0.65} />
        </mesh>
        <mesh position={[0, 0.745, 0.02]} scale={[1.06, 0.82, 1.06]}>
          <sphereGeometry args={[0.122, 20, 12, 0, Math.PI * 2, 0, Math.PI / 1.9]} />
          <meshStandardMaterial color={look.hair} roughness={0.9} />
        </mesh>
        {look.longHair && (
          <Limb args={[0.23, 0.26, 0.08]} position={[0, 0.6, 0.1]} color={look.hair} />
        )}

        {/* Arms */}
        {[-1, 1].map((side) => (
          <group key={side}>
            <Limb args={[0.1, 0.3, 0.1]} position={[side * 0.25, 0.39, desk ? -0.02 : 0]} rotation={[desk ? 0.35 : 0.15, 0, 0]} color={look.shirt} />
            {desk ? (
              <>
                <Limb args={[0.09, 0.09, 0.3]} position={[side * 0.23, 0.27, -0.25]} rotation={[-0.25, 0, 0]} color={look.shirt} />
                <mesh position={[side * 0.21, 0.31, -0.42]}>
                  <sphereGeometry args={[0.045, 10, 8]} />
                  <meshStandardMaterial color={look.skin} roughness={0.7} />
                </mesh>
              </>
            ) : (
              <>
                <Limb args={[0.09, 0.09, 0.26]} position={[side * 0.2, 0.2, -0.17]} rotation={[0.3, side * 0.25, 0]} color={look.shirt} />
                <mesh position={[side * 0.13, 0.15, -0.3]}>
                  <sphereGeometry args={[0.045, 10, 8]} />
                  <meshStandardMaterial color={look.skin} roughness={0.7} />
                </mesh>
              </>
            )}
          </group>
        ))}
      </group>
    </group>
  );
}

export const SeatedPerson = memo(SeatedPersonComponent);
export default SeatedPerson;
