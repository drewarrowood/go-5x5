const N = 5;
const EMPTY = 0;
const BLACK = 1;
const WHITE = 2;
const FILES = "ABCDE";
const SPEED_MS = [2200, 1600, 1100, 700, 400];
const SPEED_NAMES = ["very slow", "slow", "medium", "faster", "fast"];

const canvas = document.getElementById("board");
const ctx = canvas.getContext("2d");
const logEl = document.getElementById("log");
const blackSel = document.getElementById("black-player");
const whiteSel = document.getElementById("white-player");
const machineBox = document.getElementById("machine-box");
const selfPlayBtns = document.getElementById("self-play-btns");
const btnStart = document.getElementById("btn-start");
const btnPause = document.getElementById("btn-pause");
const btnPass = document.getElementById("btn-pass");
const speedEl = document.getElementById("speed");
const speedLabel = document.getElementById("speed-label");

let board, toPlay, caps, lastMove, koPoint, passed, over, hover;
let ply, selfPlayRunning, aiTimer;

function emptyBoard() {
  return Array.from({ length: N }, () => Array(N).fill(EMPTY));
}

function reset() {
  clearAi();
  board = emptyBoard();
  toPlay = BLACK;
  caps = { [BLACK]: 0, [WHITE]: 0 };
  lastMove = null;
  koPoint = null;
  passed = false;
  over = false;
  hover = null;
  ply = 0;
  selfPlayRunning = false;
  logEl.replaceChildren();
  document.getElementById("score").classList.add("hidden");
  syncUi();
  draw();
  status();
  if (!bothMachine()) scheduleMachine();
}

function opp(c) {
  return c === BLACK ? WHITE : BLACK;
}

function inb(x, y) {
  return x >= 0 && y >= 0 && x < N && y < N;
}

function colorName(c) {
  return c === BLACK ? "Black" : "White";
}

function pointName(x, y) {
  return FILES[x] + String(N - y);
}

function playerOf(color) {
  return (color === BLACK ? blackSel : whiteSel).value;
}

function isMachine(color) {
  return playerOf(color) === "machine";
}

function bothMachine() {
  return isMachine(BLACK) && isMachine(WHITE);
}

function anyMachine() {
  return isMachine(BLACK) || isMachine(WHITE);
}

function canHumanAct() {
  return !over && !isMachine(toPlay);
}

function speedMs() {
  const i = Math.min(SPEED_MS.length - 1, Math.max(0, Number(speedEl.value) - 1));
  return SPEED_MS[i];
}

function neighbors(x, y) {
  return [[1, 0], [-1, 0], [0, 1], [0, -1]]
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

function groupsOf(color, b) {
  const seen = new Set();
  const groups = [];
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      if (b[y][x] !== color) continue;
      const k = x + "," + y;
      if (seen.has(k)) continue;
      const g = groupAt(x, y, b);
      for (const [sx, sy] of g.stones) seen.add(sx + "," + sy);
      groups.push(g);
    }
  }
  return groups;
}

function nameGroup(g) {
  const stones = g.stones.slice().sort((a, b) => {
    if (a[0] !== b[0]) return a[0] - b[0];
    return b[1] - a[1];
  });
  return pointName(stones[0][0], stones[0][1]);
}

function cloneBoard(b = board) {
  return b.map((row) => row.slice());
}

function playOn(b, x, y, color) {
  if (b[y][x] !== EMPTY) return null;
  const next = cloneBoard(b);
  next[y][x] = color;
  const taken = [];
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
  return koPoint && koPoint[0] === x && koPoint[1] === y && taken.length === 1;
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

function isCorner(x, y) {
  return (x === 0 || x === N - 1) && (y === 0 || y === N - 1);
}

function isSidePoint(x, y) {
  const edge = x === 0 || x === N - 1 || y === 0 || y === N - 1;
  return edge && !isCorner(x, y);
}

function stoneCount(b = board) {
  let n = 0;
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) if (b[y][x]) n++;
  }
  return n;
}

function groupKey(g) {
  return g.stones.map(([x, y]) => x + "," + y).sort().join(";");
}

function adjacentOwnGroups(x, y, color, prev) {
  const found = [];
  const seen = new Set();
  for (const [nx, ny] of neighbors(x, y)) {
    if (prev[ny][nx] !== color) continue;
    const g = groupAt(nx, ny, prev);
    const k = groupKey(g);
    if (seen.has(k)) continue;
    seen.add(k);
    found.push(g);
  }
  return found;
}

function savedAtariGroup(x, y, color, prev, nextBoard) {
  for (const g of groupsOf(color, prev)) {
    if (g.libs.length !== 1) continue;
    const [sx, sy] = g.stones[0];
    if (nextBoard[sy][sx] !== color) continue;
    const after = groupAt(sx, sy, nextBoard);
    if (after.libs.length === 0) continue;
    const onLib = g.libs[0] === x + "," + y;
    const beside = neighbors(x, y).some(([nx, ny]) =>
      g.stones.some(([gx, gy]) => gx === nx && gy === ny)
    );
    if (onLib || beside) return g;
  }
  return null;
}

