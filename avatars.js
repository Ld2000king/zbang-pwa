// Approved 3D character portraits, bundled locally and pre-cached for offline use.
// Keep the svg markup interface: profile, shop, leaderboard and multiplayer
// already size SVGs consistently. Stable IDs preserve saved selections/purchases.
function makeAvatar(id, name) {
    return `<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${name}">
        <image href="assets/avatars/${id}.webp" width="100" height="100"/>
    </svg>`;
}

const AVATARS = [
    { id: 'dan',     name: 'דן',     bg: ['#5B8DEF', '#2C4F94'] },
    { id: 'maya',    name: 'מאיה',   bg: ['#E86FB0', '#8E44AD'] },
    { id: 'tom',     name: 'תום',    bg: ['#26C6C9', '#1A7A8C'] },
    { id: 'noa',     name: 'נועה',   bg: ['#3DD68C', '#159A63'] },
    { id: 'ari',     name: 'ארי',    bg: ['#F6A93B', '#C9631A'] },
    { id: 'shira',   name: 'שירה',   bg: ['#A06BE8', '#6A3FC0'] },
    { id: 'cool',    name: 'קול',    bg: ['#4A5568', '#232A36'] },
    { id: 'grandpa', name: 'סבא',    bg: ['#8FA1B3', '#5A6B7D'] },
    { id: 'ninja',   name: 'נינג׳ה', bg: ['#2B2F3A', '#12141B'] },
    { id: 'robot',   name: 'רובוט',  bg: ['#38C6E8', '#1E7FA8'] },
    { id: 'cat',     name: 'חתול',   bg: ['#FBB040', '#E4761B'] },
    { id: 'dog',     name: 'חומי',   bg: ['#B97A56', '#6D4C34'] },
    { id: 'alien',   name: 'חייזר',  bg: ['#7C4DFF', '#4527A0'] },
    { id: 'wolf',    name: 'זאב',    bg: ['#7C8B9E', '#3E4A5C'] },
    { id: 'ariel',   name: 'אריאל',  bg: ['#3ED6C4', '#0E7A6E'] },

    // ===== Premium ("cooler") avatars - bought in the shop (premium: true) =====
    { id: 'king',   name: 'מלך',   premium: true, bg: ['#3B4CC0', '#1A237E'] },
    { id: 'cyber',  name: 'סייבר', premium: true, bg: ['#0FA3B1', '#0B2A3A'] },
    { id: 'flame',  name: 'להבה',  premium: true, bg: ['#7A1B00', '#3E0A00'] },
    { id: 'hero',   name: 'גיבור', premium: true, bg: ['#C0392B', '#1A237E'] },
    { id: 'galaxy', name: 'גלקסי', premium: true, bg: ['#3A2A80', '#140A3A'] }
].map(a => ({ ...a, image: `assets/avatars/${a.id}.webp`, svg: makeAvatar(a.id, a.name) }));

function getAvatarById(id) {
    return AVATARS.find(a => a.id === id) || AVATARS[0];
}
