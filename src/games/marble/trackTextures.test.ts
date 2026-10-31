import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { TOP_TILES, topTexture, wallTexture, wallTopTexture } from './trackTextures';

const TOPS = ['sand', 'tarmac', 'sinter', 'snow', 'concrete', 'scoria', 'grass'] as const;
const WALLS = ['planks', 'boardwalk', 'concrete', 'rock', 'snowbank', 'hazard'] as const;

function expectRepeating(texture: THREE.Texture) {
  expect(texture.colorSpace).toBe(THREE.SRGBColorSpace);
  expect(texture.wrapS).toBe(THREE.RepeatWrapping);
  expect(texture.wrapT).toBe(THREE.RepeatWrapping);
}

describe('track textures', () => {
  it('draws every top pattern as a repeating sRGB texture', () => {
    for (const pattern of TOPS) expectRepeating(topTexture(pattern));
    expect(TOP_TILES).toBe(4);
  });

  it('draws every wall base as a repeating sRGB texture', () => {
    for (const base of WALLS) expectRepeating(wallTexture(base));
  });

  it('draws both rail textures as repeating sRGB textures', () => {
    for (const top of ['log', 'pipe'] as const) expectRepeating(wallTopTexture(top));
  });

  it('passes the anisotropy through', () => {
    expect(topTexture('grass', 8).anisotropy).toBe(8);
    expect(wallTexture('rock', 2).anisotropy).toBe(2);
  });
});
