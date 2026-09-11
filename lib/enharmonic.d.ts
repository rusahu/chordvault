export declare const ENHARMONIC_MAP: Record<string, string>;
export declare const ALL_KEYS: string[];
export declare const ALL_KEYS_MINOR: string[];
export declare function normalizeKey(k: string): string;
declare const backend: {
  ENHARMONIC_MAP: Record<string, string>;
  ALL_KEYS: string[];
  ALL_KEYS_MINOR: string[];
  normalizeKey: typeof normalizeKey;
};
export default backend;
