/**
 * Painted art for Toon Flap (docs/TOON-FLAP-ART-PLAN.md). The art thread fills this folder with .webp files and points
 * these at them. Until then every function returns undefined and the screens draw the stand-ins in code (the stand-ins
 * stay as the fallback for a picture that hasn't loaded).
 */
export type FlyerPose = 'glide' | 'up' | 'dizzy' | 'perched' | 'cheer';
export type WorldLayer = 'back' | 'mid' | 'wall-top' | 'wall-bottom' | 'wall-middle';

export const worldArt = (_n: number, _layer: WorldLayer): string | undefined => undefined;
export const flyerArt = (_id: string, _pose: FlyerPose): string | undefined => undefined;
export const trailArt = (_id: string): string | undefined => undefined;