function oppGroupsAtLiberty(x, y, color, prev) {
  return groupsOf(opp(color), prev).filter((g) => g.libs.includes(x + "," + y));
}

function describeMove(x, y, color, result, prev) {
  const who = colorName(color);
  const pt = pointName(x, y);
  const other = colorName(opp(color)).toLowerCase();

  if (result.taken.length) {
    const n = result.taken.length;
    const sample = pointName(result.taken[0][0], result.taken[0][1]);
    if (n === 1) return `${who} ${pt} — takes the ${other} stone at ${sample}.`;
    return `${who} ${pt} — takes ${n} ${other} stones (${sample}).`;
  }

  const saved = savedAtariGroup(x, y, color, prev, result.board);
  if (saved) {
    return `${who} ${pt} — saves the group at ${nameGroup(saved)}, which had one liberty.`;
  }

  if (adjacentOwnGroups(x, y, color, prev).length >= 2) {
    return `${who} ${pt} — connects two groups.`;
  }

  const press = oppGroupsAtLiberty(x, y, color, prev);
  if (press.length) {
    press.sort((a, b) => a.libs.length - b.libs.length);
    return `${who} ${pt} — fills a liberty of the ${other} group at ${nameGroup(press[0])}.`;
  }

  if (x === 2 && y === 2) return `${who} ${pt} — takes the center.`;
  if (isSidePoint(x, y)) return `${who} ${pt} — takes a side.`;
  return `${who} ${pt}.`;
}

function describePass(color, ending, reason) {
  const who = colorName(color);
  if (ending) return `${who} passes to end the game.`;
  if (reason === "none") return `${who} passes: no legal move.`;
  if (reason === "nogain") return `${who} passes: no legal gain.`;
  return `${who} passes.`;
}

function appendLog(text) {
  ply += 1;
  const li = document.createElement("li");
  li.textContent = ply + ". " + text;
  logEl.appendChild(li);
  logEl.scrollTop = logEl.scrollHeight;
}

function applyMove(x, y) {
  if (over) return false;
  const color = toPlay;
  const prev = cloneBoard();
  const r = playOn(board, x, y, color);
  if (!r) return false;
  if (isKo(x, y, r.taken)) return false;
  const line = describeMove(x, y, color, r, prev);
  board = r.board;
  caps[color] += r.taken.length;
  lastMove = [x, y];
  koPoint = r.taken.length === 1 ? r.taken[0] : null;
  passed = false;
  toPlay = opp(color);
  appendLog(line);
  draw();
  status();
  syncUi();
  scheduleMachine();
  return true;
}

function doPass(reason) {
  if (over) return;
  const color = toPlay;
  const ending = passed;
  lastMove = "pass";
  koPoint = null;
  if (ending) {
    appendLog(describePass(color, true));
    toPlay = opp(color);
    draw();
    endGame();
    syncUi();
    return;
  }
  passed = true;
  toPlay = opp(color);
  appendLog(describePass(color, false, reason));
  draw();
  status();
  syncUi();
  scheduleMachine();
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
  selfPlayRunning = false;
  clearAi();
  const t = territory();
  const el = document.getElementById("score");
  el.classList.remove("hidden");
  const winner =
    t.black === t.white ? "Even." : t.black > t.white ? "Black wins." : "White wins.";
  el.textContent = `Black ${t.black}  ·  White ${t.white}. ${winner}`;
  document.getElementById("turn").textContent = "Game over";
  syncUi();
}

function classifyGain(move, color, prev) {
  if (move.taken.length) return "capture";
  if (savedAtariGroup(move.x, move.y, color, prev, move.board)) return "save";
  if (adjacentOwnGroups(move.x, move.y, color, prev).length >= 2 && stoneCount(prev) < 12) {
    return "connect";
  }
  const press = oppGroupsAtLiberty(move.x, move.y, color, prev);
  if (press.some((g) => g.libs.length <= 2)) return "pressure";
  if (move.x === 2 && move.y === 2) return "center";
  if (stoneCount(prev) < 6 && isSidePoint(move.x, move.y)) return "side";
  if (stoneCount(prev) < 4 && !isCorner(move.x, move.y)) return "develop";
  return "none";
}

function scoreMove(move, color, prev) {
  let s = 0;
  s += move.taken.length * 24;
  if (savedAtariGroup(move.x, move.y, color, prev, move.board)) s += 18;
  if (adjacentOwnGroups(move.x, move.y, color, prev).length >= 2) s += 7;
  for (const g of oppGroupsAtLiberty(move.x, move.y, color, prev)) {
    if (g.libs.length === 1) s += 24;
    else if (g.libs.length === 2) s += 9;
    else if (g.libs.length === 3) s += 3;
    else s += 1;
  }
  const g = groupAt(move.x, move.y, move.board);
  if (g.libs.length === 1) s -= 8;
  else s += Math.min(g.libs.length, 4) * 0.7;
  if (move.x === 2 && move.y === 2) s += 3.5;
  if (isSidePoint(move.x, move.y)) s += 1.4;
  if (isCorner(move.x, move.y)) s -= 1.2;
  s += Math.random() * 0.25;
  return s;
}

