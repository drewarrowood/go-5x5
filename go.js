const N = 5;
const EMPTY = 0;
const BLACK = 1;
const WHITE = 2;
const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");

let board, toPlay, caps, lastMove, koPoint, passed, over, hover, aiWhite;

function emptyBoard() {
  return Array.from({ length: N }, () => Array(N).fill(EMPTY));
}

function reset() {
  board = emptyBoard();
  toPlay = BLACK;
  caps = { [BLACK]: 0, [WHITE]: 0 };
  lastMove = null;
  koPoint = null;
  passed = false;
  over = false;
  hover = null;
  aiWhite = document.getElementById("ai-white").checked;
  document.getElementById("score").classList.add("hidden");
  draw();
  status();
}

function opp(c) { return c === BLACK ? WHITE : BLACK; }

function inb(x, y) { return x >= 0 && y >= 0 && x < N && y < N; }

function neighbors(x, y) {
  return [[1,0],[-1,0],[0,1],[0,-1]]
    .map(([dx, dy]) => [x + dx, y + dy])
    .filter(([a, b]) => inb(a, b));
}

function groupAt(x, y, b = board) {
  const c = b[y][x];
  if (!c) return { stones: [], libs: [] };
  const seen = new Set();
  const stones = [];
  const libs = new Set();
  const stack = [[x, y]];
  seen.add(x + "," + y);
  while (stack.length) {
    const [cx, cy] = stack.pop();
    stones.push([cx, cy]);
    for (const [nx, ny] of neighbors(cx, cy)) {
      const k = nx + "," + ny;
      if (seen.has(k)) continue;
      const v = b[ny][nx];
      if (v === EMPTY) libs.add(k);
      else if (v === c) {
        seen.add(k);
        stack.push([nx, ny]);
      }
    }
  }
  return { stones, libs: [...libs] };
}

function cloneBoard(b = board) {
  return b.map((row) => row.slice());
}

function playOn(b, x, y, color) {
  if (b[y][x] !== EMPTY) return null;
  const next = cloneBoard(b);
  next[y][x] = color;
  let taken = [];
  for (const [nx, ny] of neighbors(x, y)) {
    if (next[ny][nx] === opp(color)) {
      const g = groupAt(nx, ny, next);
      if (g.libs.length === 0) {
        for (const [sx, sy] of g.stones) {
          next[sy][sx] = EMPTY;
          taken.push([sx, sy]);
        }
      }
    }
  }
  const self = groupAt(x, y, next);
  if (self.libs.length === 0) return null;
  return { board: next, taken };
}

function isKo(x, y, taken) {
  return (
    koPoint &&
    koPoint[0] === x &&
    koPoint[1] === y &&
    taken.length === 1
  );
}

function legalMoves(color, b = board) {
  const moves = [];
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const r = playOn(b, x, y, color);
      if (!r) continue;
      if (isKo(x, y, r.taken)) continue;
      moves.push({ x, y, ...r });
    }
  }
  return moves;
}

function applyMove(x, y) {
  if (over) return false;
  const r = playOn(board, x, y, toPlay);
  if (!r) return false;
  if (isKo(x, y, r.taken)) return false;
  board = r.board;
  caps[toPlay] += r.taken.length;
  lastMove = [x, y];
  koPoint = r.taken.length === 1 ? r.taken[0] : null;
  passed = false;
  toPlay = opp(toPlay);
  draw();
  status();
  maybeAi();
  return true;
}

function doPass() {
  if (over) return;
  if (passed) {
    endGame();
    return;
  }
  passed = true;
  lastMove = "pass";
  koPoint = null;
  toPlay = opp(toPlay);
  draw();
  status();
  maybeAi();
}

function territory() {
  const seen = new Set();
  const terr = { [BLACK]: 0, [WHITE]: 0, [EMPTY]: 0 };
  const stones = { [BLACK]: 0, [WHITE]: 0 };
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      if (board[y][x]) {
        stones[board[y][x]]++;
        continue;
      }
      const k0 = x + "," + y;
      if (seen.has(k0)) continue;
      const q = [[x, y]];
      const pts = [];
      const colors = new Set();
      seen.add(k0);
      while (q.length) {
        const [cx, cy] = q.pop();
        pts.push([cx, cy]);
        for (const [nx, ny] of neighbors(cx, cy)) {
          const v = board[ny][nx];
          if (v === EMPTY) {
            const k = nx + "," + ny;
            if (!seen.has(k)) {
              seen.add(k);
              q.push([nx, ny]);
            }
          } else colors.add(v);
        }
      }
      if (colors.size === 1) terr[[...colors][0]] += pts.length;
      else terr[EMPTY] += pts.length;
    }
  }
  return {
    black: stones[BLACK] + terr[BLACK],
    white: stones[WHITE] + terr[WHITE],
    stones,
    terr,
  };
}

function endGame() {
  over = true;
  const t = territory();
  const el = document.getElementById("score");
  el.classList.remove("hidden");
  const winner =
    t.black === t.white ? "Even." : t.black > t.white ? "Black wins." : "White wins.";
  el.textContent = `Black ${t.black}  ·  White ${t.white}. ${winner}`;
  document.getElementById("turn").textContent = "Game over";
}

