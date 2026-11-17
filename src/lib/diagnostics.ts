import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Device from 'expo-device';

// Kept free of DB / store imports so the crash screen can use it even when the DB is what failed.

/** Where bug reports / feature requests are emailed (no server — the user sends from their mail app). */
export const FEEDBACK_EMAIL = 'haledevteam@protonmail.com';


export interface Diagnostics {
  app: string;
  version: string | undefined;
  variant: string;
  platform: string;
  osVersion: string | number;
  device: string | null;
}

export function gatherDiagnostics(): Diagnostics {
  return {
    app: 'Hale',
    version: Constants.expoConfig?.version,
    variant: ((Constants.expoConfig?.extra as Record<string, unknown>)?.appVariant as string) ?? 'unknown',
    platform: Platform.OS,
    osVersion: Platform.Version,
    device: Device.modelName ?? null,
  };
}
