#!/usr/bin/env node
// Static server for the engine's diagnostics page, with the headers the engine needs:
// Cross-Origin-Opener-Policy + Cross-Origin-Embedder-Policy (cross-origin
// isolation, required for SharedArrayBuffer) and correct MIME types.
//
//   node engine/wasm/test/serve.mjs [--port 8765] [--no-isolation]
//
// --no-isolation leaves COOP/COEP out, to check that the page then fails
// loudly instead of hanging. Also importable: startServer({ port, isolation,
// files }), where files maps extra URL paths to files (e.g. a transcript).

import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const wasmDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const engineDir = path.resolve(wasmDir, "..");
const buildDir = path.resolve(process.env.OPENMANA_ENGINE_BUILD_DIR || path.join(engineDir, "build"));

// /engine/  the engine artefacts as the app will serve them (worker, launcher, module)
// /harness/ the bundled diagnostics page script (engine/scripts/bundle-host.mjs)
// /         the diagnostics page itself
const ROUTES = [
  ["/engine/", path.join(buildDir, "dist")],
  ["/harness/", path.join(buildDir, "harness")],
  ["/", path.join(wasmDir, "spike")],
];

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".cjs": "text/javascript; charset=utf-8",
  ".wasm": "application/wasm",
  ".json": "application/json; charset=utf-8",
  ".jsonl": "application/x-ndjson; charset=utf-8",
  ".map": "application/json; charset=utf-8",
};

function resolve(urlPath, files) {
  const clean = decodeURIComponent(urlPath.split("?")[0]);
  if (Object.prototype.hasOwnProperty.call(files, clean)) {
    return files[clean];
  }
  for (const [prefix, dir] of ROUTES) {
    if (clean.startsWith(prefix)) {
      const rel = clean.slice(prefix.length) || "index.html";
      const file = path.resolve(dir, rel);
      if (!file.startsWith(dir + path.sep)) {
        return null;
      }
      return file;
    }
  }
  return null;
}

export function startServer({ port = 8765, isolation = true, host = "127.0.0.1", files = {} } = {}) {
  const server = http.createServer((req, res) => {
    const file = resolve(req.url, files);
    const headers = { "Cache-Control": "no-store" };
    if (isolation) {
      headers["Cross-Origin-Opener-Policy"] = "same-origin";
      headers["Cross-Origin-Embedder-Policy"] = "require-corp";
      headers["Cross-Origin-Resource-Policy"] = "same-origin";
    }
    if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      res.writeHead(404, { ...headers, "Content-Type": "text/plain" });
      res.end("not found");
      return;
    }
    const stat = fs.statSync(file);
    res.writeHead(200, {
      ...headers,
      "Content-Type": TYPES[path.extname(file)] || "application/octet-stream",
      "Content-Length": stat.size,
    });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolvePromise) => {
    server.listen(port, host, () => resolvePromise(server));
  });
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2);
  const portIndex = args.indexOf("--port");
  const port = portIndex >= 0 ? Number(args[portIndex + 1]) : 8765;
  const isolation = !args.includes("--no-isolation");
  const server = await startServer({ port, isolation });
  console.log(`engine diagnostics: http://127.0.0.1:${server.address().port}/ (cross-origin isolation ${isolation ? "on" : "OFF"})`);
}
