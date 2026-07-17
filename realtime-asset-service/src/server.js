import http from "node:http";
import { AssetRepository } from "./assets.js";
const repository = new AssetRepository();
http.createServer((req, res) => {
  res.setHeader("content-type", "application/json");
  if (req.url === "/health") return res.end(JSON.stringify({ status: "ok" }));
  const id = req.url?.split("/")[2];
  if (req.method === "GET" && id) { const asset = repository.get(id); res.statusCode = asset ? 200 : 404; return res.end(JSON.stringify(asset ?? { error: "asset_not_found" })); }
  res.statusCode = 404; res.end(JSON.stringify({ error: "not_found" }));
}).listen(process.env.PORT ?? 3002);
