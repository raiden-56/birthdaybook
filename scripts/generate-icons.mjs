// Generates PWA icons and native app icon/splash sources from the brand SVG.
// Usage: npm run icons
import sharp from "sharp";
import { mkdir, writeFile } from "node:fs/promises";

const mark = (bg = true) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  ${bg ? '<rect width="64" height="64" rx="16" fill="#563B5C"/>' : ""}
  <path d="M20 16h16c7 0 11 3.6 11 9 0 3.6-2 6.2-5 7.4 4 1.1 6.5 4 6.5 8.2 0 6-4.7 9.4-12 9.4H20V16Z" fill="#FAF9F6"/>
  <path d="M27 22.5v8h8.2c3 0 4.8-1.5 4.8-4s-1.8-4-4.8-4H27Zm0 13.6v8.4h9c3.3 0 5.3-1.6 5.3-4.2s-2-4.2-5.3-4.2h-9Z" fill="#563B5C"/>
  <circle cx="49" cy="15" r="5" fill="#E78B79"/>
</svg>`;

// Full-bleed square (no rounded corners) for maskable/native icons; content in the safe zone.
const square = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">
  <rect width="100" height="100" fill="#563B5C"/>
  <g transform="translate(18 18) scale(1)">${mark(false).replace(/<\/?svg[^>]*>/g, "")}</g>
</svg>`;

const splash = (size) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" fill="#FAF9F6"/>
  <g transform="translate(${size / 2 - 160} ${size / 2 - 160}) scale(5)">${mark(true).replace(/<\/?svg[^>]*>/g, "")}</g>
</svg>`;

await mkdir("public/icons", { recursive: true });
await mkdir("resources", { recursive: true });

const png = (svg, size) => sharp(Buffer.from(svg)).resize(size, size).png().toBuffer();

await writeFile("public/icons/icon-192.png", await png(mark(), 192));
await writeFile("public/icons/icon-512.png", await png(mark(), 512));
await writeFile("public/icons/maskable-512.png", await png(square(512), 512));
await writeFile("public/icons/apple-touch-icon.png", await png(square(180), 180));
await writeFile("public/icons/badge-96.png", await sharp(Buffer.from(mark(false).replace(/#563B5C/g, "#000").replace(/#FAF9F6/g, "#fff"))).resize(96, 96).png().toBuffer());

// Sources for `npx @capacitor/assets generate` (native icons + splash screens).
await writeFile("resources/icon-only.png", await png(square(1024), 1024));
await writeFile("resources/icon-foreground.png", await sharp(Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 100 100"><g transform="translate(25 25) scale(0.78)">${mark(false).replace(/<\/?svg[^>]*>/g, "")}</g></svg>`)).resize(1024, 1024).png().toBuffer());
await writeFile("resources/icon-background.png", await sharp({ create: { width: 1024, height: 1024, channels: 4, background: "#563B5C" } }).png().toBuffer());
await writeFile("resources/splash.png", await sharp(Buffer.from(splash(2732))).png().toBuffer());
await writeFile("resources/splash-dark.png", await sharp(Buffer.from(splash(2732).replace('fill="#FAF9F6"/>', 'fill="#161317"/>'))).png().toBuffer());
console.log("Icons written to public/icons and resources/");
