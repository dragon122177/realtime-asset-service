import test from "node:test";
import assert from "node:assert/strict";
import { AssetRepository } from "../src/assets.js";
test("identical asset bytes are deduplicated", () => { const repo = new AssetRepository(); const input = { name: "scene.glb", bytes: Buffer.from("mesh"), mediaType: "model/gltf-binary" }; const first = repo.create(input); const second = repo.create(input); assert.equal(first.asset.id, second.asset.id); assert.equal(second.deduplicated, true); });
