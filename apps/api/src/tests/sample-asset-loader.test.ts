import { describe, expect, it } from 'vitest';
import { readSampleAsset } from '../services/sample-asset-loader.js';

type GltfDocument = {
  asset?: {
    version?: string;
  };
};

describe('sample asset loader', () => {
  it.each(['cube.gltf', 'robot-cell.gltf', 'medical-scanner.gltf'])(
    'loads %s when the API script runs from its workspace',
    async (filename) => {
      const bytes = await readSampleAsset(filename);
      const document = JSON.parse(bytes.toString('utf8')) as GltfDocument;

      expect(bytes.byteLength).toBeGreaterThan(0);
      expect(document.asset?.version).toBe('2.0');
    },
  );

  it('rejects paths outside the samples directory', async () => {
    await expect(readSampleAsset('../cube.gltf')).rejects.toThrow(
      'Sample asset filename must be a single path segment',
    );
  });
});
