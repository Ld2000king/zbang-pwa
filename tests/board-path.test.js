// Tests for board-path.js. Run with:  node --test tests/
const test = require('node:test');
const assert = require('node:assert/strict');
const {
    boardTilesAdjacent, canExtendBoardPath, isValidBoardPath, pointerSamples
} = require('../board-path.js');

const N = 5; // the square boards are 5x5
const at = (r, c) => r * N + c;

test('horizontal, vertical and diagonal neighbours touch', () => {
    assert.ok(boardTilesAdjacent(at(2, 2), at(2, 3), N));
    assert.ok(boardTilesAdjacent(at(2, 2), at(1, 2), N));
    assert.ok(boardTilesAdjacent(at(2, 2), at(1, 1), N));
    assert.ok(boardTilesAdjacent(at(2, 2), at(3, 3), N));
    assert.ok(boardTilesAdjacent(at(2, 2), at(1, 3), N));
    assert.ok(boardTilesAdjacent(at(2, 2), at(3, 1), N));
});

test('far tiles and the same tile do not touch', () => {
    assert.ok(!boardTilesAdjacent(at(2, 2), at(2, 4), N)); // skips one
    assert.ok(!boardTilesAdjacent(at(0, 0), at(2, 2), N)); // skips diagonally
    assert.ok(!boardTilesAdjacent(at(0, 0), at(4, 4), N)); // far corner
    assert.ok(!boardTilesAdjacent(at(2, 2), at(2, 2), N));
});

test('no wrap-around between rows or columns', () => {
    // index difference is 1, but these are the two ends of different rows
    assert.ok(!boardTilesAdjacent(at(0, 4), at(1, 0), N));
    assert.ok(!boardTilesAdjacent(at(1, 0), at(0, 4), N));
    // index difference is 4 / 6, the size +-1 that a naive check would allow
    assert.ok(!boardTilesAdjacent(at(0, 0), at(0, 4), N));
    assert.ok(!boardTilesAdjacent(at(1, 4), at(3, 0), N));
    assert.ok(!boardTilesAdjacent(at(0, 4), at(2, 0), N));
    // left edge to right edge of the row below
    assert.ok(!boardTilesAdjacent(at(2, 0), at(3, 4), N));
    // top row to bottom row
    assert.ok(!boardTilesAdjacent(at(0, 2), at(4, 2), N));
});

test('off-board and non-integer tiles are rejected', () => {
    assert.ok(!boardTilesAdjacent(-1, 0, N));
    assert.ok(!boardTilesAdjacent(24, 25, N));
    assert.ok(!boardTilesAdjacent(1.5, 2, N));
    assert.ok(!boardTilesAdjacent(NaN, 0, N));
    assert.ok(!canExtendBoardPath([], 25, N));
    assert.ok(!canExtendBoardPath([], -1, N));
    assert.ok(!isValidBoardPath([0, '1'], N));
});

test('valid paths: straight lines, diagonals and zigzags', () => {
    assert.ok(isValidBoardPath([at(0, 0), at(0, 1), at(0, 2)], N));           // horizontal
    assert.ok(isValidBoardPath([at(0, 3), at(1, 3), at(2, 3), at(3, 3)], N)); // vertical
    assert.ok(isValidBoardPath([at(0, 0), at(1, 1), at(2, 2), at(3, 3), at(4, 4)], N)); // diagonal
    assert.ok(isValidBoardPath([at(4, 0), at(3, 1), at(2, 2)], N));           // anti-diagonal
    assert.ok(isValidBoardPath([at(0, 0), at(1, 1), at(0, 2), at(1, 3), at(0, 4)], N)); // zigzag
    assert.ok(isValidBoardPath([at(2, 2), at(2, 3), at(3, 3), at(3, 2), at(3, 1)], N)); // turns back
    assert.ok(isValidBoardPath([at(1, 1)], N)); // a single tile
});

test('invalid paths: skips, far jumps, repeats, wrap-around', () => {
    assert.ok(!isValidBoardPath([at(0, 0), at(0, 2), at(0, 3)], N));          // skips a tile
    assert.ok(!isValidBoardPath([at(0, 0), at(0, 1), at(4, 4)], N));          // far jump
    assert.ok(!isValidBoardPath([at(1, 1), at(1, 2), at(1, 1)], N));          // reuses a tile
    assert.ok(!isValidBoardPath([at(1, 1), at(1, 2), at(2, 2), at(1, 1)], N)); // reuses via a loop
    assert.ok(!isValidBoardPath([at(0, 3), at(0, 4), at(1, 0)], N));          // wraps to next row
    assert.ok(!isValidBoardPath([], N));
    assert.ok(!isValidBoardPath(null, N));
});

