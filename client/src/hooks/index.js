import { useEffect, useRef, useState } from 'react';

// Live seconds elapsed since `startedAt` (Date | string). Ticks once per second; 0 when not running.
export function useElapsedSeconds(startedAt) {
  const start = startedAt ? new Date(startedAt).getTime() : null;
  const compute = () => (start ? Math.max(0, Math.floor((Date.now() - start) / 1000)) : 0);
  const [elapsed, setElapsed] = useState(compute);

  useEffect(() => {
    setElapsed(compute());
    if (!start) return undefined;
    const id = setInterval(() => setElapsed(compute()), 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start]);

  return elapsed;
}

export function useDebouncedValue(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

// Calls `onOutside` for pointer-downs outside `ref` and for the Escape key while `active`.
export function useDismiss(ref, onOutside, active = true) {
  const handler = useRef(onOutside);
  handler.current = onOutside;

  useEffect(() => {
    if (!active) return undefined;
    const onPointer = (event) => {
      if (ref.current && !ref.current.contains(event.target)) handler.current();
    };
    const onKey = (event) => {
      if (event.key === 'Escape') handler.current();
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('touchstart', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('touchstart', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [ref, active]);
}

export function useDocumentTitle(title) {
  useEffect(() => {
    document.title = title ? `${title} · V-Office` : 'V-Office — Your hybrid workplace in one virtual space';
  }, [title]);
}
