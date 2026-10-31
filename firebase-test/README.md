# Firebase Emulator tests (local only)

Tests for the 1.2 XP cloud save against a **local** Firebase Emulator. They run
under the demo project `demo-zbang`, which cannot reach the real Firebase
project, and nothing here is deployed.

    cd firebase-test
    npm install        # once (firebase-tools + firebase SDK, free)
    npm test           # starts the emulator, runs tests/, stops it

Needs Java 21 (`brew install openjdk@21`, free); `npm test` puts it on PATH.

- `rules/proposal-v1.2.rules.json` - the PROPOSED rules: today's
  `../database.rules.json` plus the `[1.2 PROPOSAL]` parts in `player_saves`.
  Not live anywhere. Before any deploy it must be compared with the rules that
  are actually live in the Firebase Console.
- `tests/10-rules-and-v11.test.js` runs the real `cloudsave.js` of 1.1 build 4
  (taken from git commit b59bff9) next to the 1.2 logic.
- `tests/20-sync-scenarios.test.js` - two devices, reinstall, old saves,
  offline, diamonds, and the fallback on today's rules.