function scoreMove(move, color) {
  let s = move.taken.length * 8;
  const g = groupAt(move.x, move.y, move.board);
  s += g.libs.length;
  if (move.x === 2 && move.y === 2) s += 1.5;
  const corners = [[0,0],[0,4],[4,0],[4,4]];
  if (corners.some(([a, b]) => a === move.x && b === move.y)) s -= 0.8;
  s += Math.random() * 0.4;
  return s;
}

function maybeAi() {
  if (over || !aiWhite || toPlay !== WHITE) return;
  setTimeout(() => {
    if (over || toPlay !== WHITE) return;
    const moves = legalMoves(WHITE);
    if (!moves.length) {
      doPass();
      return;
    }
    moves.sort((a, b) => scoreMove(b, WHITE) - scoreMove(a, WHITE));
    const pick = moves[0];
    applyMove(pick.x, pick.y);
  }, 280);
}

function pad() {
  const w = canvas.width;
  return { m: w * 0.12, step: (w * 0.76) / (N - 1) };
}

function xyToPix(x, y) {
  const { m, step } = pad();
  return [m + x * step, m + y * step];
}

function pixToXy(px, py) {
  const rect = canvas.getBoundingClientRect();
  const sx = canvas.width / rect.width;
  const sy = canvas.height / rect.height;
  const x = (px - rect.left) * sx;
  const y = (py - rect.top) * sy;
  const { m, step } = pad();
  const gx = Math.round((x - m) / step);
  const gy = Math.round((y - m) / step);
  if (!inb(gx, gy)) return null;
  const [ax, ay] = xyToPix(gx, gy);
  if (Math.hypot(ax - x, ay - y) > step * 0.42) return null;
  return [gx, gy];
}

function drawStone(x, y, color, alpha = 1) {
  const [px, py] = xyToPix(x, y);
  const r = pad().step * 0.42;
  ctx.save();
  ctx.globalAlpha = alpha;
  const g = ctx.createRadialGradient(px - r * 0.3, py - r * 0.3, r * 0.1, px, py, r);
  if (color === BLACK) {
    g.addColorStop(0, "#5a5a5a");
    g.addColorStop(1, "#111");
  } else {
    g.addColorStop(0, "#fff");
    g.addColorStop(1, "#c8c4bc");
  }
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(px, py, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function draw() {
  const w = canvas.width;
  ctx.fillStyle = "#d4a574";
  ctx.fillRect(0, 0, w, w);
  ctx.strokeStyle = "#3b2a18";
  ctx.lineWidth = 2;
  const { m, step } = pad();
  for (let i = 0; i < N; i++) {
    ctx.beginPath();
    ctx.moveTo(m, m + i * step);
    ctx.lineTo(m + (N - 1) * step, m + i * step);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(m + i * step, m);
    ctx.lineTo(m + i * step, m + (N - 1) * step);
    ctx.stroke();
  }
  ctx.fillStyle = "#3b2a18";
  ctx.beginPath();
  const [cx, cy] = xyToPix(2, 2);
  ctx.arc(cx, cy, 4, 0, Math.PI * 2);
  ctx.fill();
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      if (board[y][x]) drawStone(x, y, board[y][x]);
    }
  }
  if (lastMove && lastMove !== "pass") {
    const [lx, ly] = lastMove;
    const [px, py] = xyToPix(lx, ly);
    ctx.strokeStyle = board[ly][lx] === BLACK ? "#eee" : "#222";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px, py, pad().step * 0.16, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (!over && hover && board[hover[1]][hover[0]] === EMPTY) {
    const r = playOn(board, hover[0], hover[1], toPlay);
    const ok = r && !isKo(hover[0], hover[1], r.taken);
    if (ok) drawStone(hover[0], hover[1], toPlay, 0.35);
  }
}

function status() {
  const name = toPlay === BLACK ? "Black" : "White";
  document.getElementById("turn").textContent = over ? "Game over" : name + " to play";
  document.getElementById("cap-b").textContent = String(caps[BLACK]);
  document.getElementById("cap-w").textContent = String(caps[WHITE]);
}

canvas.addEventListener("pointermove", (e) => {
  hover = pixToXy(e.clientX, e.clientY);
  draw();
});
canvas.addEventListener("pointerleave", () => {
  hover = null;
  draw();
});
canvas.addEventListener("click", (e) => {
  if (over) return;
  if (aiWhite && toPlay === WHITE) return;
  const pt = pixToXy(e.clientX, e.clientY);
  if (!pt) return;
  applyMove(pt[0], pt[1]);
});

document.getElementById("btn-pass").addEventListener("click", () => {
  if (aiWhite && toPlay === WHITE) return;
  doPass();
});
document.getElementById("btn-new").addEventListener("click", reset);
document.getElementById("ai-white").addEventListener("change", (e) => {
  aiWhite = e.target.checked;
  maybeAi();
});

reset();