test('canExtendBoardPath: first tile, neighbours, used and far tiles', () => {
    assert.ok(canExtendBoardPath([], at(3, 3), N));
    assert.ok(canExtendBoardPath([at(0, 0)], at(1, 1), N));
    assert.ok(!canExtendBoardPath([at(0, 0)], at(0, 2), N));
    assert.ok(!canExtendBoardPath([at(0, 0), at(0, 1)], at(0, 0), N)); // used, even though adjacent
    assert.ok(!canExtendBoardPath([at(0, 4)], at(1, 0), N));
});

test('pointerSamples covers the segment in small steps and ends at the target', () => {
    const pts = pointerSamples(0, 0, 100, 0, 10);
    assert.equal(pts.length, 10);
    assert.deepEqual(pts[pts.length - 1], { x: 100, y: 0 });
    for (let i = 1; i < pts.length; i++) assert.ok(pts[i].x - pts[i - 1].x <= 10 + 1e-9);
    assert.deepEqual(pointerSamples(5, 5, 5, 5, 10), [{ x: 5, y: 5 }]); // no movement
});

// ---- drag simulation -------------------------------------------------------
// Mirrors the browser side: tiles laid out in a grid with gaps, a point only
// registers inside the centre zone of a tile (detectTileAt's 0.42 radius), and
// each pointer event is expanded with pointerSamples at a quarter-tile step.
const TILE = 56, GAP = 6, RADIUS = TILE * 0.42;
const centre = (idx) => ({
    x: (idx % N) * (TILE + GAP) + TILE / 2,
    y: Math.floor(idx / N) * (TILE + GAP) + TILE / 2
});

function tileAt(x, y) {
    for (let idx = 0; idx < N * N; idx++) {
        const c = centre(idx);
        if (Math.abs(x - c.x) <= RADIUS && Math.abs(y - c.y) <= RADIUS) return idx;
    }
    return null;
}

function simulateDrag(points, { interpolate = true } = {}) {
    const path = [];
    const visit = (x, y) => {
        const idx = tileAt(x, y);
        if (idx !== null && canExtendBoardPath(path, idx, N)) path.push(idx);
    };
    visit(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) {
        const samples = interpolate
            ? pointerSamples(points[i - 1].x, points[i - 1].y, points[i].x, points[i].y, TILE * 0.25)
            : [points[i]];
        samples.forEach(p => visit(p.x, p.y));
    }
    return path;
}

test('slow straight drag picks every tile on the row', () => {
    const pts = [];
    for (let x = centre(at(1, 0)).x; x <= centre(at(1, 4)).x; x += 5) pts.push({ x, y: centre(at(1, 0)).y });
    assert.deepEqual(simulateDrag(pts), [at(1, 0), at(1, 1), at(1, 2), at(1, 3), at(1, 4)]);
});

test('fast swipe that jumps over tiles still collects them in order', () => {
    // only two pointer events: start of the row and its end
    const pts = [centre(at(2, 0)), centre(at(2, 4))];
    assert.deepEqual(simulateDrag(pts), [at(2, 0), at(2, 1), at(2, 2), at(2, 3), at(2, 4)]);
    // without the in-between points the far tile would simply be refused
    assert.deepEqual(simulateDrag(pts, { interpolate: false }), [at(2, 0)]);
});

test('fast diagonal swipe does not pick up the side tiles', () => {
    const pts = [centre(at(0, 0)), centre(at(3, 3))];
    assert.deepEqual(simulateDrag(pts), [at(0, 0), at(1, 1), at(2, 2), at(3, 3)]);
});

test('zigzag drag through tile centres', () => {
    const route = [at(0, 0), at(1, 1), at(0, 2), at(1, 3), at(0, 4)];
    assert.deepEqual(simulateDrag(route.map(centre)), route);
});

test('passing over a used tile or sliding back does not change the path (no undo)', () => {
    const route = [at(2, 1), at(2, 2), at(2, 3), at(2, 2), at(2, 1)];
    assert.deepEqual(simulateDrag(route.map(centre)), [at(2, 1), at(2, 2), at(2, 3)]);
});

test('every path a drag produces is valid', () => {
    let seed = 7;
    const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
    const span = N * (TILE + GAP);
    for (let run = 0; run < 2000; run++) {
        const pts = [];
        const len = 2 + Math.floor(rand() * 8);
        for (let i = 0; i < len; i++) pts.push({ x: rand() * span, y: rand() * span });
        const path = simulateDrag(pts);
        if (path.length) assert.ok(isValidBoardPath(path, N), JSON.stringify(path));
    }
});
