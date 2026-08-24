// generate-icons.mjs
// Generates the full icon/splash asset set from the master logo, using sharp.
//
// Source of truth:  Logo.png.jpeg  (1254x1254, square, opaque)
//
// Produces:
//   assets/                       <- canonical masters for @capacitor/assets
//     logo.png            1024      single-source master (native icon + splash)
//     icon-foreground.png 1024      Android adaptive foreground (logo, safe zone)
//     icon-background.png 1024      Android adaptive background (solid brand blue)
//     splash.png          2732      splash (logo centered on brand blue)
//     splash-dark.png     2732      dark splash
//   store/                        <- ready-to-upload store listing icons
//     app-store-icon-1024.png       App Store Connect (opaque, no alpha)
//     play-store-icon-512.png       Google Play listing
//   (repo root, referenced by manifest.json / index.html)
//     icon-192.png        192       PWA icon (full-bleed, purpose "any")
//     icon-512.png        512       PWA icon (full-bleed, purpose "any")
//     icon-maskable-512.png 512     PWA maskable icon (padded safe zone)
//     apple-touch-icon.png  180     iOS home-screen (opaque)
//
// Run: npm run generate:icons

import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const MASTER = join(root, 'Logo.png.jpeg');

mkdirSync(join(root, 'assets'), { recursive: true });
mkdirSync(join(root, 'store'), { recursive: true });

// Lossless, just a harder DEFLATE search than sharp's default (level 6 /
// effort 7). These are big flat-colour canvases - the 2732px splashes went
// 1.6MB -> 0.33MB each - and every byte here lands in the shipped IPA/AAB.
const PNG_OPTS = { compressionLevel: 9, effort: 10 };

// Sample the master's corner pixel for the brand background color (used for
// splash screens and the Android adaptive background).
async function brandColor() {
    const { data } = await sharp(MASTER)
        .extract({ left: 4, top: 4, width: 1, height: 1 })
        .raw().toBuffer({ resolveWithObject: true });
    return { r: data[0], g: data[1], b: data[2] };
}

// A square PNG of the master resized to `size`, opaque (no alpha).
function squareOpaque(size) {
    return sharp(MASTER).resize(size, size, { fit: 'cover' }).flatten().png(PNG_OPTS);
}

// The logo scaled to `inner` px, centered on a `size` px canvas of `bg`
// (bg alpha 0 => transparent, used for adaptive foreground).
async function padded(size, inner, bg) {
    const logo = await sharp(MASTER).resize(inner, inner, { fit: 'contain' })
        .png(PNG_OPTS).toBuffer();
    return sharp({ create: { width: size, height: size, channels: 4, background: bg } })
        .composite([{ input: logo, gravity: 'centre' }])
        .png(PNG_OPTS);
}

async function run() {
    const c = await brandColor();
    const solid = { ...c, alpha: 1 };
    const dark = { r: Math.round(c.r * 0.5), g: Math.round(c.g * 0.5), b: Math.round(c.b * 0.5), alpha: 1 };
    const transparent = { r: 0, g: 0, b: 0, alpha: 0 };

    const out = (p) => join(root, p);

    // ---- canonical masters (assets/) ----
    await squareOpaque(1024).toFile(out('assets/logo.png'));
    // adaptive foreground: logo at ~62% (Android safe zone), transparent around
    await (await padded(1024, 640, transparent)).toFile(out('assets/icon-foreground.png'));
    // adaptive background: solid brand blue
    await sharp({ create: { width: 1024, height: 1024, channels: 4, background: solid } })
        .png(PNG_OPTS).toFile(out('assets/icon-background.png'));
    // splash: logo centered (~33%) on brand blue
    await (await padded(2732, 900, solid)).toFile(out('assets/splash.png'));
    await (await padded(2732, 900, dark)).toFile(out('assets/splash-dark.png'));

    // ---- store deliverables ----
    // App Store icon MUST be 1024x1024 with NO alpha channel.
    await squareOpaque(1024).removeAlpha().toFile(out('store/app-store-icon-1024.png'));
    await squareOpaque(512).toFile(out('store/play-store-icon-512.png'));

    // ---- PWA / web icons (root) ----
    await squareOpaque(192).toFile(out('icon-192.png'));
    await squareOpaque(512).toFile(out('icon-512.png'));
    await squareOpaque(180).removeAlpha().toFile(out('apple-touch-icon.png'));
    // maskable: padded so nothing important is clipped under a circular mask
    await (await padded(512, 340, solid)).toFile(out('icon-maskable-512.png'));

    console.log(`[generate-icons] done. brand color sampled: rgb(${c.r}, ${c.g}, ${c.b})`);
}

run().catch((e) => { console.error(e); process.exit(1); });
