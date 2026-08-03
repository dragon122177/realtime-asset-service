import { readFile } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const moduleDirectory = dirname(fileURLToPath(import.meta.url));

function sampleAssetCandidates(filename: string): string[] {
  if (!filename || basename(filename) !== filename) {
    throw new Error('Sample asset filename must be a single path segment');
  }

  return [
    ...new Set([
      resolve(process.cwd(), 'samples', filename),
      resolve(process.cwd(), '../../samples', filename),
      resolve(moduleDirectory, '../../../../samples', filename),
    ]),
  ];
}

export async function readSampleAsset(filename: string): Promise<Buffer> {
  const candidates = sampleAssetCandidates(filename);

  for (const candidate of candidates) {
    try {
      return await readFile(candidate);
    } catch (error) {
      if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  throw new Error(`Unable to locate sample asset "${filename}"`);
}
