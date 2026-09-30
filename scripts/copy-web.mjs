// copy-web.mjs
// Builds the clean `www/` bundle that Capacitor uses as its webDir.
//
// The web app has no bundler - the source files live at the repo root. This
// script copies just the real web assets into `www/`, excluding tooling and
// native-project folders (node_modules, .git, ios, android, etc.), so the
// native app never bundles junk. Run automatically by `npm run sync` /
// `npm run add:ios` etc. (see package.json). Zero dependencies.

import { readdirSync, statSync, mkdirSync, copyFileSync, rmSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = join(root, 'www');

// Anything in here (by exact name, at any level) is never copied into www/.
const EXCLUDE = new Set([
    'node_modules',
    'www',
    '.git',
    '.gitignore',
    '.github',        // CI workflows
    '.claude',
    '.agents',        // design skills for AI tooling, not part of the app
    '.firebaserc',    // Firebase CLI project link (deploy tooling)
    'firebase.json',  // Firebase CLI deploy config
    'ios',
    'android',
    'scripts',
    'docs',
    'package.json',
    'package-lock.json',
    'capacitor.config.json',
    'capacitor.config.ts',
    'database.rules.json', // server-side Firebase rules, not a web asset
    '.DS_Store',
    'Thumbs.db'
]);

// Root-relative paths that are never copied either: build-time image masters
// and store-listing art that nothing in the web app references. (The runtime
// Firebase client settings, firebase-config.js, ARE copied - the game can't
// connect without them, and they're public by design.)
const EXCLUDE_PATHS = new Set([
    'Logo.png.jpeg',              // master for generate-icons.mjs
    'store',                      // Play / App Store listing icons
    'assets/logo.png',            // @capacitor/assets masters (native icon/splash)
    'assets/icon-foreground.png',
    'assets/icon-background.png',
    'assets/splash.png',
    'assets/splash-dark.png'
]);

function copyDir(srcDir, destDir) {
    mkdirSync(destDir, { recursive: true });
    for (const entry of readdirSync(srcDir)) {
        if (EXCLUDE.has(entry)) continue;
        const src = join(srcDir, entry);
        if (EXCLUDE_PATHS.has(relative(root, src).split(sep).join('/'))) continue;
        const dest = join(destDir, entry);
        if (statSync(src).isDirectory()) {
            copyDir(src, dest);
        } else {
            copyFileSync(src, dest);
        }
    }
}

// Start clean so deleted source files don't linger in www/.
rmSync(outDir, { recursive: true, force: true });
copyDir(root, outDir);

console.log('[copy-web] built www/ from project root (excluding native/tooling files)');
