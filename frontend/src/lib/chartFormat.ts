/** BMP implementation row label — pure for tests. */
export function formatAcresProgress(achieved: number, target: number): string {
  return `${achieved.toLocaleString()} / ${target.toLocaleString()} ac`;
}
