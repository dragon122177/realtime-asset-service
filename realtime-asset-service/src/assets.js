import { createHash, randomUUID } from "node:crypto";
export class AssetRepository {
  constructor() { this.byId = new Map(); this.byHash = new Map(); }
  create({ name, bytes, mediaType }) {
    if (!name || !["model/gltf+json", "model/gltf-binary"].includes(mediaType)) throw new Error("invalid_asset");
    const hash = createHash("sha256").update(bytes).digest("hex");
    const existing = this.byHash.get(hash); if (existing) return { asset: existing, deduplicated: true };
    const asset = { id: randomUUID(), name, mediaType, hash, status: "queued" };
    this.byId.set(asset.id, asset); this.byHash.set(hash, asset); return { asset, deduplicated: false };
  }
  get(id) { return this.byId.get(id); }
}
