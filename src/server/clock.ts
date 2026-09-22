import "server-only";

/** Request time for server components (they render once per request). */
export function requestNow(): number {
  return Date.now();
}
