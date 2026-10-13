// patch-ios-plist.mjs
// Adds the keys the iOS app must have in ios/App/App/Info.plist. That file
// only exists after `npx cap add ios` (Mac + Xcode), so this runs right after
// it - and after every `npm run sync` (see package.json) - and is safe to run
// any number of times: a key that's already there is left exactly as it is.
//
//   NSCameraUsageDescription - the avatar photo picker (<input type="file"
//     accept="image/*"> in index.html) offers "Take Photo" on iOS. Without
//     this string the app CRASHES the moment a player picks it, and App
//     Review rejects it.
//   NSPhotoLibraryUsageDescription - the same picker reading the library.
//   ITSAppUsesNonExemptEncryption = false - the app only uses HTTPS
//     (standard, exempt encryption), so App Store Connect stops asking the
//     export-compliance question on every upload.
//
// Zero dependencies. Does nothing (and says so) when there's no iOS project.

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const plistPath = join(root, 'ios', 'App', 'App', 'Info.plist');

const KEYS = [
    ['NSCameraUsageDescription', '<string>המצלמה משמשת רק כדי לצלם תמונת פרופיל למשחק, ורק כשאתם בוחרים בכך.</string>'],
    ['NSPhotoLibraryUsageDescription', '<string>הגישה לתמונות משמשת רק כדי לבחור תמונת פרופיל למשחק, ורק כשאתם בוחרים בכך.</string>'],
    ['ITSAppUsesNonExemptEncryption', '<false/>']
];

if (!existsSync(plistPath)) {
    console.log('patch-ios-plist: no iOS project yet (ios/App/App/Info.plist) - nothing to patch.');
    process.exit(0);
}

let plist = readFileSync(plistPath, 'utf8');
const added = [];
for (const [key, value] of KEYS) {
    if (plist.includes(`<key>${key}</key>`)) continue;
    // insert just before the closing </dict> of the top-level dictionary
    const end = plist.lastIndexOf('</dict>');
    if (end === -1) throw new Error('patch-ios-plist: Info.plist has no </dict> - not a valid plist?');
    plist = plist.slice(0, end) + `\t<key>${key}</key>\n\t${value}\n` + plist.slice(end);
    added.push(key);
}

if (added.length) {
    writeFileSync(plistPath, plist);
    console.log('patch-ios-plist: added', added.join(', '));
} else {
    console.log('patch-ios-plist: Info.plist already has every key.');
}