function pickMachineMove(color) {
  if (ply >= 36) return { type: "pass", reason: "nogain" };
  const prev = board;
  const moves = legalMoves(color);
  if (!moves.length) return { type: "pass", reason: "none" };
  const ranked = moves.map((m) => ({
    m,
    s: scoreMove(m, color, prev),
    kind: classifyGain(m, color, prev),
  }));
  ranked.sort((a, b) => b.s - a.s);
  const choice = ranked.find((r) => r.kind !== "none");
  if (!choice) return { type: "pass", reason: "nogain" };
  return { type: "play", x: choice.m.x, y: choice.m.y };
}

function machineShouldPlay() {
  if (over || !isMachine(toPlay)) return false;
  if (bothMachine() && !selfPlayRunning) return false;
  return true;
}

function clearAi() {
  if (aiTimer) {
    clearTimeout(aiTimer);
    aiTimer = null;
  }
}

function scheduleMachine() {
  clearAi();
  if (!machineShouldPlay()) return;
  aiTimer = setTimeout(playMachine, speedMs());
}

function playMachine() {
  aiTimer = null;
  if (!machineShouldPlay()) return;
  const pick = pickMachineMove(toPlay);
  if (pick.type === "pass") doPass(pick.reason);
  else applyMove(pick.x, pick.y);
}

function pad() {
  const w = canvas.width;
  return { m: w * 0.14, step: (w * 0.72) / (N - 1) };
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

function drawCoords() {
  const w = canvas.width;
  const { m, step } = pad();
  ctx.fillStyle = "#3b2a18";
  ctx.font = Math.round(w * 0.03) + "px Georgia, serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (let x = 0; x < N; x++) {
    const px = m + x * step;
    ctx.fillText(FILES[x], px, m - step * 0.38);
    ctx.fillText(FILES[x], px, m + (N - 1) * step + step * 0.38);
  }
  for (let y = 0; y < N; y++) {
    const py = m + y * step;
    const rank = String(N - y);
    ctx.fillText(rank, m - step * 0.38, py);
    ctx.fillText(rank, m + (N - 1) * step + step * 0.38, py);
  }
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
  drawCoords();
  if (!board) return;
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
  if (canHumanAct() && hover && board[hover[1]][hover[0]] === EMPTY) {
    const r = playOn(board, hover[0], hover[1], toPlay);
    const ok = r && !isKo(hover[0], hover[1], r.taken);
    if (ok) drawStone(hover[0], hover[1], toPlay, 0.35);
  }
}

function status() {
  const turnEl = document.getElementById("turn");
  if (over) {
    turnEl.textContent = "Game over";
  } else if (bothMachine() && !selfPlayRunning) {
    turnEl.textContent = colorName(toPlay) + " to play. Press Start.";
  } else {
    turnEl.textContent = colorName(toPlay) + " to play";
  }
  document.getElementById("cap-b").textContent = String(caps[BLACK]);
  document.getElementById("cap-w").textContent = String(caps[WHITE]);
}

function updateSpeedLabel() {
  const i = Math.min(SPEED_NAMES.length - 1, Math.max(0, Number(speedEl.value) - 1));
  speedLabel.textContent = SPEED_NAMES[i];
}

function syncUi() {
  const machines = anyMachine();
  const duo = bothMachine();
  machineBox.classList.toggle("hidden", !machines);
  selfPlayBtns.classList.toggle("hidden", !duo);
  btnStart.disabled = !duo || selfPlayRunning;
  btnPause.disabled = !duo || !selfPlayRunning;
  btnPass.disabled = !canHumanAct();
  canvas.classList.toggle("is-locked", !canHumanAct());
  updateSpeedLabel();
}

function onPlayersChange() {
  const duo = bothMachine();
  if (!duo) selfPlayRunning = false;
  syncUi();
  status();
  draw();
  if (duo && !selfPlayRunning) clearAi();
  else scheduleMachine();
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
  if (!canHumanAct()) return;
  const pt = pixToXy(e.clientX, e.clientY);
  if (!pt) return;
  applyMove(pt[0], pt[1]);
});

btnPass.addEventListener("click", () => {
  if (!canHumanAct()) return;
  doPass();
});
document.getElementById("btn-new").addEventListener("click", reset);
btnStart.addEventListener("click", () => {
  if (!bothMachine()) return;
  if (over) reset();
  if (!bothMachine()) return;
  selfPlayRunning = true;
  syncUi();
  status();
  scheduleMachine();
});
btnPause.addEventListener("click", () => {
  selfPlayRunning = false;
  clearAi();
  syncUi();
  status();
});
blackSel.addEventListener("change", onPlayersChange);
whiteSel.addEventListener("change", onPlayersChange);
speedEl.addEventListener("input", () => {
  updateSpeedLabel();
  if (aiTimer) scheduleMachine();
});

reset();
