// ===== Avatar emblems (local SVG) =====
// Every avatar is a self-contained inline SVG - no network, works offline.
// Each one is a modern, minimalist emblem that MATCHES its name/id: a crown
// for the king, a ninja mask, a dog for חומי, and gaming symbols (sword,
// lightning, shield, flame...) for the rest. Each sits on a themed radial
// gradient inside the pulsing avatar ring.
//
// Gradient ids are namespaced per avatar id (e.g. "av-king", "king-ic"), so
// they're unique across different avatars; the same avatar rendered twice just
// reuses its own identical gradient, which is harmless.

function makeAvatar(id, bg, icon) {
    const g = 'av-' + id;
    return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <defs>
            <radialGradient id="${g}" cx="50%" cy="30%" r="85%">
                <stop offset="0%" stop-color="${bg[0]}"/>
                <stop offset="100%" stop-color="${bg[1]}"/>
            </radialGradient>
        </defs>
        <circle cx="50" cy="50" r="48" fill="url(#${g})"/>
        <circle cx="50" cy="50" r="42" fill="#ffffff" opacity="0.05"/>
        ${icon}
        <circle cx="50" cy="50" r="46.5" fill="none" stroke="#ffffff" stroke-opacity="0.18" stroke-width="1.5"/>
    </svg>`;
}

// ---- emblem icons (centered on 50,50, all local vectors) -------------------

const ICON = {
    // דן -> sword
    sword: `<g fill="#EAF2FF">
        <path d="M50 22 L55 31 L53 58 L47 58 L45 31 Z"/>
        <rect x="37" y="58" width="26" height="5" rx="2.5"/>
        <rect x="46.5" y="63" width="7" height="13" rx="2"/>
        <circle cx="50" cy="78" r="3.4"/></g>`,

    // מאיה -> sparkle / star
    sparkle: `<path d="M50 22 C52.5 40 60 47.5 78 50 C60 52.5 52.5 60 50 78 C47.5 60 40 52.5 22 50 C40 47.5 47.5 40 50 22 Z" fill="#FFF6D6"/>`,

    // תום -> lightning bolt
    bolt: `<path d="M54 20 L32 54 L46 54 L44 80 L68 44 L52 44 Z" fill="#FFE95C"/>`,

    // נועה -> shield with check
    shield: `<g><path d="M50 22 L72 30 V50 C72 65 62 74 50 80 C38 74 28 65 28 50 V30 Z" fill="#EAFBF1"/>
        <path d="M41 51 L48 58 L61 42" fill="none" stroke="#159A63" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></g>`,

    // ארי (=lion) -> stylized lion head
    lion: `<g>
        <path d="M50 24 L57 31 L66 29 L65 39 L74 44 L67 51 L71 61 L61 60 L56 69 L50 64 L44 69 L39 60 L29 61 L33 51 L26 44 L35 39 L34 29 L43 31 Z" fill="#F4C15A"/>
        <circle cx="50" cy="48" r="15" fill="#FBD98A"/>
        <circle cx="44" cy="46" r="2.4" fill="#3A2410"/><circle cx="56" cy="46" r="2.4" fill="#3A2410"/>
        <path d="M47 52 L50 56 L53 52 Z" fill="#7A3B12"/>
        <path d="M50 56 Q46 60 42 57 M50 56 Q54 60 58 57" stroke="#7A3B12" stroke-width="2" fill="none" stroke-linecap="round"/></g>`,

    // שירה (=song) -> music note
    note: `<g fill="#F2E9FF">
        <rect x="41" y="30" width="3.4" height="31" rx="1.7"/>
        <rect x="59" y="26" width="3.4" height="31" rx="1.7"/>
        <path d="M41 30 L62.4 25 L62.4 31 L41 36 Z"/>
        <ellipse cx="38" cy="62" rx="7.5" ry="5.5"/>
        <ellipse cx="56" cy="58" rx="7.5" ry="5.5"/></g>`,

    // קול -> sleek sunglasses
    shades: `<g>
        <path d="M24 41 H76" stroke="#EDEFF2" stroke-width="3.4" stroke-linecap="round"/>
        <path d="M28 43 H46 L44 55 C42.5 60 30 60 29 53 Z" fill="#15181F" stroke="#EDEFF2" stroke-width="2.4" stroke-linejoin="round"/>
        <path d="M54 43 H72 L71 53 C70 60 58 60 56 55 Z" fill="#15181F" stroke="#EDEFF2" stroke-width="2.4" stroke-linejoin="round"/>
        <path d="M46 46 H54" stroke="#EDEFF2" stroke-width="2.4"/></g>`,

    // סבא -> wise glasses + mustache
    elder: `<g>
        <g fill="none" stroke="#EDEFF2" stroke-width="3.2">
            <circle cx="39" cy="43" r="9"/><circle cx="61" cy="43" r="9"/>
            <path d="M48 43 H52"/><path d="M30 40 L23 38 M70 40 L77 38"/></g>
        <path d="M35 57 Q43 63 50 59 Q57 63 65 57 Q60 68 50 64 Q40 68 35 57 Z" fill="#EDEFF2"/></g>`,

    // נינג'ה -> ninja mask with sharp eyes
    ninja: `<g>
        <path d="M26 47 Q50 36 74 47 L74 51 Q50 45 26 51 Z" fill="#1C1E26"/>
        <rect x="26" y="50" width="48" height="12" rx="2" fill="#1C1E26"/>
        <path d="M74 50 L87 45 L82 58 L74 55 Z" fill="#1C1E26"/>
        <path d="M33 57 L47 53 L45 60 Z" fill="#FF4D5E"/>
        <path d="M67 57 L53 53 L55 60 Z" fill="#FF4D5E"/></g>`,

    // רובוט -> robot head
    robot: `<g>
        <line x1="50" y1="24" x2="50" y2="33" stroke="#DCE6EF" stroke-width="3"/>
        <circle cx="50" cy="22" r="3.2" fill="#DCE6EF"/>
        <rect x="32" y="33" width="36" height="30" rx="8" fill="#E8EEF5"/>
        <rect x="37" y="42" width="26" height="12" rx="6" fill="#12303F"/>
        <circle cx="44" cy="48" r="3.2" fill="#41E0FF"/><circle cx="56" cy="48" r="3.2" fill="#41E0FF"/>
        <rect x="43" y="58" width="14" height="3" rx="1.5" fill="#9FB3C4"/></g>`,

    // חתול -> cat face
    cat: `<g>
        <g fill="#FFF0DA"><path d="M33 35 L35 20 L48 33 Z"/><path d="M67 35 L65 20 L52 33 Z"/>
        <circle cx="50" cy="50" r="20"/></g>
        <circle cx="43" cy="48" r="2.6" fill="#2A2A2A"/><circle cx="57" cy="48" r="2.6" fill="#2A2A2A"/>
        <path d="M47 54 L50 57 L53 54 Z" fill="#E4761B"/>
        <path d="M50 57 Q46 61 42 59 M50 57 Q54 61 58 59" stroke="#2A2A2A" stroke-width="1.8" fill="none" stroke-linecap="round"/>
        <path d="M31 50 H41 M31 55 H41 M69 50 H59 M69 55 H59" stroke="#E4761B" stroke-width="1.4"/></g>`,

    // חומי -> sleek dog
    dog: `<g>
        <g fill="#F3E4D3">
            <path d="M32 34 Q26 53 35 65 L39 49 Z"/>
            <path d="M68 34 Q74 53 65 65 L61 49 Z"/>
            <path d="M34 44 Q50 33 66 44 L64 61 Q50 73 36 61 Z"/></g>
        <circle cx="43" cy="50" r="2.6" fill="#3A2416"/><circle cx="57" cy="50" r="2.6" fill="#3A2416"/>
        <ellipse cx="50" cy="60" rx="5" ry="3.6" fill="#3A2416"/>
        <path d="M50 63 Q46 67 43 64 M50 63 Q54 67 57 64" stroke="#3A2416" stroke-width="1.8" fill="none" stroke-linecap="round"/></g>`,

    // זאב -> sleek wolf
    wolf: `<g>
        <g fill="#D9DEE5">
            <path d="M30 32 Q22 50 33 66 L38 47 Z"/>
            <path d="M70 32 Q78 50 67 66 L62 47 Z"/>
            <path d="M32 43 Q50 30 68 43 L65 62 Q50 75 35 62 Z"/></g>
        <path d="M38 43 L44 48 M62 43 L56 48" stroke="#AEB6C2" stroke-width="1.4"/>
        <circle cx="42" cy="49" r="2.6" fill="#1B1D22"/><circle cx="58" cy="49" r="2.6" fill="#1B1D22"/>
        <path d="M50 55 L46 60 L54 60 Z" fill="#1B1D22"/>
        <path d="M50 60 Q46 65 42 62 M50 60 Q54 65 58 62" stroke="#1B1D22" stroke-width="1.8" fill="none" stroke-linecap="round"/></g>`,

    // חייזר -> alien head
    alien: `<g>
        <path d="M50 24 C67 24 71 40 66 54 C62 66 55 74 50 76 C45 74 38 66 34 54 C29 40 33 24 50 24 Z" fill="#CFF29A"/>
        <path d="M41 46 Q45 58 34 56 Q29 46 41 46 Z" fill="#1B1B1B"/>
        <path d="M59 46 Q55 58 66 56 Q71 46 59 46 Z" fill="#1B1B1B"/></g>`,

    // ---- premium ----
    // מלך -> golden crown
    crown: `<defs><linearGradient id="king-ic" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#FFE985"/><stop offset="1" stop-color="#E0A017"/></linearGradient></defs>
        <g fill="url(#king-ic)">
            <path d="M26 40 L36 52 L50 31 L64 52 L74 40 L70 66 H30 Z"/>
            <rect x="30" y="67" width="40" height="7" rx="2"/></g>
        <circle cx="50" cy="33" r="3" fill="#FF5C7A"/>
        <circle cx="27" cy="40" r="2.4" fill="#5AC8FF"/><circle cx="73" cy="40" r="2.4" fill="#5AC8FF"/>`,

    // סייבר -> cyber visor
    cyber: `<g>
        <path d="M30 38 Q50 30 70 38 L67 55 Q50 63 33 55 Z" fill="#0E2A38" stroke="#28E0FF" stroke-width="2"/>
        <path d="M37 47 H63" stroke="#28E0FF" stroke-width="3.4" stroke-linecap="round"/>
        <circle cx="37" cy="47" r="2.6" fill="#B6F7FF"/><circle cx="63" cy="47" r="2.6" fill="#B6F7FF"/>
        <path d="M50 30 V22" stroke="#28E0FF" stroke-width="2"/><circle cx="50" cy="20" r="2.6" fill="#28E0FF"/></g>`,

    // להבה -> flame
    flame: `<defs><linearGradient id="flame-ic" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#FFD24D"/><stop offset="1" stop-color="#FF5A1F"/></linearGradient></defs>
        <path d="M50 20 Q64 34 58 48 Q70 44 66 60 Q62 76 50 80 Q38 76 34 60 Q30 46 42 48 Q36 34 50 20 Z" fill="url(#flame-ic)"/>
        <path d="M50 40 Q56 48 53 56 Q51 64 50 66 Q45 60 47 52 Q49 46 50 40 Z" fill="#FFF1B8"/>`,

    // גיבור -> hero shield with star
    hero: `<g><path d="M50 22 L72 30 V50 C72 65 62 74 50 80 C38 74 28 65 28 50 V30 Z" fill="#F5F7FA"/>
        <path d="M50 37 L54 47 L65 47 L56 54 L59 65 L50 58 L41 65 L44 54 L35 47 L46 47 Z" fill="#C0392B"/></g>`,

    // גלקסי -> ringed planet
    galaxy: `<g>
        <circle cx="52" cy="30" r="1.6" fill="#fff"/><circle cx="30" cy="40" r="1.3" fill="#fff"/>
        <circle cx="70" cy="62" r="1.4" fill="#fff"/><circle cx="34" cy="66" r="1.2" fill="#fff"/>
        <circle cx="50" cy="50" r="15" fill="#B39DFF"/>
        <ellipse cx="50" cy="50" rx="27" ry="8.5" fill="none" stroke="#E5DBFF" stroke-width="3" transform="rotate(-22 50 50)"/>
        <circle cx="44" cy="46" r="3.5" fill="#EFE9FF" opacity="0.6"/></g>`
};

const AVATARS = [
    { id: 'dan',     name: 'דן',     bg: ['#5B8DEF', '#2C4F94'], icon: ICON.sword },
    { id: 'maya',    name: 'מאיה',   bg: ['#E86FB0', '#8E44AD'], icon: ICON.sparkle },
    { id: 'tom',     name: 'תום',    bg: ['#26C6C9', '#1A7A8C'], icon: ICON.bolt },
    { id: 'noa',     name: 'נועה',   bg: ['#3DD68C', '#159A63'], icon: ICON.shield },
    { id: 'ari',     name: 'ארי',    bg: ['#F6A93B', '#C9631A'], icon: ICON.lion },
    { id: 'shira',   name: 'שירה',   bg: ['#A06BE8', '#6A3FC0'], icon: ICON.note },
    { id: 'cool',    name: 'קול',    bg: ['#4A5568', '#232A36'], icon: ICON.shades },
    { id: 'grandpa', name: 'סבא',    bg: ['#8FA1B3', '#5A6B7D'], icon: ICON.elder },
    { id: 'ninja',   name: 'נינג׳ה', bg: ['#2B2F3A', '#12141B'], icon: ICON.ninja },
    { id: 'robot',   name: 'רובוט',  bg: ['#38C6E8', '#1E7FA8'], icon: ICON.robot },
    { id: 'cat',     name: 'חתול',   bg: ['#FBB040', '#E4761B'], icon: ICON.cat },
    { id: 'dog',     name: 'חומי',   bg: ['#B97A56', '#6D4C34'], icon: ICON.dog },
    { id: 'alien',   name: 'חייזר',  bg: ['#7C4DFF', '#4527A0'], icon: ICON.alien },
    { id: 'wolf',    name: 'זאב',    bg: ['#7C8B9E', '#3E4A5C'], icon: ICON.wolf },

    // ===== Premium ("cooler") avatars - bought in the shop (premium: true) =====
    { id: 'king',   name: 'מלך',   premium: true, bg: ['#3B4CC0', '#1A237E'], icon: ICON.crown },
    { id: 'cyber',  name: 'סייבר', premium: true, bg: ['#0FA3B1', '#0B2A3A'], icon: ICON.cyber },
    { id: 'flame',  name: 'להבה',  premium: true, bg: ['#7A1B00', '#3E0A00'], icon: ICON.flame },
    { id: 'hero',   name: 'גיבור', premium: true, bg: ['#C0392B', '#1A237E'], icon: ICON.hero },
    { id: 'galaxy', name: 'גלקסי', premium: true, bg: ['#3A2A80', '#140A3A'], icon: ICON.galaxy }
].map(a => ({ ...a, svg: makeAvatar(a.id, a.bg, a.icon) }));

function getAvatarById(id) {
    return AVATARS.find(a => a.id === id) || AVATARS[0];
}
