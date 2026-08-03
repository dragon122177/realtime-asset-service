import { describe, expect, it } from 'vitest';
import { analyzeGltf } from '../domain/gltf-analyzer.js';

function document(overrides: Record<string, unknown> = {}) {
  return {
    asset: { version: '2.0', generator: 'unit-test' },
    scenes: [{}],
    nodes: [{}],
    meshes: [
      {
        primitives: [
          { attributes: { POSITION: 0, NORMAL: 1, TANGENT: 2 }, indices: 3, material: 0 },
        ],
      },
    ],
    accessors: [
      { count: 6, type: 'VEC3', min: [-1, -2, -3], max: [1, 2, 3] },
      { count: 6, type: 'VEC3' },
      { count: 6, type: 'VEC4' },
      { count: 6, type: 'SCALAR' },
    ],
    materials: [{}],
    textures: [{}],
    images: [{ uri: 'data:image/png;base64,AA==' }],
    buffers: [{ uri: 'data:application/octet-stream;base64,AA==' }],
    ...overrides,
  };
}

function glb(value: unknown): Buffer {
  const source = Buffer.from(JSON.stringify(value));
  const padding = (4 - (source.length % 4)) % 4;
  const json = Buffer.concat([source, Buffer.alloc(padding, 0x20)]);
  const result = Buffer.alloc(20 + json.length);
  result.write('glTF', 0, 'ascii');
  result.writeUInt32LE(2, 4);
  result.writeUInt32LE(result.length, 8);
  result.writeUInt32LE(json.length, 12);
  result.writeUInt32LE(0x4e4f534a, 16);
  json.copy(result, 20);
  return result;
}

describe('analyzeGltf', () => {
  it('extracts scene, geometry, material, resource, and bounds metrics', () => {
    const parsed = analyzeGltf(Buffer.from(JSON.stringify(document())), 'asset.gltf');
    expect(parsed.analysis).toMatchObject({
      format: 'GLTF',
      generator: 'unit-test',
      meshCount: 1,
      primitiveCount: 1,
      estimatedTriangles: 2,
      materialCount: 1,
      textureCount: 1,
      externalResourceCount: 0,
      hasNormals: true,
      hasTangents: true,
      bounds: { min: [-1, -2, -3], max: [1, 2, 3] },
    });
    expect(JSON.parse(parsed.deliveryBytes.toString())).toMatchObject({
      asset: { version: '2.0' },
    });
  });

  it('reads a binary glTF JSON chunk and preserves delivery bytes', () => {
    const bytes = glb(document());
    const parsed = analyzeGltf(bytes, 'asset.glb');
    expect(parsed.analysis.format).toBe('GLB');
    expect(parsed.deliveryBytes.equals(bytes)).toBe(true);
  });

  it('counts strips, fans, external resources, and missing attributes', () => {
    const value = document({
      meshes: [
        {
          primitives: [
            { mode: 5, attributes: { POSITION: 0 } },
            { mode: 6, attributes: { POSITION: 0 } },
          ],
        },
      ],
      accessors: [{ count: 7, type: 'VEC3' }],
      buffers: [{ uri: 'model.bin' }],
      images: [{ uri: 'texture.png' }],
    });
    const parsed = analyzeGltf(Buffer.from(JSON.stringify(value)), 'asset.gltf');
    expect(parsed.analysis.estimatedTriangles).toBe(10);
    expect(parsed.analysis.externalResourceCount).toBe(2);
    expect(parsed.analysis.hasNormals).toBe(false);
    expect(parsed.analysis.hasTangents).toBe(false);
    expect(parsed.analysis.bounds).toBeNull();
  });

  it.each([
    [Buffer.from('not json'), 'asset.gltf', 'invalid_gltf_json'],
    [Buffer.from('{}'), 'asset.gltf', 'unsupported_gltf_version'],
    [Buffer.from('bad binary'), 'asset.glb', 'invalid_glb_header'],
  ])('rejects malformed sources', (bytes, filename, message) => {
    expect(() => analyzeGltf(bytes, filename)).toThrow(message);
  });

  it('rejects inconsistent GLB lengths and chunk types', () => {
    const bytes = glb(document());
    bytes.writeUInt32LE(bytes.length + 4, 8);
    expect(() => analyzeGltf(bytes, 'asset.glb')).toThrow('invalid_glb_length');
    const wrongChunk = glb(document());
    wrongChunk.writeUInt32LE(0, 16);
    expect(() => analyzeGltf(wrongChunk, 'asset.glb')).toThrow('missing_glb_json_chunk');
  });
});
