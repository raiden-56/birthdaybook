// Injects the list of exported files into out/sw.js so the PWA can precache
// the whole app for offline use. Runs after `next build`.
import { readdir, readFile, writeFile, stat } from "node:fs/promises";
import path from "node:path";

const OUT = path.resolve("out");
// Sub-path hosting (GitHub Pages): every precached URL needs the base path.
const BASE = (process.env.NEXT_PUBLIC_BASE_PATH ?? "").replace(/\/$/, "");

async function walk(dir) {
  const out = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...(await walk(p)));
    else out.push(p);
  }
  return out;
}

const files = await walk(OUT);
const urls = [];
for (const f of files) {
  const rel = "/" + path.relative(OUT, f).split(path.sep).join("/");
  if (rel === "/sw.js" || rel.endsWith(".map") || rel.startsWith("/icons/source")) continue;
  if ((await stat(f)).size > 3 * 1024 * 1024) continue;
  if (rel.endsWith("/index.html")) urls.push(BASE + rel.slice(0, -"index.html".length));
  else if (rel.endsWith(".html") || rel === "/.nojekyll") continue;
  else urls.push(BASE + rel);
}

const buildId = (await readFile(path.join(OUT, "..", ".next", "BUILD_ID"), "utf8").catch(() => Date.now().toString(36))).trim();
const swPath = path.join(OUT, "sw.js");
let sw = await readFile(swPath, "utf8");
sw = sw.replace("__BUILD_ID__", buildId).replace("self.__PRECACHE__ ||", `${JSON.stringify(urls)} ||`);
await writeFile(swPath, sw);
console.log(`[sw] precache list: ${urls.length} files, build ${buildId}`);
