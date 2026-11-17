import type { CardDesign, CardFormat } from "./templates";
import { CARD_FORMATS } from "./templates";

export interface CardContent {
  headline: string;
  recipient: string;
  message: string;
  signature: string;
  badge?: string; // e.g. "30"
}

/** Deterministic pseudo-random so a card renders identically every time. */
function rng(seed: number) {
  let s = seed || 1;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const para of text.split(/\n/)) {
    const words = para.split(/\s+/);
    let line = "";
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = w;
      } else line = test;
    }
    lines.push(line);
  }
  return lines;
}

export function renderCard(
  canvas: HTMLCanvasElement,
  design: CardDesign,
  format: CardFormat,
  content: CardContent,
  fonts: { serif: string; sans: string },
) {
  const { w, h } = CARD_FORMATS[format];
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  const g = ctx.createLinearGradient(0, 0, w, h);
  design.background.forEach((c, i) => g.addColorStop(i / Math.max(1, design.background.length - 1), c));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);

  const rand = rng(design.id.length * 7919 + w);
  ctx.save();
  switch (design.pattern) {
    case "confetti":
      for (let i = 0; i < 70; i++) {
        ctx.fillStyle = [design.accent, "#EAE2EF", "#648B73", "#E7C279"][i % 4];
        ctx.globalAlpha = 0.55;
        ctx.save();
        ctx.translate(rand() * w, rand() * h * 0.35);
        ctx.rotate(rand() * Math.PI);
        ctx.fillRect(-10, -4, 20, 8);
        ctx.restore();
      }
      break;
    case "dots":
      ctx.fillStyle = design.accent;
      ctx.globalAlpha = 0.25;
      for (let y = 40; y < h; y += 60) for (let x = 40; x < w; x += 60) {
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    case "petals":
      ctx.fillStyle = design.accent;
      ctx.globalAlpha = 0.12;
      for (let i = 0; i < 18; i++) {
        ctx.save();
        ctx.translate(w * 0.85, h * 0.12);
        ctx.rotate((i / 18) * Math.PI * 2);
        ctx.beginPath();
        ctx.ellipse(0, 120, 40, 120, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      break;
    case "lines":
      ctx.strokeStyle = design.accent;
      ctx.globalAlpha = 0.25;
      ctx.lineWidth = 3;
      for (let i = -h; i < w; i += 48) {
        ctx.beginPath();
        ctx.moveTo(i, 0);
        ctx.lineTo(i + h * 0.4, h * 0.4);
        ctx.stroke();
      }
      break;
    case "stars":
      ctx.fillStyle = design.accent;
      for (let i = 0; i < 90; i++) {
        ctx.globalAlpha = 0.3 + rand() * 0.6;
        ctx.beginPath();
        ctx.arc(rand() * w, rand() * h, rand() * 2.6 + 0.6, 0, Math.PI * 2);
        ctx.fill();
      }
      break;
    default:
      break;
  }
  ctx.restore();

  // Frame
  ctx.strokeStyle = design.accent;
  ctx.globalAlpha = 0.6;
  ctx.lineWidth = 3;
  ctx.strokeRect(48, 48, w - 96, h - 96);
  ctx.globalAlpha = 1;

  const pad = 120;
  let y = h * 0.3;

  if (content.badge) {
    ctx.fillStyle = design.accent;
    ctx.beginPath();
    ctx.arc(w / 2, y - 70, 78, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = design.background[0];
    ctx.font = `600 84px ${fonts.serif}`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(content.badge, w / 2, y - 66);
    y += 70;
  }

  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = design.ink;
  const headFamily = design.headlineFont === "serif" ? fonts.serif : fonts.sans;
  ctx.font = `600 ${format === "story" ? 120 : 104}px ${headFamily}`;
  for (const line of wrap(ctx, content.headline, w - pad * 2)) {
    ctx.fillText(line, w / 2, y);
    y += format === "story" ? 132 : 116;
  }

  if (content.recipient) {
    ctx.fillStyle = design.accent;
    ctx.font = `italic 500 64px ${fonts.serif}`;
    ctx.fillText(content.recipient, w / 2, y + 10);
    y += 120;
  }

  ctx.fillStyle = design.ink;
  ctx.globalAlpha = 0.9;
  ctx.font = `400 40px ${fonts.sans}`;
  for (const line of wrap(ctx, content.message, w - pad * 2).slice(0, 10)) {
    ctx.fillText(line, w / 2, y);
    y += 58;
  }
  ctx.globalAlpha = 1;

  if (content.signature) {
    ctx.font = `italic 500 44px ${fonts.serif}`;
    ctx.fillStyle = design.ink;
    ctx.fillText(content.signature, w / 2, h - 130);
  }
}
