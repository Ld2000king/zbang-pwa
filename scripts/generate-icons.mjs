// generate-icons.mjs
// Generates the full icon/splash asset set from the master logo, using sharp.
//
// Source of truth:  Logo.png.jpeg  (1254x1254, square, opaque)
//
// Produces:
//   assets/                       <- canonical masters for @capacitor/assets
//     logo.png            1024      single-source master (native icon + splash)
//     icon-foreground.png 1024      Android adaptive foreground (full logo over the visible 2/3)
//     icon-background.png 1024      Android adaptive background (the logo's blue gradient)
//     splash.png          2732      splash (logo centered on brand blue)
//     splash-dark.png     2732      dark splash
//   store/                        <- ready-to-upload store listing icons
//     app-store-icon-1024.png       App Store Connect (opaque, no alpha)
//     play-store-icon-512.png       Google Play listing
//   (repo root, referenced by manifest.json / index.html)
//     icon-192.png        192       PWA icon (full-bleed, purpose "any")
//     icon-512.png        512       PWA icon (full-bleed, purpose "any")
//     icon-maskable-512.png 512     PWA maskable icon (full logo, edge to edge)
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

// A square PNG of the master resized to `size`, opaque (no alpha).
function squareOpaque(size) {
    return sharp(MASTER).resize(size, size, { fit: 'cover' }).flatten().png();
}

// The logo centered on its own blue: a radial gradient from the
// master's lighter middle-blue to its dark corner, with the logo's square
// edges feathered into it. The master's background is itself a gradient, so a
// flat fill sampled from one corner leaves a visible square around the logo.
async function sample(x, y) {
    const { data } = await sharp(MASTER).extract({ left: x, top: y, width: 1, height: 1 })
        .raw().toBuffer({ resolveWithObject: true });
    return `rgb(${data[0]},${data[1]},${data[2]})`;
}

async function featheredLogo(inner) {
    const inset = Math.round(inner * 0.1);
    const mask = await sharp(Buffer.from(
        `<svg width="${inner}" height="${inner}"><rect x="${inset}" y="${inset}" width="${inner - 2 * inset}" height="${inner - 2 * inset}" rx="${inset * 2}" fill="#fff"/></svg>`))
        .blur(Math.max(1, inset * 0.6)).png().toBuffer();
    return sharp(MASTER).resize(inner, inner, { fit: 'contain' })
        .ensureAlpha().composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
}

async function gradientBackdrop(size) {
    const mid = await sample(627, 1150);
    const edge = await sample(4, 4);
    return sharp(Buffer.from(
        `<svg width="${size}" height="${size}"><defs><radialGradient id="g" cx="50%" cy="50%" r="70%"><stop offset="0" stop-color="${mid}"/><stop offset="1" stop-color="${edge}"/></radialGradient></defs><rect width="100%" height="100%" fill="url(#g)"/></svg>`))
        .png().toBuffer();
}

async function paddedOnGradient(size, inner) {
    return sharp(await gradientBackdrop(size))
        .composite([{ input: await featheredLogo(inner), gravity: 'centre' }]).png();
}

async function run() {
    const transparent = { r: 0, g: 0, b: 0, alpha: 0 };

    const out = (p) => join(root, p);

    // ---- canonical masters (assets/) ----
    await squareOpaque(1024).toFile(out('assets/logo.png'));
    // adaptive foreground: the whole logo, edge to edge, over exactly the part
    // of the 108dp layer a launcher shows (the middle 72dp = 2/3). So on the
    // phone the icon is the logo itself, filling its shape, with no border.
    const visible = Math.round(1024 * 72 / 108);
    const fullLogo = await sharp(MASTER).resize(visible, visible, { fit: 'cover' }).png().toBuffer();
    await sharp({ create: { width: 1024, height: 1024, channels: 4, background: transparent } })
        .composite([{ input: fullLogo, gravity: 'centre' }]).png()
        .toFile(out('assets/icon-foreground.png'));
    // adaptive background: the logo's own blue gradient
    await sharp(await gradientBackdrop(1024)).toFile(out('assets/icon-background.png'));
    // splash: logo centered (~33%) on brand blue
    await (await paddedOnGradient(2732, 900)).toFile(out('assets/splash.png'));
    await sharp(await sharp(await gradientBackdrop(2732)).modulate({ brightness: 0.55 }).png().toBuffer())
        .composite([{ input: await featheredLogo(900), gravity: 'centre' }]).png()
        .toFile(out('assets/splash-dark.png'));

    // ---- store deliverables ----
    // App Store icon MUST be 1024x1024 with NO alpha channel.
    await squareOpaque(1024).removeAlpha().toFile(out('store/app-store-icon-1024.png'));
    await squareOpaque(512).toFile(out('store/play-store-icon-512.png'));

    // ---- PWA / web icons (root) ----
    await squareOpaque(192).toFile(out('icon-192.png'));
    await squareOpaque(512).toFile(out('icon-512.png'));
    await squareOpaque(180).removeAlpha().toFile(out('apple-touch-icon.png'));
    // maskable: the full logo edge to edge, like the other icons. Its
    // background reaches the corners, so a circular or rounded mask only
    // trims blue - the crown, title and side tiles all sit inside the circle.
    await squareOpaque(512).toFile(out('icon-maskable-512.png'));

    console.log('[generate-icons] done.');
}

run().catch((e) => { console.error(e); process.exit(1); });
