"use strict";

const P = 17, A = 0, B = 7;
const $ = (id) => document.getElementById(id);
const form = $("key-form"), keyInput = $("private-key"), baseSelect = $("base-point");
const errorMessage = $("error-message"), logContainer = $("calculation-log");
const publicKeyOutput = $("public-key"), canvas = $("curve-canvas");
const ctx = canvas.getContext("2d");
let activeSteps = [], activeIndex = 0, currentResult = null, playTimer = null;

function mod(n) { return ((n % P) + P) % P; }
function modInverse(n) {
  n = mod(n);
  for (let i = 1; i < P; i++) if (mod(n * i) === 1) return i;
  throw new Error("Modular inverse does not exist.");
}
function isOnCurve(point) {
  if (point === null) return true;
  return mod(point.y * point.y) === mod(point.x ** 3 + A * point.x + B);
}
function pointAdd(P1, P2) {
  if (P1 === null) return P2;
  if (P2 === null) return P1;
  if (P1.x === P2.x && mod(P1.y + P2.y) === 0) return null;
  let slope;
  if (P1.x === P2.x && P1.y === P2.y) {
    if (mod(2 * P1.y) === 0) return null;
    slope = mod((3 * P1.x ** 2 + A) * modInverse(2 * P1.y));
  } else {
    slope = mod((P2.y - P1.y) * modInverse(P2.x - P1.x));
  }
  const result = {
    x: mod(slope ** 2 - P1.x - P2.x),
    y: mod(slope * (P1.x - mod(slope ** 2 - P1.x - P2.x)) - P1.y)
  };
  if (!isOnCurve(result)) throw new Error("Calculated point is not on the curve.");
  return result;
}
function pointKey(pt) { return pt === null ? "O" : `${pt.x},${pt.y}`; }
function formatPoint(pt) { return pt === null ? "O (point at infinity)" : `(${pt.x}, ${pt.y})`; }
function allCurvePoints() {
  const pts = [];
  for (let x = 0; x < P; x++) for (let y = 0; y < P; y++)
    if (isOnCurve({x, y})) pts.push({x, y});
  return pts;
}
const curvePoints = allCurvePoints();
function pointOrder(G) {
  let q = null;
  for (let n = 1; n <= 100; n++) {
    q = pointAdd(q, G);
    if (q === null) return n;
  }
  return null;
}
function scalarMultiply(k, G) {
  // Right-to-left double-and-add. Keep a trace of the algorithm's operations.
  let n = k, addend = G, result = null, steps = [];
  let bitIndex = 0;
  steps.push({ operation: "Initialise result R = O", point: result, detail: "Start at the point at infinity." });
  while (n > 0) {
    const bit = n & 1;
    if (bit) {
      result = pointAdd(result, addend);
      steps.push({ operation: `Bit ${bitIndex} is 1: R = R + addend`, point: result, detail: `Add the current power-of-two multiple.` });
    } else {
      steps.push({ operation: `Bit ${bitIndex} is 0: skip addition`, point: result, detail: `No addition to R for this bit.` });
    }
    n = Math.floor(n / 2);
    if (n > 0) {
      addend = pointAdd(addend, addend);
      steps.push({ operation: `Double addend → ${2 ** (bitIndex + 1)}G`, point: addend, detail: "Double the current multiple for the next binary bit." });
    }
    bitIndex++;
  }
  steps.push({ operation: `Final result Q = ${k}G`, point: result, detail: "The double-and-add result is the public point for this toy experiment." });
  return { publicKey: result, steps };
}
function fillBasePoints() {
  const options = curvePoints.map(pt => {
    const option = document.createElement("option");
    option.value = pointKey(pt);
    option.textContent = `(${pt.x}, ${pt.y})`;
    return option;
  });
  baseSelect.replaceChildren(...options);
  baseSelect.value = "1,5";
  $("point-count").textContent = String(curvePoints.length + 1);
}
function selectedBase() {
  const [x, y] = baseSelect.value.split(",").map(Number);
  return {x, y};
}
function stopAnimation() {
  if (playTimer) clearInterval(playTimer);
  playTimer = null;
  $("play-animation").textContent = "▶ Play steps";
}
function renderSteps() {
  logContainer.replaceChildren();
  activeSteps.forEach((step, i) => {
    const row = document.createElement("div");
    row.className = "log-row" + (i === activeIndex ? " active" : "") + (i === activeSteps.length - 1 ? " final-row" : "");
    const n = document.createElement("span"); n.className = "step"; n.textContent = String(i + 1).padStart(2, "0");
    const op = document.createElement("span"); op.className = "operation"; op.textContent = step.operation;
    const pt = document.createElement("span"); pt.className = "point"; pt.textContent = formatPoint(step.point);
    row.append(n, op, pt);
    logContainer.appendChild(row);
  });
  const step = activeSteps[activeIndex];
  $("animation-status").textContent = `Step ${activeIndex + 1} of ${activeSteps.length}: ${step.operation}`;
  $("prev-step").disabled = activeIndex === 0;
  $("next-step").disabled = activeIndex === activeSteps.length - 1;
  drawGraph(step.point);
}
function drawGraph(highlight) {
  const rect = canvas.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.floor(rect.width * dpr));
  canvas.height = Math.max(1, Math.floor(390 * dpr));
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const w = rect.width, h = 390, pad = {l: 42, r: 18, t: 20, b: 36};
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#fbf8f0"; ctx.fillRect(0, 0, w, h);
  const sx = (w - pad.l - pad.r) / 16, sy = (h - pad.t - pad.b) / 16;
  const X = x => pad.l + x * sx, Y = y => h - pad.b - y * sy;
  ctx.font = '11px "DM Mono", monospace'; ctx.textAlign = "center"; ctx.textBaseline = "middle";
  for (let i=0;i<=16;i++) {
    ctx.strokeStyle = "#e7dfd0"; ctx.lineWidth = 1; ctx.beginPath();
    ctx.moveTo(X(i), pad.t); ctx.lineTo(X(i), h-pad.b); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(pad.l, Y(i)); ctx.lineTo(w-pad.r, Y(i)); ctx.stroke();
    ctx.fillStyle = "#807767"; ctx.fillText(i, X(i), h-pad.b+17);
    if (i % 2 === 0) { ctx.textAlign = "right"; ctx.fillText(i, pad.l-10, Y(i)); ctx.textAlign = "center"; }
  }
  ctx.strokeStyle = "#8b806e"; ctx.lineWidth = 1.4;
  ctx.beginPath(); ctx.moveTo(pad.l, pad.t); ctx.lineTo(pad.l, h-pad.b); ctx.lineTo(w-pad.r, h-pad.b); ctx.stroke();
  ctx.fillStyle = "#655b4e"; ctx.textAlign = "left"; ctx.fillText("y", pad.l-20, pad.t+2);
  ctx.textAlign = "right"; ctx.fillText("x", w-pad.r, h-12);
  const G = selectedBase();
  curvePoints.forEach(pt => {
    let fill = "#b8a58b", r = 4;
    if (pt.x === G.x && pt.y === G.y) { fill = "#52745b"; r = 6; }
    if (highlight && pt.x === highlight.x && pt.y === highlight.y) { fill = "#c46b45"; r = 7; }
    ctx.beginPath(); ctx.arc(X(pt.x), Y(pt.y), r, 0, Math.PI*2); ctx.fillStyle = fill; ctx.fill();
    if ((pt.x === G.x && pt.y === G.y) || (highlight && pt.x === highlight.x && pt.y === highlight.y)) {
      ctx.strokeStyle = "#fffaf0"; ctx.lineWidth = 2; ctx.stroke();
    }
  });
}
function renderMultiples(k, G, publicKey) {
  const body = $("multiples-list");
  body.replaceChildren();
  let point = null;
  for (let i = 1; i <= k; i++) {
    point = pointAdd(point, G); // Repeated-addition sequence: G, 2G, 3G, ... kG
    const row = document.createElement("tr");
    if (i === k) row.className = "sequence-final";
    const multiple = document.createElement("td");
    multiple.textContent = `${i}G`;
    const coordinate = document.createElement("td");
    coordinate.textContent = formatPoint(point);
    const status = document.createElement("td");
    status.textContent = i === k ? "Final result" : (point === null ? "Infinity" : "Intermediate");
    row.append(multiple, coordinate, status);
    body.appendChild(row);
  }
  $("sequence-count").textContent = `${k} ${k === 1 ? "point" : "points"}`;
}
function runExperiment() {
  stopAnimation();
  const k = Number(keyInput.value), G = selectedBase();
  if (!keyInput.value.trim() || !Number.isSafeInteger(k) || k < 1 || k > 100) {
    errorMessage.textContent = "Enter a whole number between 1 and 100."; return;
  }
  errorMessage.textContent = "";
  const result = scalarMultiply(k, G);
  currentResult = result;
  activeSteps = result.steps;
  activeIndex = 0;
  $("base-summary").textContent = formatPoint(G);
  $("scalar-summary").textContent = String(k);
  publicKeyOutput.textContent = `Q = ${formatPoint(result.publicKey)}`;
  renderMultiples(k, G, result.publicKey);
  $("order-summary").textContent = String(pointOrder(G));
  $("binary-value").textContent = `${k}₁₀ = ${k.toString(2)}₂`;
  renderSteps();
}
form.addEventListener("submit", e => { e.preventDefault(); runExperiment(); });
$("reset-button").addEventListener("click", () => {
  baseSelect.value = "1,5"; keyInput.value = "8"; runExperiment();
});
$("prev-step").addEventListener("click", () => { stopAnimation(); activeIndex = Math.max(0, activeIndex-1); renderSteps(); });
$("next-step").addEventListener("click", () => { stopAnimation(); activeIndex = Math.min(activeSteps.length-1, activeIndex+1); renderSteps(); });
$("play-animation").addEventListener("click", () => {
  if (playTimer) { stopAnimation(); return; }
  if (activeIndex >= activeSteps.length-1) activeIndex = 0;
  $("play-animation").textContent = "Ⅱ Pause";
  renderSteps();
  playTimer = setInterval(() => {
    if (activeIndex >= activeSteps.length-1) { stopAnimation(); return; }
    activeIndex++; renderSteps();
    if (activeIndex >= activeSteps.length-1) stopAnimation();
  }, 850);
});
baseSelect.addEventListener("change", runExperiment);
window.addEventListener("resize", () => { if (activeSteps.length) drawGraph(activeSteps[activeIndex].point); });
fillBasePoints();
runExperiment();
