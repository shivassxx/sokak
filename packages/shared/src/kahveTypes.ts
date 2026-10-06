/** Small structural copies of okey types (shared must not depend on @sokak/okey). */
export type OpenMode = 'series' | 'pairs';
export interface Meld {
  id: number;
  owner: number;
  kind: 'run' | 'set' | 'pair';
  tiles: number[];
}
