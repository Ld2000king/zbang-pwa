// ============================================================================
// City themes - every arena city re-skins the WHOLE game, not just the board.
//
// A theme is a set of values for the island tokens in style.css (wood frame,
// cream panels, sky, foliage, felt, title gold) plus a painted skyline that
// sits at the bottom of #app. Since game.css reads everything through those
// tokens, applyCityTheme() only has to overwrite them on <html> - no per-city
// CSS. The action colors (green play, gold shop, purple royale...) are left
// alone on purpose, so every button keeps its meaning in every city.
//
// CITY_THEMES is indexed exactly like ARENAS in game.js (0 = מזכרת בתיה).
// ============================================================================

(function () {
    // ---- tiny SVG helpers for the skylines (240x150 box, ground at bottom) ----
    const r = (x, y, w, h, f, rx = 0) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${f}"/>`;
    const p = (pts, f) => `<polygon points="${pts}" fill="${f}"/>`;
    const c = (x, y, rr, f) => `<circle cx="${x}" cy="${y}" r="${rr}" fill="${f}"/>`;
    const e = (x, y, rx, ry, f) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${f}"/>`;
    const path = (d, f, s = '', sw = 0) => `<path d="${d}" fill="${f}"${s ? ` stroke="${s}" stroke-width="${sw}" stroke-linecap="round"` : ''}/>`;
    const windows = (x, y, w, h, col, step = 6) => {
        let s = '';
        for (let yy = y + 4; yy < y + h - 4; yy += step)
            for (let xx = x + 3; xx < x + w - 4; xx += step) s += r(xx, yy, 2.5, 3, col);
        return s;
    };
    const palm = (x, y, s = 1, trunk = '#8A5A2E', leaf = '#3E8E2E') =>
        `<g transform="translate(${x} ${y}) scale(${s})">${path('M0 0 Q4 -20 2 -40', 'none', trunk, 4)}` +
        `${path('M2 -40 q-18 -6 -26 6 q12 -10 26 -6z', leaf)}${path('M2 -40 q18 -6 26 6 q-12 -10 -26 -6z', leaf)}` +
        `${path('M2 -40 q-10 -14 -22 -12 q12 0 22 12z', leaf)}${path('M2 -40 q10 -14 22 -12 q-12 0 -22 12z', leaf)}</g>`;
    const tree = (x, y, s, trunk, leaf) =>
        `${r(x - 1.5 * s, y - 8 * s, 3 * s, 8 * s, trunk)}${c(x, y - 12 * s, 7 * s, leaf)}${c(x - 4 * s, y - 9 * s, 5 * s, leaf)}${c(x + 4 * s, y - 9 * s, 5 * s, leaf)}`;
    const waves = (y, col) => path(`M0 ${y} q12 -4 24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0 t24 0`, 'none', col, 1.5);
    const range = (n, fn) => Array.from({ length: n }, (_, i) => fn(i)).join('');

    // ---- one skyline per city ----
    const SCENES = {
        mazkeret: () => c(196, 34, 14, '#FFE69A') +
            path('M0 92 Q60 70 120 86 T240 80 V150 H0z', '#B9C98A') +
            r(150, 58, 16, 18, '#E7E0CC', 2) + r(148, 54, 20, 6, '#B5462F', 2) + r(153, 76, 2, 26, '#6B4A2A') + r(161, 76, 2, 26, '#6B4A2A') +
            path('M153 88 L163 80 M163 88 L153 80', 'none', '#6B4A2A', 1.2) +
            p('30,100 44,88 58,100', '#C4513A') + r(32, 100, 24, 14, '#F2E6CC') + r(40, 105, 6, 9, '#8A5A2E') +
            p('70,104 82,94 94,104', '#C4513A') + r(72, 104, 20, 11, '#F2E6CC') +
            path('M0 110 Q120 98 240 108 V150 H0z', '#D9B85C') +
            range(14, i => path(`M${-4 + i * 18} 150 Q${4 + i * 18} 124 ${14 + i * 18} 112`, 'none', '#B8923A', 2)) +
            range(22, i => path(`M${6 + i * 11} 140 v-12`, 'none', '#A07A2C', 1.4) + e(6 + i * 11, 127, 2, 4, '#E9C868')),
        ashdod: () => c(40, 30, 12, '#FFF1B0') +
            r(0, 98, 240, 52, '#2F7FAC') + waves(106, '#7CC3E8') +
            r(120, 70, 120, 30, '#6C7A86') +
            [['#D9533E', 124], ['#4FA8D8', 140], ['#F2C14E', 156], ['#3E9C5E', 172], ['#D9533E', 188], ['#4FA8D8', 204], ['#F2C14E', 220]]
                .map(([f, x], i) => r(x, 82 - (i % 2) * 8, 15, 8, f) + r(x, 90, 15, 8, i % 3 ? '#2F7FAC' : '#E07A3E')).join('') +
            path('M150 70 V20 H198 M150 20 L186 20 L186 34', 'none', '#E8603C', 3) + path('M150 24 L166 20', 'none', '#E8603C', 2) +
            path('M205 70 V28 H232', 'none', '#F2C14E', 3) +
            path('M20 118 H100 L92 132 H28z', '#1E3A52') + r(62, 104, 24, 14, '#F1F7FB', 2) + r(70, 98, 8, 6, '#D9533E') +
            r(0, 136, 240, 14, '#24688F'),
        beersheva: () => c(170, 40, 22, '#FFD58A') +
            path('M0 96 Q50 76 100 94 T200 86 T240 92 V150 H0z', '#E8B97A') +
            path('M0 116 Q70 96 140 114 T240 108 V150 H0z', '#D9A15E') +
            path('M0 132 Q60 118 120 132 T240 128 V150 H0z', '#B67A3C') +
            r(58, 92, 3, 22, '#6B4424') + e(60, 90, 20, 5, '#6E8C3A') + e(52, 88, 9, 4, '#7FA046') +
            r(170, 94, 26, 18, '#C99464') + p('168,94 183,84 198,94', '#A8672E') + r(180, 102, 6, 10, '#6B4424') +
            path('M108 126 q4 -10 10 -6 q2 -6 8 -2 q6 -2 6 6 v4 h-2 v6 h-2 v-6 h-10 v6 h-2 v-6 h-3z', '#8A5A2E'),
        haifa: () => c(200, 30, 11, '#FFF1B0') +
            r(0, 110, 240, 40, '#3A8FC4') +
            path('M0 110 L20 110 Q90 50 170 42 Q220 40 240 46 V150 H0z', '#2C6B3F') +
            range(7, i => path(`M${70 + i * 12} ${118 - i * 9} h24`, 'none', '#7FB06A', 3)) +
            path('M92 150 L150 64', 'none', '#E9DFC4', 5) +
            r(146, 60, 18, 10, '#EFE8D6') + path('M144 60 Q155 38 166 60z', '#E8B838') + r(154, 36, 2, 5, '#E8B838') +
            tree(110, 112, 1, '#4E3116', '#1B4A29') + tree(190, 64, 1, '#4E3116', '#1B4A29') + tree(210, 70, 0.8, '#4E3116', '#1B4A29') +
            r(0, 128, 240, 22, '#2A6F99'),
        rishon: () => c(50, 36, 16, '#FFD3A0') +
            path('M0 96 Q70 76 140 92 T240 84 V150 H0z', '#9DB25C') +
            range(8, i => path(`M${-10 + i * 34} 150 Q${40 + i * 20} 110 ${120 + i * 15} 96`, 'none', '#5C7428', 3)) +
            range(30, i => c(10 + (i * 37) % 230, 110 + (i * 13) % 38, 2.2, '#7B2E52')) +
            r(150, 72, 70, 34, '#E8D2B8') + p('146,72 185,54 224,72', '#97374E') +
            path('M172 106 v-14 a8 8 0 0 1 16 0 v14z', '#5C2130') + r(156, 80, 8, 8, '#5C2130', 1) + r(206, 80, 8, 8, '#5C2130', 1) +
            e(140, 112, 8, 10, '#8A5A2E') + path('M132 106 h16 M132 118 h16', 'none', '#4A1E2A', 1.5),
        telaviv: () => c(190, 34, 14, '#FFE0A8') +
            r(12, 40, 16, 74, '#6D5A92') + windows(12, 40, 16, 74, '#FFD1E8') +
            r(34, 26, 20, 88, '#8A6FB0') + c(44, 26, 9, '#8A6FB0') + windows(34, 30, 20, 84, '#FFD1E8') +
            r(60, 34, 18, 80, '#5D4C82') + p('60,34 78,34 60,18', '#5D4C82') + windows(60, 34, 18, 80, '#FFD1E8') +
            r(84, 28, 18, 86, '#735FA0') + r(84, 20, 18, 8, '#735FA0') + windows(84, 28, 18, 86, '#FFD1E8') +
            r(110, 58, 24, 56, '#F4F0EA') + path('M110 70 h24 M110 82 h24 M110 94 h24', 'none', '#C9C1D6', 2) +
            r(140, 66, 30, 48, '#F9F4EC') + r(143, 70, 24, 4, '#D45FA6') +
            r(178, 52, 14, 62, '#4A3C6E') + windows(178, 52, 14, 62, '#FFD1E8') +
            r(198, 72, 34, 42, '#FBF3E8') + path('M198 84 h34 M198 96 h34', 'none', '#D9CBB8', 2) +
            r(0, 114, 240, 14, '#F2D9A6') + r(0, 128, 240, 22, '#3C9FD0') +
            palm(222, 118, 0.55, '#6B4A2A', '#2E7A3A') + palm(100, 118, 0.5, '#6B4A2A', '#2E7A3A'),
        jerusalem: () => c(56, 36, 13, '#FFF0C0') +
            path('M0 92 Q60 72 120 84 T240 76 V150 H0z', '#CDB98A') +
            r(150, 40, 30, 64, '#E3D3AE') + r(146, 34, 38, 8, '#D2BF92') + range(5, i => r(146 + i * 8, 28, 5, 7, '#D2BF92')) +
            r(160, 52, 10, 14, '#8A7550', 5) + r(156, 76, 5, 8, '#8A7550', 2) + r(170, 76, 5, 8, '#8A7550', 2) +
            r(0, 96, 240, 40, '#E3D3AE') + range(24, i => r(i * 10, 90, 6, 7, '#E3D3AE')) +
            range(6, i => path(`M0 ${104 + i * 6} H240`, 'none', '#CDB98A', 1)) +
            path('M96 136 v-18 a10 10 0 0 1 20 0 v18z', '#8A7550') +
            [30, 48, 210, 224].map(x => e(x, 110, 4, 16, '#3E5A2A') + r(x - 1, 124, 2, 6, '#4E3116')).join('') +
            r(0, 136, 240, 14, '#C7B284'),
        eilat: () => c(120, 30, 13, '#FFF0B0') +
            p('0,100 30,54 60,86 90,48 130,92 160,60 200,94 240,66 240,110 0,110', '#C2542C') +
            p('30,54 44,72 38,70 50,90 60,86', '#9E3E1C') + p('90,48 104,66 98,68 112,80', '#9E3E1C') +
            r(0, 106, 240, 44, '#1E9CC0') + waves(116, '#8CE0F0') +
            r(0, 134, 240, 16, '#F2D9A6') + palm(30, 138, 0.7) + palm(204, 138, 0.6) +
            `<g transform="translate(140 124)">${e(0, 0, 8, 4, '#FFB24C')}${p('7,0 12,-4 12,4', '#FFB24C')}${c(-4, -1, 1, '#1E3A52')}</g>` +
            `<g transform="translate(96 120)">${e(0, 0, 6, 3, '#FF6FA0')}${p('5,0 9,-3 9,3', '#FF6FA0')}</g>`,
        hadera: () => c(40, 34, 12, '#FFF1C0') +
            path('M0 96 Q80 80 160 92 T240 88 V150 H0z', '#A7BD76') +
            [176, 200].map(x => p(`${x},104 ${x + 4},20 ${x + 12},20 ${x + 16},104`, '#EDEDED') +
                [0, 1, 2, 3].map(k => r(x + 4 - k * 0.8, 28 + k * 20, 8 + k * 1.6, 8, '#D9533E')).join('')).join('') +
            r(166, 96, 58, 12, '#B8B2A4') +
            [20, 40, 62, 86, 110].map((x, i) => r(x - 1, 70 + i % 2 * 6, 3, 40, '#E2D8C4') + e(x, 66 + i % 2 * 6, 9, 14, '#6C8540') + e(x + 5, 76 + i % 2 * 6, 6, 9, '#7F9B4E')).join('') +
            r(120, 98, 40, 14, '#C0A176') + path('M120 98 h40', 'none', '#96794F', 3) + path('M134 112 v-8 a6 6 0 0 1 12 0 v8z', '#6B4A2A') +
            path('M0 118 Q120 108 240 116 V150 H0z', '#8FA85A'),
        tiberias: () => c(190, 28, 12, '#FFF0B0') +
            path('M0 76 Q40 60 90 70 T170 62 T240 68 V100 H0z', '#8FAE84') +
            path('M0 86 Q60 76 120 84 T240 80 V100 H0z', '#7F9B6A') +
            r(0, 96, 240, 34, '#2A8695') + path('M10 104 q10 -3 20 0 t20 0 t20 0 M130 112 q10 -3 20 0 t20 0 t20 0', 'none', '#8CD6DE', 1.5) +
            path('M92 110 h40 l-6 8 h-28z', '#6B4A2A') + path('M110 110 V86', 'none', '#4E3116', 1.5) + p('111,88 111,108 126,108', '#F4EDE0') +
            r(0, 126, 240, 24, '#3E4A4E') + range(12, i => r(i * 20 + (i % 2) * 6, 128 + (i % 2) * 9, 16, 7, '#556368', 2)) +
            palm(210, 128, 0.55, '#6B4A2A', '#3E7A3A'),
        ashkelon: () => c(60, 32, 13, '#FFF4C0') +
            r(0, 86, 240, 30, '#4497B4') + waves(96, '#A8DDEE') +
            path('M0 112 Q60 104 120 110 T240 106 V150 H0z', '#EBD6A4') +
            [140, 158, 176, 194].map((x, i) => {
                const top = i === 2 ? 96 : 78, h = i === 2 ? 20 : 38;
                return r(x, top, 9, h, '#F4EAD2') + r(x - 2, top - 2, 13, 4, '#E0D2B0');
            }).join('') +
            r(136, 74, 50, 5, '#E0D2B0') + r(186, 114, 20, 6, '#E0D2B0', 2) +
            e(60, 126, 14, 4, '#D4B878') + path('M40 122 l6 -14 l6 14z', '#F26B5B') + r(45, 108, 2, 16, '#8A5A2E'),
        netanya: () => c(176, 30, 12, '#FFF4C8') +
            r(0, 92, 240, 58, '#45589F') + waves(104, '#9FB0EA') +
            path('M110 150 L118 96 Q130 84 160 82 L240 78 V150z', '#D8B880') +
            path('M118 96 Q130 84 160 82 L240 78 V86 L160 90 Q132 92 124 104z', '#C29A5C') +
            r(160, 48, 20, 34, '#F2F4FA') + windows(160, 48, 20, 34, '#8FA2E0') +
            r(186, 56, 22, 26, '#E6EAF6') + windows(186, 56, 22, 26, '#8FA2E0') +
            r(214, 40, 18, 42, '#F2F4FA') + windows(214, 40, 18, 42, '#8FA2E0') +
            path('M126 78 V104', 'none', '#6B7FD8', 3) + r(122, 74, 8, 8, '#6B7FD8', 2) +
            `<g transform="translate(58 58)">${p('0,-12 10,-2 0,12 -10,-2', '#CFE0FF')}${p('0,-12 10,-2 0,-2', '#FFFFFF')}${p('-10,-2 0,-2 0,12', '#9FB6F0')}</g>`,
        herzliya: () => c(50, 30, 11, '#FFF0D8') +
            r(120, 30, 24, 74, '#8FB6E8') + windows(120, 30, 24, 74, '#E6F0FF', 7) +
            r(150, 44, 26, 60, '#A8C4F0') + windows(150, 44, 26, 60, '#E6F0FF', 7) +
            r(182, 24, 20, 80, '#7FA3DC') + windows(182, 24, 20, 80, '#E6F0FF', 7) +
            r(206, 52, 28, 52, '#B8CCF4') + windows(206, 52, 28, 52, '#E6F0FF', 7) +
            r(0, 102, 240, 48, '#714AA3') + waves(112, '#B9A0DD') +
            [20, 50, 80].map(x => path(`M${x} 118 h24 l-4 6 h-16z`, '#FFFFFF') + path(`M${x + 10} 118 V78`, 'none', '#E6E0F0', 1.5) + p(`${x + 11},80 ${x + 11},116 ${x + 24},116`, '#F4EEFB')).join('') +
            r(0, 134, 240, 16, '#9B6FD4') + r(0, 132, 240, 3, '#E8DDF6'),
        petahtikva: () => c(190, 32, 14, '#FFE6A8') +
            path('M0 90 Q80 78 160 88 T240 84 V150 H0z', '#6E9A3E') +
            r(24, 48, 16, 48, '#E8D2B0') + r(20, 40, 24, 10, '#C98B4A', 2) + r(22, 96, 20, 4, '#B06A1B') + path('M32 40 V30', 'none', '#8A5A2E', 2) +
            r(196, 56, 10, 38, '#B8B2A4') + r(170, 76, 44, 20, '#D6C6AE') + p('170,76 184,66 184,76', '#C0AE94') + p('184,76 198,66 198,76', '#C0AE94') +
            [60, 90, 120, 150].map((x, i) => {
                const d = i % 2 * 6;
                return r(x - 1.5, 104 + d, 3, 10, '#6B4A2A') + c(x, 98 + d, 11, '#3F7A2E') + c(x - 5, 95 + d, 2.2, '#F29A2E') + c(x + 4, 101 + d, 2.2, '#F29A2E') + c(x + 1, 92 + d, 2.2, '#F29A2E');
            }).join('') +
            path('M0 124 Q120 114 240 122 V150 H0z', '#4F7F2A') +
            [20, 110, 190].map(x => r(x - 1.5, 130, 3, 10, '#6B4A2A') + c(x, 124, 10, '#3A6E26') + c(x - 3, 121, 2, '#F29A2E') + c(x + 4, 126, 2, '#F29A2E')).join(''),
        raanana: () => c(60, 30, 12, '#FFF6C8') +
            path('M0 90 Q80 76 160 86 T240 82 V150 H0z', '#8FBF5E') +
            e(130, 116, 48, 10, '#5FA8C8') + e(130, 114, 40, 6, '#8CCBE0') +
            [20, 44, 190, 216, 160].map((x, i) => tree(x, 108 + i % 2 * 4, 1.3, '#4E3116', i % 2 ? '#4C7A28' : '#3F6A20')).join('') +
            path('M0 138 Q70 126 120 132 T240 128', 'none', '#E6D6B0', 7) +
            r(80, 124, 20, 3, '#8A5A2E') + r(82, 127, 2, 6, '#6B4A2A') + r(96, 127, 2, 6, '#6B4A2A') + r(80, 118, 20, 3, '#8A5A2E') +
            `<g transform="translate(206 128)" fill="none" stroke="#33551A" stroke-width="1.5"><circle cx="-6" cy="0" r="4"/><circle cx="6" cy="0" r="4"/><path d="M-6 0 L0 -6 L6 0 M0 -6 L-2 -9"/></g>`,
        ramatgan: () => range(22, i => c((i * 53) % 240, (i * 29) % 70 + 6, i % 3 ? 0.9 : 1.5, '#FFFFFF')) +
            c(40, 30, 10, '#F4EEFF') + c(44, 27, 9, '#3B2C66') +
            r(10, 70, 26, 70, '#2C2152') + windows(10, 70, 26, 70, '#FFD86B', 7) +
            r(44, 50, 24, 90, '#35285F') + windows(44, 50, 24, 90, '#FFD86B', 7) +
            r(78, 14, 30, 126, '#3E2E70') + windows(78, 20, 30, 120, '#E8DCFF', 7) + p('78,14 93,0 108,14', '#8E63C9') +
            r(116, 38, 26, 102, '#2E2358') + windows(116, 38, 26, 102, '#FFD86B', 7) +
            r(150, 58, 24, 82, '#35285F') + windows(150, 58, 24, 82, '#FFD86B', 7) +
            `<g transform="translate(206 60)">${p('0,-14 12,-3 0,14 -12,-3', '#C8B0F4')}${p('0,-14 12,-3 0,-3', '#F2EAFF')}${p('-12,-3 0,-3 0,14', '#8E63C9')}</g>` +
            r(184, 82, 44, 58, '#2C2152') + windows(184, 82, 44, 58, '#FFD86B', 7) +
            r(0, 136, 240, 14, '#1E1636')
    };

    // ---- the palette of each city ----
    // frame = the carved ring (--wood-dark), rim = plank material (--wood),
    // rimLight = the plank's lit edge, cream..creamHi = the panel ladder,
    // sand/sandDeep = the base under cream buttons, felt = the board table,
    // jungle = the foliage in the screen corners, title = carved headline
    // fill, worldInk/worldHalo = text that sits straight on the sky.
    const T = (o) => Object.assign({
        cloud: 'rgba(255, 255, 255, 0.85)',
        sun: 'rgba(255, 246, 198, 0.9)',
        worldHalo: null
    }, o);

    const CITY_THEMES = [
        T({ scene: 'mazkeret', sky: '#9FD3EE', skyLow: '#F7EBC8',
            frame: '#4E3116', rim: '#8A5A2E', rimLight: '#A9743F',
            cream: '#FDF4DC', cream2: '#F6E7C0', cream3: '#EFD9A6', creamHi: '#FFFBEF',
            sand: '#EBD6A4', sandDeep: '#D4B878', ink: '#4E3116', ink2: '#8A6A48',
            felt: '#B7C96A', feltDeep: '#9DB252', jungle: '#8FB04A', jungleDeep: '#5E8430',
            title: '#FFD873', worldInk: '#5A3A17' }),
        T({ scene: 'ashdod', sky: '#6CB8E6', skyLow: '#D6EEF9',
            frame: '#1E3A52', rim: '#3E6E94', rimLight: '#5A8CB4',
            cream: '#F3F8FC', cream2: '#DCEAF4', cream3: '#C8DCEA', creamHi: '#FFFFFF',
            sand: '#CFE0EC', sandDeep: '#9DB9CF', ink: '#1E3A52', ink2: '#5B7A92',
            felt: '#BFE0F0', feltDeep: '#9CCBE3', jungle: '#3E8E5A', jungleDeep: '#2A6A40',
            title: '#FFE07A', worldInk: '#1E3A52' }),
        T({ scene: 'beersheva', sky: '#F4BE7E', skyLow: '#FBE8C8',
            frame: '#5E3417', rim: '#A8672E', rimLight: '#C4834A',
            cream: '#FBEEDD', cream2: '#F3DCBE', cream3: '#EAC89E', creamHi: '#FFF8EE',
            sand: '#EFD2AA', sandDeep: '#CFA574', ink: '#5E3417', ink2: '#946844',
            felt: '#E8C590', feltDeep: '#D6AE72', jungle: '#8C9A4A', jungleDeep: '#6A7434',
            title: '#FFE2A8', worldInk: '#5E3417' }),
        T({ scene: 'haifa', sky: '#8CC6E8', skyLow: '#DDF0F7',
            frame: '#1F3A26', rim: '#4C7A52', rimLight: '#6A9A70',
            cream: '#F2F7EC', cream2: '#DDEAD3', cream3: '#C8DCBA', creamHi: '#FBFEF7',
            sand: '#D2E3C4', sandDeep: '#9FBF8C', ink: '#1F3A26', ink2: '#5A7A5E',
            felt: '#A9CE9A', feltDeep: '#8DBB7C', jungle: '#2F7A3A', jungleDeep: '#1B4A29',
            title: '#FFD873', worldInk: '#1F3A26' }),
        T({ scene: 'rishon', sky: '#F2B7A0', skyLow: '#FBE6D8',
            frame: '#4A1E2A', rim: '#7E3446', rimLight: '#9E4C60',
            cream: '#FCF1EF', cream2: '#F3DADD', cream3: '#E8C2C8', creamHi: '#FFF9F8',
            sand: '#EDCDD2', sandDeep: '#C999A3', ink: '#4A1E2A', ink2: '#8A5A66',
            felt: '#E6B3BE', feltDeep: '#D697A5', jungle: '#6E8A34', jungleDeep: '#4E6624',
            title: '#FFD6A0', worldInk: '#4A1E2A' }),
        T({ scene: 'telaviv', sky: '#FFB08A', skyLow: '#FFDDE8',
            frame: '#2A2238', rim: '#5D4C82', rimLight: '#7A68A0',
            cream: '#FFF7FA', cream2: '#F9E2EE', cream3: '#F0CADF', creamHi: '#FFFFFF',
            sand: '#F2D2E3', sandDeep: '#CFA0BC', ink: '#2A2238', ink2: '#7A6A8E',
            felt: '#F2C4DE', feltDeep: '#E6A6CA', jungle: '#3E9A4E', jungleDeep: '#2A7038',
            title: '#FFB3DA', worldInk: '#2A2238' }),
        T({ scene: 'jerusalem', sky: '#A9D2EE', skyLow: '#F4EBD8',
            frame: '#5A4A2C', rim: '#9C8656', rimLight: '#B8A274',
            cream: '#FBF6EA', cream2: '#EFE5CF', cream3: '#E3D3AE', creamHi: '#FFFDF6',
            sand: '#E6D8B6', sandDeep: '#C7B284', ink: '#4A3D22', ink2: '#857454',
            felt: '#E6D6AE', feltDeep: '#D2BE8E', jungle: '#5E7A3A', jungleDeep: '#3E5A2A',
            title: '#F7C94A', worldInk: '#4A3D22' }),
        T({ scene: 'eilat', sky: '#6FD0E8', skyLow: '#D3F2F8',
            frame: '#5A2414', rim: '#C55628', rimLight: '#DB7446',
            cream: '#FFF4EC', cream2: '#FBDDCB', cream3: '#F3C6AC', creamHi: '#FFFAF6',
            sand: '#F5CFB9', sandDeep: '#D69C7C', ink: '#5A2414', ink2: '#9A5A42',
            felt: '#8FDCE4', feltDeep: '#6CC8D4', jungle: '#3E9A4E', jungleDeep: '#2A7038',
            title: '#FFD27A', worldInk: '#5A2414' }),
        T({ scene: 'hadera', sky: '#B9D9EA', skyLow: '#EEF2EA',
            frame: '#4F3F28', rim: '#96794F', rimLight: '#B09468',
            cream: '#F9F3E7', cream2: '#ECE1CB', cream3: '#DFD0B0', creamHi: '#FFFCF4',
            sand: '#E4D6BA', sandDeep: '#BFA984', ink: '#4F3F28', ink2: '#857056',
            felt: '#C9D6A2', feltDeep: '#B2C284', jungle: '#6C8540', jungleDeep: '#4F6630',
            title: '#FFDFA0', worldInk: '#4F3F28' }),
        T({ scene: 'tiberias', sky: '#97D2E6', skyLow: '#E6F4F2',
            frame: '#22343A', rim: '#4E6E74', rimLight: '#6E8E94',
            cream: '#F1F8F7', cream2: '#D8EBE9', cream3: '#C0DCD9', creamHi: '#FAFEFD',
            sand: '#CBE2DF', sandDeep: '#8FB5B1', ink: '#22434A', ink2: '#5E7E84',
            felt: '#BFE6E8', feltDeep: '#9ED4D8', jungle: '#5E8A4E', jungleDeep: '#3E6A34',
            title: '#FFE08A', worldInk: '#22434A' }),
        T({ scene: 'ashkelon', sky: '#8ED3F0', skyLow: '#EDF8FB',
            frame: '#2E4A58', rim: '#5F8C9E', rimLight: '#7FA8B8',
            cream: '#FEFBF3', cream2: '#EEF1E8', cream3: '#E4E2CC', creamHi: '#FFFFFB',
            sand: '#EBD6A4', sandDeep: '#D4B878', ink: '#2E4A58', ink2: '#6A8490',
            felt: '#F0DDAE', feltDeep: '#E0C88E', jungle: '#5EA048', jungleDeep: '#3E7A30',
            title: '#FFE39A', worldInk: '#2E4A58' }),
        T({ scene: 'netanya', sky: '#7EB7E8', skyLow: '#E8EEFA',
            frame: '#243066', rim: '#45589F', rimLight: '#6173B8',
            cream: '#F4F6FC', cream2: '#DDE3F5', cream3: '#C8D1EE', creamHi: '#FFFFFF',
            sand: '#D3DBF2', sandDeep: '#9AA8DA', ink: '#243066', ink2: '#5E6A9E',
            felt: '#C3CDF0', feltDeep: '#A6B4E6', jungle: '#4E8A4E', jungleDeep: '#336A38',
            title: '#D6E2FF', worldInk: '#243066' }),
        T({ scene: 'herzliya', sky: '#A7C7F0', skyLow: '#F1EBFB',
            frame: '#34214F', rim: '#714AA3', rimLight: '#8C66BF',
            cream: '#F9F5FD', cream2: '#E8DDF6', cream3: '#D8C8EF', creamHi: '#FFFFFF',
            sand: '#DDCFF2', sandDeep: '#AE95D6', ink: '#34214F', ink2: '#76629A',
            felt: '#D9C8F0', feltDeep: '#C4ADE6', jungle: '#4E9A5E', jungleDeep: '#2E7040',
            title: '#E7D2FF', worldInk: '#34214F' }),
        T({ scene: 'petahtikva', sky: '#FFCF94', skyLow: '#FFF2DE',
            frame: '#5A3212', rim: '#B06A1B', rimLight: '#C98534',
            cream: '#FFF7EC', cream2: '#F8E3C6', cream3: '#F0CFA2', creamHi: '#FFFCF6',
            sand: '#F2D6B0', sandDeep: '#D6A770', ink: '#5A3212', ink2: '#94643A',
            felt: '#F2CF9E', feltDeep: '#E6B97C', jungle: '#3F7A2E', jungleDeep: '#2A5A1E',
            title: '#FFD27A', worldInk: '#5A3212' }),
        T({ scene: 'raanana', sky: '#A6D8E8', skyLow: '#EDF6E4',
            frame: '#2E4418', rim: '#6A8F3E', rimLight: '#86AA58',
            cream: '#F6FAEE', cream2: '#E3EED0', cream3: '#D0E2B4', creamHi: '#FDFFF8',
            sand: '#D8E7C0', sandDeep: '#A6C27E', ink: '#2E4418', ink2: '#667A50',
            felt: '#BCD89A', feltDeep: '#A2C67C', jungle: '#4C7A28', jungleDeep: '#33551A',
            title: '#E8F59A', worldInk: '#2E4418' }),
        T({ scene: 'ramatgan', sky: '#241A45', skyLow: '#6A4AA8',
            frame: '#1C1233', rim: '#67409A', rimLight: '#8058B4',
            cream: '#F6F2FC', cream2: '#E6DDF5', cream3: '#D4C6EE', creamHi: '#FFFFFF',
            sand: '#DCD0F2', sandDeep: '#A892D8', ink: '#2A1D45', ink2: '#6E5E8E',
            felt: '#CDB8EE', feltDeep: '#B69CE4', jungle: '#3A2A60', jungleDeep: '#241A45',
            title: '#E2D0FF', worldInk: '#F2EAFF', worldHalo: 'rgba(28, 18, 51, 0.55)',
            cloud: 'rgba(255, 255, 255, 0.10)', sun: 'rgba(226, 208, 255, 0.35)' })
    ];

    const sceneCache = {};
    function citySceneUrl(index) {
        const t = CITY_THEMES[index] || CITY_THEMES[0];
        if (!sceneCache[t.scene]) {
            const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="150" viewBox="0 0 240 150">${SCENES[t.scene]()}</svg>`;
            sceneCache[t.scene] = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
        }
        return sceneCache[t.scene];
    }

    // token -> value for one city. Only island tokens that describe the
    // world and its materials; action colors stay fixed (see file header).
    function cityTokens(t) {
        return {
            '--sky': t.sky,
            '--sky-low': t.skyLow,
            '--horizon': t.skyLow,
            '--world-floor': t.skyLow,
            '--world-floor-deep': t.skyLow,
            '--cloud': t.cloud,
            '--sun-glow': t.sun,
            '--jungle': t.jungle,
            '--jungle-deep': t.jungleDeep,
            '--felt': t.felt,
            '--felt-deep': t.feltDeep,
            '--sand': t.sand,
            '--sand-deep': t.sandDeep,
            '--wood-dark': t.frame,
            '--wood': t.rim,
            '--wood-light': t.rimLight,
            '--cream': t.cream,
            '--cream-2': t.cream2,
            '--cream-3': t.cream3,
            '--cream-hi': t.creamHi,
            '--ink': t.ink,
            '--ink-2': t.ink2,
            '--text-dark': t.ink,
            '--text-secondary': t.ink2,
            '--title-fill': t.title,
            '--world-ink': t.worldInk,
            '--world-halo': t.worldHalo || t.creamHi,
            '--bg-deep-2': t.frame,
            '--city-scene': citySceneUrl(CITY_THEMES.indexOf(t))
        };
    }

    let appliedIndex = null;
    function applyCityTheme(index) {
        const i = Math.max(0, Math.min(index | 0, CITY_THEMES.length - 1));
        if (i === appliedIndex) return;
        appliedIndex = i;
        const t = CITY_THEMES[i];
        const style = document.documentElement.style;
        Object.entries(cityTokens(t)).forEach(([k, v]) => style.setProperty(k, v));
        const meta = document.querySelector('meta[name="theme-color"]');
        if (meta) meta.setAttribute('content', t.sky);
    }

    // Best-effort early paint from the saved state, so the page doesn't flash
    // the first city while the load event (audio, images) is still pending.
    // game.js re-applies the authoritative choice via applyActiveTheme().
    try {
        const saved = JSON.parse(localStorage.getItem('zabangState') || 'null');
        if (saved) {
            const peak = Math.max(saved.highestTrophies || 0, saved.trophies || 0);
            const unlocked = Math.min(Math.floor(peak / 200), CITY_THEMES.length - 1);
            const idx = saved.themeAuto === false ? Math.min(saved.preferredTheme || 0, unlocked) : unlocked;
            applyCityTheme(idx);
        }
    } catch (err) { /* no saved state or storage blocked - the load handler applies it */ }

    window.CITY_THEMES = CITY_THEMES;
    window.citySceneUrl = citySceneUrl;
    window.applyCityTheme = applyCityTheme;
})();
