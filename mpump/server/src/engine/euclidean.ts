/**
 * Bjorklund's algorithm for Euclidean rhythm generation.
 * Distributes k hits as evenly as possible across n steps.
 */

export function euclidean(hits: number, steps: number, rotation = 0): boolean[] {
  if (steps <= 0) return [];
  if (hits <= 0) return Array(steps).fill(false);
  if (hits >= steps) return Array(steps).fill(true);

  // Bjorklund algorithm
  let pattern: number[][] = [];
  let remainder: number[][] = [];

  for (let i = 0; i < hits; i++) pattern.push([1]);
  for (let i = 0; i < steps - hits; i++) remainder.push([0]);

  while (remainder.length > 1) {
    const newPattern: number[][] = [];
    const len = Math.min(pattern.length, remainder.length);
    for (let i = 0; i < len; i++) {
      newPattern.push([...pattern[i], ...remainder[i]]);
    }
    const leftover = pattern.length > remainder.length
      ? pattern.slice(len)
      : remainder.slice(len);
    pattern = newPattern;
    remainder = leftover;
  }

  const flat = [...pattern, ...remainder].flat();

  // Apply rotation
  if (rotation !== 0) {
    const r = ((rotation % flat.length) + flat.length) % flat.length;
    const rotated = [...flat.slice(r), ...flat.slice(0, r)];
    return rotated.map(v => v === 1);
  }

  return flat.map(v => v === 1);
}
