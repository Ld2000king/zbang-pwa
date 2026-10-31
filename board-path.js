// ============================================================================
// board-path.js - the letter-path rules for the square boards (single player,
// bots battle, multiplayer). מגדל זבאנג has its own rules in tower.js and does
// not use this file.
//
// A word is a path of tile indices on a size x size board (index = row * size
// + col). A path is legal when every tile is on the board, no tile repeats,
// and each tile touches the one before it in one of the 8 directions.
// Adjacency is worked out from row and column, never from the index
// difference alone, so the last tile of a row does not "touch" the first tile
// of the next row (no wrap-around).
//
// Plain functions with no DOM access, so the tests can load this file in Node.
// ============================================================================

function boardTileValid(idx, size) {
    return Number.isInteger(idx) && Number.isInteger(size) && size > 0
        && idx >= 0 && idx < size * size;
}

// true when a and b are two different tiles that touch (8 directions)
function boardTilesAdjacent(a, b, size) {
    if (!boardTileValid(a, size) || !boardTileValid(b, size) || a === b) return false;
    const dr = Math.abs(Math.floor(a / size) - Math.floor(b / size));
    const dc = Math.abs((a % size) - (b % size));
    return dr <= 1 && dc <= 1;
}

// May `idx` be added to the end of `path`?
function canExtendBoardPath(path, idx, size) {
    if (!boardTileValid(idx, size) || path.includes(idx)) return false;
    return path.length === 0 || boardTilesAdjacent(path[path.length - 1], idx, size);
}

// Full check of a finished path - run again before a word is scored.
function isValidBoardPath(path, size) {
    if (!Array.isArray(path) || path.length === 0) return false;
    const seen = new Set();
    for (let i = 0; i < path.length; i++) {
        const idx = path[i];
        if (!boardTileValid(idx, size) || seen.has(idx)) return false;
        if (i > 0 && !boardTilesAdjacent(path[i - 1], idx, size)) return false;
        seen.add(idx);
    }
    return true;
}

// Points along the straight segment from (x0, y0) to (x1, y1), at most `step`
// pixels apart, excluding the start and including the end. A fast swipe can
// jump across a whole tile between two pointer events; checking these points
// picks up every tile the finger actually crossed, in order.
function pointerSamples(x0, y0, x1, y1, step) {
    const dist = Math.hypot(x1 - x0, y1 - y0);
    const n = step > 0 ? Math.max(1, Math.ceil(dist / step)) : 1;
    const out = [];
    for (let i = 1; i <= n; i++) {
        out.push({ x: x0 + (x1 - x0) * i / n, y: y0 + (y1 - y0) * i / n });
    }
    return out;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { boardTileValid, boardTilesAdjacent, canExtendBoardPath, isValidBoardPath, pointerSamples };
}
