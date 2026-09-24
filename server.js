// Grade Calculator - the math runs in the browser. Reading grades from a PHOTO (OCR) runs on
// YOUR machine with QVAC. Open http://localhost:3005 after starting.

import http from "node:http";
import os from "node:os";
import { readFile, writeFile, unlink } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { loadModel, ocr, OCR_LATIN } from "@qvac/sdk";

const PORT = 3005;
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ---- Step 1: load the text-recognition (OCR) model (downloads the first time) ----
let modelId = null;
const status = { ready: false, message: "Starting...", percent: null, error: null };

async function startModel() {
  try {
    status.message = "Loading the scanner model (first run downloads it)...";
    modelId = await loadModel({
      modelSrc: OCR_LATIN,
      modelConfig: { langList: ["en"], magRatio: 1.5 },
      onProgress: (p) => {
        const value = typeof p === "number" ? p : p?.percentage;
        if (typeof value === "number") status.percent = Math.round(value);
      },
    });
    status.ready = true;
    status.message = "Scanner ready";
    console.log("Model loaded. Open http://localhost:" + PORT);
  } catch (err) {
    status.error = String(err?.message || err);
    console.error("Could not load model:", err);
  }
}

// ---- Step 2: OCR gives us separate words with positions. Put words on the same row back into lines. ----
function blocksToLines(blocks) {
  const withBox = blocks.filter((b) => Array.isArray(b.bbox) && b.bbox.length === 4 && b.text?.trim());
  if (withBox.length < blocks.length || !withBox.length) return blocks.map((b) => b.text).filter(Boolean);

  // A box might be [x1, y1, x2, y2] or [x, y, width, height]. Guess which one it is.
  const cornerLike = withBox.filter((b) => b.bbox[2] > b.bbox[0] && b.bbox[3] > b.bbox[1]).length / withBox.length >= 0.95;
  const items = withBox.map((b) => {
    const [a, y, c, d] = b.bbox;
    const h = cornerLike ? d - y : d;
    return { text: b.text.trim(), x: a, cy: y + h / 2, h: Math.max(h, 1) };
  });

  const heights = items.map((i) => i.h).sort((p, q) => p - q);
  const tolerance = heights[Math.floor(heights.length / 2)] * 0.6;

  items.sort((p, q) => p.cy - q.cy);
  const rows = [];
  for (const it of items) {
    const row = rows[rows.length - 1];
    if (row && Math.abs(it.cy - row.cy) <= tolerance) { row.items.push(it); row.cy = (row.cy * (row.items.length - 1) + it.cy) / row.items.length; }
    else rows.push({ cy: it.cy, items: [it] });
  }
  return rows.map((r) => r.items.sort((p, q) => p.x - q.x).map((i) => i.text).join(" "));
}

// ---- Step 3: a small web server ----
function readBuffer(req, limit) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > limit) { reject(new Error("Image is too big")); req.destroy(); return; }
      chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}
const json = (res, code, obj) => { res.writeHead(code, { "Content-Type": "application/json" }); res.end(JSON.stringify(obj)); };

const server = http.createServer(async (req, res) => {
  if (req.method === "GET" && req.url === "/") {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    return res.end(await readFile(path.join(__dirname, "public", "index.html")));
  }
  if (req.method === "GET" && req.url === "/api/status") return json(res, 200, status);

  // The page sends a PNG photo; we read the text in it
  if (req.method === "POST" && req.url === "/api/scan") {
    if (!status.ready) return json(res, 503, { error: "Scanner is not ready yet." });
    const tmpFile = path.join(os.tmpdir(), "grades-" + Date.now() + ".png");
    try {
      await writeFile(tmpFile, await readBuffer(req, MAX_IMAGE_BYTES));

      // This is the QVAC call that reads text from an image, on-device
      const { blocks } = ocr({ modelId, image: tmpFile });
      return json(res, 200, { lines: blocksToLines(await blocks) });
    } catch (err) {
      console.error(err);
      return json(res, 500, { error: String(err?.message || err) });
    } finally {
      unlink(tmpFile).catch(() => {}); // delete the temporary photo right away
    }
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(PORT, () => console.log("Server running at http://localhost:" + PORT));
startModel();
