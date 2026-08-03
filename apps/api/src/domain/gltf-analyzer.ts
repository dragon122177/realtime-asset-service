import type { AssetAnalysis } from './types.js';

type Accessor = {
  count?: number;
  type?: string;
  min?: number[];
  max?: number[];
};

type Primitive = {
  attributes?: Record<string, number>;
  indices?: number;
  mode?: number;
};

type GltfDocument = {
  asset?: { version?: string; generator?: string };
  scenes?: unknown[];
  nodes?: unknown[];
  meshes?: Array<{ primitives?: Primitive[] }>;
  accessors?: Accessor[];
  materials?: unknown[];
  textures?: unknown[];
  images?: Array<{ uri?: string }>;
  animations?: unknown[];
  skins?: unknown[];
  buffers?: Array<{ uri?: string }>;
};

export type ParsedGltf = {
  document: GltfDocument;
  analysis: AssetAnalysis;
  deliveryBytes: Buffer;
};

function parseJsonDocument(bytes: Buffer): GltfDocument {
  let parsed: unknown;
  try {
    parsed = JSON.parse(bytes.toString('utf8')) as unknown;
  } catch {
    throw new Error('invalid_gltf_json');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('invalid_gltf_document');
  }
  return parsed;
}

function parseGlb(bytes: Buffer): GltfDocument {
  if (bytes.length < 20 || bytes.toString('ascii', 0, 4) !== 'glTF') {
    throw new Error('invalid_glb_header');
  }
  const version = bytes.readUInt32LE(4);
  const declaredLength = bytes.readUInt32LE(8);
  if (version !== 2) throw new Error('unsupported_glb_version');
  if (declaredLength !== bytes.length) throw new Error('invalid_glb_length');
  const jsonLength = bytes.readUInt32LE(12);
  const jsonType = bytes.readUInt32LE(16);
  if (jsonType !== 0x4e4f534a || 20 + jsonLength > bytes.length) {
    throw new Error('missing_glb_json_chunk');
  }
  const jsonBytes = bytes.subarray(20, 20 + jsonLength);
  return parseJsonDocument(
    Buffer.from(jsonBytes.toString('utf8').replaceAll('\u0000', '').trimEnd()),
  );
}

function accessorCount(document: GltfDocument, index: number | undefined): number {
  if (index === undefined || !Number.isInteger(index)) return 0;
  const count = document.accessors?.[index]?.count;
  return typeof count === 'number' && Number.isFinite(count) && count > 0 ? count : 0;
}

function primitiveTriangles(document: GltfDocument, primitive: Primitive): number {
  const count =
    primitive.indices === undefined
      ? accessorCount(document, primitive.attributes?.POSITION)
      : accessorCount(document, primitive.indices);
  const mode = primitive.mode ?? 4;
  if (mode === 4) return Math.floor(count / 3);
  if (mode === 5 || mode === 6) return Math.max(0, count - 2);
  return 0;
}

function countExternalResources(document: GltfDocument): number {
  const uris = [
    ...(document.buffers ?? []).map((buffer) => buffer.uri),
    ...(document.images ?? []).map((image) => image.uri),
  ];
  return uris.filter((uri): uri is string => typeof uri === 'string' && !uri.startsWith('data:'))
    .length;
}

function combineBounds(document: GltfDocument, primitives: Primitive[]): AssetAnalysis['bounds'] {
  const positionAccessors = primitives
    .map((primitive) => primitive.attributes?.POSITION)
    .filter((index): index is number => typeof index === 'number')
    .map((index) => document.accessors?.[index])
    .filter((accessor): accessor is Accessor & { min: number[]; max: number[] } =>
      Boolean(accessor?.min?.length === 3 && accessor.max?.length === 3),
    );
  if (!positionAccessors.length) return null;
  const min: [number, number, number] = [
    Number.POSITIVE_INFINITY,
    Number.POSITIVE_INFINITY,
    Number.POSITIVE_INFINITY,
  ];
  const max: [number, number, number] = [
    Number.NEGATIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
  ];
  for (const accessor of positionAccessors) {
    for (let axis = 0; axis < 3; axis += 1) {
      const minValue = accessor.min[axis];
      const maxValue = accessor.max[axis];
      if (typeof minValue === 'number') min[axis] = Math.min(min[axis] ?? minValue, minValue);
      if (typeof maxValue === 'number') max[axis] = Math.max(max[axis] ?? maxValue, maxValue);
    }
  }
  return { min, max };
}

export function analyzeGltf(bytes: Buffer, filename: string): ParsedGltf {
  const isGlb = filename.toLowerCase().endsWith('.glb') || bytes.toString('ascii', 0, 4) === 'glTF';
  const document = isGlb ? parseGlb(bytes) : parseJsonDocument(bytes);
  const version = document.asset?.version;
  if (typeof version !== 'string' || !version.startsWith('2.')) {
    throw new Error('unsupported_gltf_version');
  }
  const primitives = (document.meshes ?? []).flatMap((mesh) => mesh.primitives ?? []);
  const analysis: AssetAnalysis = {
    format: isGlb ? 'GLB' : 'GLTF',
    generator: typeof document.asset?.generator === 'string' ? document.asset.generator : null,
    version,
    sourceBytes: bytes.length,
    sceneCount: document.scenes?.length ?? 0,
    nodeCount: document.nodes?.length ?? 0,
    meshCount: document.meshes?.length ?? 0,
    primitiveCount: primitives.length,
    materialCount: document.materials?.length ?? 0,
    textureCount: document.textures?.length ?? 0,
    imageCount: document.images?.length ?? 0,
    animationCount: document.animations?.length ?? 0,
    skinCount: document.skins?.length ?? 0,
    accessorCount: document.accessors?.length ?? 0,
    estimatedTriangles: primitives.reduce(
      (total, primitive) => total + primitiveTriangles(document, primitive),
      0,
    ),
    externalResourceCount: countExternalResources(document),
    hasNormals:
      primitives.length > 0 &&
      primitives.every((primitive) => primitive.attributes?.NORMAL !== undefined),
    hasTangents:
      primitives.length > 0 &&
      primitives.every((primitive) => primitive.attributes?.TANGENT !== undefined),
    bounds: combineBounds(document, primitives),
  };
  const deliveryBytes = isGlb ? Buffer.from(bytes) : Buffer.from(JSON.stringify(document));
  return { document, analysis, deliveryBytes };
}
