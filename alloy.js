"use strict";

// ============================================================
//  ALLOY DATA — from TFC v3.2.19 + TFG KubeJS overrides
// ============================================================

const MB_PER_INGOT = 144;

const MELTABLE_ITEMS = [
  { id: "ingot",      label: "Ingot",      mb: 144, max: 64 },
  { id: "dust",       label: "Dust",       mb: 144, max: 64 },
  { id: "small_dust", label: "Small Dust", mb: 36,  max: 64 },
  { id: "tiny_dust",  label: "Tiny Dust",  mb: 16,  max: 64 },
  { id: "nugget",     label: "Nugget",     mb: 16,  max: 64 },
];

const ALLOYS = [
  { id: "bronze",          name: "Bronze",          components: [{ metal: "Copper", min: 0.70, max: 0.80 }, { metal: "Tin", min: 0.20, max: 0.30 }] },
  { id: "brass",           name: "Brass",           components: [{ metal: "Copper", min: 0.70, max: 0.80 }, { metal: "Zinc", min: 0.20, max: 0.30 }] },
  { id: "bismuth_bronze",  name: "Bismuth Bronze",  components: [{ metal: "Zinc", min: 0.20, max: 0.30 }, { metal: "Copper", min: 0.50, max: 0.65 }, { metal: "Bismuth", min: 0.10, max: 0.20 }] },
  { id: "black_bronze",    name: "Black Bronze",    components: [{ metal: "Copper", min: 0.50, max: 0.70 }, { metal: "Silver", min: 0.10, max: 0.25 }, { metal: "Gold", min: 0.10, max: 0.25 }] },
  { id: "rose_gold",       name: "Rose Gold",       components: [{ metal: "Copper", min: 0.15, max: 0.30 }, { metal: "Gold", min: 0.70, max: 0.85 }] },
  { id: "sterling_silver", name: "Sterling Silver", components: [{ metal: "Copper", min: 0.20, max: 0.40 }, { metal: "Silver", min: 0.60, max: 0.80 }] },
  { id: "weak_steel",      name: "Weak Steel",      components: [{ metal: "Steel", min: 0.50, max: 0.70 }, { metal: "Nickel", min: 0.15, max: 0.25 }, { metal: "Black Bronze", min: 0.15, max: 0.25 }] },
  { id: "weak_blue_steel", name: "Weak Blue Steel", components: [{ metal: "Black Steel", min: 0.50, max: 0.55 }, { metal: "Steel", min: 0.20, max: 0.25 }, { metal: "Bismuth Bronze", min: 0.10, max: 0.15 }, { metal: "Sterling Silver", min: 0.10, max: 0.15 }] },
  { id: "weak_red_steel",  name: "Weak Red Steel",  components: [{ metal: "Black Steel", min: 0.50, max: 0.55 }, { metal: "Steel", min: 0.20, max: 0.25 }, { metal: "Brass", min: 0.10, max: 0.15 }, { metal: "Rose Gold", min: 0.10, max: 0.15 }] },
  { id: "red_alloy",       name: "Red Alloy",       components: [{ metal: "Redstone", min: 0.75, max: 0.85 }, { metal: "Copper", min: 0.15, max: 0.25 }] },
  { id: "tin_alloy",       name: "Tin Alloy",       components: [{ metal: "Tin", min: 0.45, max: 0.55 }, { metal: "Cast Iron", min: 0.45, max: 0.55 }] },
  { id: "invar",           name: "Invar",           components: [{ metal: "Nickel", min: 0.60, max: 0.70 }, { metal: "Cast Iron", min: 0.30, max: 0.40 }] },
  { id: "potin",           name: "Potin",           components: [{ metal: "Copper", min: 0.63, max: 0.69 }, { metal: "Tin", min: 0.19, max: 0.25 }, { metal: "Lead", min: 0.08, max: 0.14 }] },
  { id: "cobalt_brass",    name: "Cobalt Brass",    components: [{ metal: "Brass", min: 0.74, max: 0.81 }, { metal: "Cobalt", min: 0.08, max: 0.14 }, { metal: "Aluminium Silicate", min: 0.08, max: 0.14 }] },
];

const ALL_METALS = (() => {
  const s = new Set();
  for (const a of ALLOYS) for (const c of a.components) s.add(c.metal);
  ["Wrought Iron", "Pig Iron"].forEach(m => s.add(m));
  return [...s].sort();
})();

// ============================================================
//  SOLVER ENGINE
// ============================================================

let _globalDP = null;
let _globalDPSize = 0;

function getGlobalDP(maxMb) {
  if (_globalDP && _globalDPSize >= maxMb) return _globalDP;
  _globalDP = buildDP(maxMb, null);
  _globalDPSize = maxMb;
  return _globalDP;
}

function buildDP(maxMb, limits) {
  const dp = new Uint8Array(maxMb + 1);
  dp[0] = 1;
  for (const item of MELTABLE_ITEMS) {
    const maxQty = limits ? (limits[item.id] || 0) : item.max;
    for (let c = 0; c < maxQty; c++) {
      for (let v = maxMb; v >= item.mb; v--) {
        if (dp[v - item.mb]) dp[v] = 1;
      }
    }
  }
  return dp;
}

function getItemOrder(optimize) {
  const items = [...MELTABLE_ITEMS];
  if (!optimize || optimize.direction === "none" || optimize.type !== "item") {
    return items.sort((a, b) => b.mb - a.mb);
  }
  const tid = optimize.target;
  if (optimize.direction === "maximize") {
    return items.sort((a, b) => {
      if (a.id === tid && b.id !== tid) return -1;
      if (b.id === tid && a.id !== tid) return 1;
      return b.mb - a.mb;
    });
  }
  return items.sort((a, b) => {
    if (a.id === tid && b.id !== tid) return 1;
    if (b.id === tid && a.id !== tid) return -1;
    return b.mb - a.mb;
  });
}

function fillWithItems(target, itemOrder, limits) {
  if (target === 0) return [];
  if (target < 0) return null;

  const result = [];
  let rem = target;
  for (const item of itemOrder) {
    if (item.mb > rem) continue;
    const maxQty = limits ? (limits[item.id] || 0) : item.max;
    const qty = Math.min(Math.floor(rem / item.mb), maxQty);
    if (qty > 0) {
      result.push({ id: item.id, label: item.label, mb: item.mb, qty });
      rem -= qty * item.mb;
    }
    if (rem === 0) break;
  }
  if (rem === 0) return result;

  const available = itemOrder.filter(it => {
    const mq = limits ? (limits[it.id] || 0) : it.max;
    return mq > 0;
  });
  const memo = new Map();
  function solve(r, idx) {
    if (r === 0) return [];
    if (r < 0 || idx >= available.length) return null;
    const key = r * 10 + idx;
    if (memo.has(key)) return memo.get(key);
    const item = available[idx];
    const mq = limits ? (limits[item.id] || 0) : item.max;
    for (let q = Math.min(Math.floor(r / item.mb), mq); q >= 0; q--) {
      const rest = solve(r - q * item.mb, idx + 1);
      if (rest !== null) {
        const out = q > 0
          ? [{ id: item.id, label: item.label, mb: item.mb, qty: q }, ...rest]
          : [...rest];
        memo.set(key, out);
        return out;
      }
    }
    memo.set(key, null);
    return null;
  }
  return solve(target, 0);
}

const MAX_CANDS = 200;

function _genCandidates(lo, hi, dp, comp, optimize, totalMb) {
  const cands = [];
  const isOpt = optimize && optimize.direction !== "none"
    && optimize.type === "material" && optimize.target === comp.metal;

  if (isOpt && optimize.direction === "minimize") {
    for (let v = lo; v <= hi && cands.length < MAX_CANDS; v++) {
      if (v < dp.length && dp[v]) cands.push(v);
    }
  } else if (isOpt && optimize.direction === "maximize") {
    for (let v = hi; v >= lo && cands.length < MAX_CANDS; v--) {
      if (v < dp.length && dp[v]) cands.push(v);
    }
  } else {
    const mid = Math.round(totalMb * (comp.min + comp.max) / 2);
    const clampedMid = Math.max(lo, Math.min(hi, mid));
    if (clampedMid < dp.length && dp[clampedMid]) cands.push(clampedMid);
    for (let d = 1; cands.length < MAX_CANDS && (clampedMid - d >= lo || clampedMid + d <= hi); d++) {
      if (clampedMid - d >= lo && clampedMid - d < dp.length && dp[clampedMid - d]) cands.push(clampedMid - d);
      if (clampedMid + d <= hi && clampedMid + d < dp.length && dp[clampedMid + d]) cands.push(clampedMid + d);
    }
  }
  return cands;
}

let _btIter = 0;
const MAX_BT_ITER = 500000;

function _backtrack(ranges, dps, idx, remaining, amounts, optimize, totalMb) {
  if (++_btIter > MAX_BT_ITER) return false;
  if (idx === ranges.length) return remaining === 0;

  const r = ranges[idx];
  const dp = dps[idx];
  const isLast = idx === ranges.length - 1;

  if (isLast) {
    if (remaining < r.loMb || remaining > r.hiMb) return false;
    if (remaining >= dp.length || !dp[remaining]) return false;
    amounts[idx] = remaining;
    return true;
  }

  const lo = Math.max(r.loMb, 0);
  const hi = Math.min(r.hiMb, remaining, dp.length - 1);
  if (lo > hi) return false;

  const cands = _genCandidates(lo, hi, dp, r, optimize, totalMb);
  for (const amt of cands) {
    amounts[idx] = amt;
    if (_backtrack(ranges, dps, idx + 1, remaining - amt, amounts, optimize, totalMb)) return true;
  }
  return false;
}

function allocate(components, totalMb, dps, itemOrder, optimize, limitsArr) {
  const ranges = components.map((c, i) => ({
    metal: c.metal, min: c.min, max: c.max,
    loMb: Math.ceil(totalMb * c.min),
    hiMb: Math.floor(totalMb * c.max),
  }));
  const amounts = new Array(components.length);
  _btIter = 0;
  if (!_backtrack(ranges, dps, 0, totalMb, amounts, optimize, totalMb)) return null;

  const allocs = [];
  for (let i = 0; i < components.length; i++) {
    const lim = limitsArr ? limitsArr[i] : null;
    const items = fillWithItems(amounts[i], itemOrder, lim);
    if (!items) return null;
    allocs.push({ metal: components[i].metal, min: components[i].min, max: components[i].max, mb: amounts[i], items });
  }
  return allocs;
}

// ============================================================
//  SOLVER: PERFECT RECIPE
// ============================================================

function solvePerfect(components, desiredIngots, optimize) {
  const desiredMb = desiredIngots * MB_PER_INGOT;
  const maxSearch = desiredMb + MB_PER_INGOT * 6;
  const dp = getGlobalDP(maxSearch);
  const dps = components.map(() => dp);
  const itemOrder = getItemOrder(optimize);

  let bestResult = null;
  let bestWaste = Infinity;

  for (let totalMb = desiredMb; totalMb <= maxSearch; totalMb++) {
    const outputIngots = Math.floor(totalMb / MB_PER_INGOT);
    if (outputIngots < desiredIngots) continue;
    const waste = totalMb % MB_PER_INGOT;
    if (waste >= bestWaste) continue;

    const allocs = allocate(components, totalMb, dps, itemOrder, optimize, null);
    if (!allocs) continue;

    bestWaste = waste;
    bestResult = { totalMb, outputIngots, waste, allocations: allocs };
    if (waste === 0) break;
  }
  if (bestResult) bestResult.score = scoreResult(bestResult, components, desiredIngots);
  return bestResult;
}

function solvePerfectPure(desiredIngots, optimize) {
  const target = desiredIngots * MB_PER_INGOT;
  const itemOrder = getItemOrder(optimize);
  const items = fillWithItems(target, itemOrder, null);
  if (!items) return null;
  const result = { totalMb: target, outputIngots: desiredIngots, waste: 0,
    allocations: [{ metal: null, min: 1, max: 1, mb: target, items }] };
  result.score = scoreResultPure(result, desiredIngots);
  return result;
}

// ============================================================
//  SOLVER: USE AVAILABLE
// ============================================================

function solveAvailable(components, desiredIngots, inventories, optimize) {
  const itemOrder = getItemOrder(optimize);

  const compMax = inventories.map(inv =>
    Object.entries(inv).reduce((s, [id, qty]) => {
      const it = MELTABLE_ITEMS.find(m => m.id === id);
      return s + (it ? it.mb * qty : 0);
    }, 0)
  );
  const maxTotal = compMax.reduce((a, b) => a + b, 0);
  if (maxTotal < 16) return null;

  const dps = inventories.map((inv, i) => buildDP(compMax[i], inv));
  const goalMb = Math.min(desiredIngots * MB_PER_INGOT, maxTotal);
  const searchRadius = MB_PER_INGOT * 6;

  let bestResult = null;
  let bestScore = -1;

  for (let delta = 0; delta <= searchRadius; delta++) {
    const trials = delta === 0 ? [goalMb] : [goalMb + delta, goalMb - delta];
    for (const t of trials) {
      if (t < 16 || t > maxTotal) continue;

      const allocs = allocate(components, t, dps, itemOrder, optimize, inventories);
      if (!allocs) continue;

      const waste = t % MB_PER_INGOT;
      const result = { totalMb: t, outputIngots: Math.floor(t / MB_PER_INGOT), waste, allocations: allocs };
      result.score = scoreResult(result, components, desiredIngots);

      if (result.score.total > bestScore) {
        bestScore = result.score.total;
        bestResult = result;
        if (bestScore >= 99) return bestResult;
      }
    }
  }
  return bestResult;
}

function solveAvailablePure(desiredIngots, inventory, optimize) {
  const itemOrder = getItemOrder(optimize);
  const maxMb = Object.entries(inventory).reduce((s, [id, qty]) => {
    const it = MELTABLE_ITEMS.find(m => m.id === id);
    return s + (it ? it.mb * qty : 0);
  }, 0);
  if (maxMb < 16) return null;

  const dp = buildDP(maxMb, inventory);
  const goalMb = Math.min(desiredIngots * MB_PER_INGOT, maxMb);

  let bestResult = null;
  let bestScore = -1;

  for (let delta = 0; delta <= MB_PER_INGOT * 4; delta++) {
    const trials = delta === 0 ? [goalMb] : [goalMb + delta, goalMb - delta];
    for (const t of trials) {
      if (t < 16 || t > maxMb || !dp[t]) continue;
      const items = fillWithItems(t, itemOrder, inventory);
      if (!items) continue;

      const waste = t % MB_PER_INGOT;
      const result = { totalMb: t, outputIngots: Math.floor(t / MB_PER_INGOT), waste,
        allocations: [{ metal: null, min: 1, max: 1, mb: t, items }] };
      result.score = scoreResultPure(result, desiredIngots);

      if (result.score.total > bestScore) {
        bestScore = result.score.total;
        bestResult = result;
        if (waste === 0 && result.outputIngots >= desiredIngots) return bestResult;
      }
    }
  }
  return bestResult;
}

// ============================================================
//  SCORING
// ============================================================

function scoreResult(result, components, desiredIngots) {
  const totalMb = result.totalMb;

  let validitySum = 0;
  let allValid = true;
  for (let i = 0; i < components.length; i++) {
    const c = components[i];
    const a = result.allocations[i];
    const pct = totalMb > 0 ? a.mb / totalMb : 0;
    const mid = (c.min + c.max) / 2;
    const halfRange = (c.max - c.min) / 2;
    if (pct >= c.min - 0.001 && pct <= c.max + 0.001) {
      const d = halfRange > 0 ? Math.abs(pct - mid) / halfRange : 0;
      validitySum += 1 - d * 0.3;
    } else {
      allValid = false;
    }
  }
  const validity = (validitySum / components.length) * 40;
  const efficiency = 30 * (1 - result.waste / MB_PER_INGOT);
  const yieldScore = 30 * Math.min(1, result.outputIngots / desiredIngots);
  const total = Math.max(0, Math.min(100, Math.round(validity + efficiency + yieldScore)));

  return { total, validity: Math.round(validity), efficiency: Math.round(efficiency),
    yield: Math.round(yieldScore), allValid,
    isPerfect: result.waste === 0 && allValid && result.outputIngots >= desiredIngots };
}

function scoreResultPure(result, desiredIngots) {
  const efficiency = 30 * (1 - result.waste / MB_PER_INGOT);
  const yieldScore = 30 * Math.min(1, result.outputIngots / desiredIngots);
  const total = Math.max(0, Math.min(100, Math.round(40 + efficiency + yieldScore)));
  return { total, validity: 40, efficiency: Math.round(efficiency), yield: Math.round(yieldScore),
    allValid: true, isPerfect: result.waste === 0 && result.outputIngots >= desiredIngots };
}

// ============================================================
//  UI CONTROLLER
// ============================================================

let alloyMode = "alloy";
let calcMode = "perfect";
let selectedAlloy = ALLOYS[0];
let selectedPureMetal = ALL_METALS[0];

function $a(id) { return document.getElementById(id); }

function initAlloyUI() {
  populateAlloyTargets();
  renderAlloyComponents();

  $a("alloy-mode-toggle").querySelectorAll(".mode-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      alloyMode = btn.dataset.mode;
      $a("alloy-mode-toggle").querySelectorAll(".mode-btn").forEach(b => b.classList.toggle("active", b === btn));
      populateAlloyTargets();
      renderAlloyComponents();
      populateOptTargets();
      $a("alloy-results").classList.add("hidden");
    });
  });

  $a("alloy-calc-toggle").querySelectorAll(".mode-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      calcMode = btn.dataset.calc;
      $a("alloy-calc-toggle").querySelectorAll(".mode-btn").forEach(b => b.classList.toggle("active", b === btn));
      updateCompHeader();
      $a("alloy-results").classList.add("hidden");
    });
  });

  $a("alloy-target").addEventListener("change", () => {
    if (alloyMode === "alloy") {
      selectedAlloy = ALLOYS.find(a => a.id === $a("alloy-target").value) || ALLOYS[0];
    } else {
      selectedPureMetal = $a("alloy-target").value;
    }
    renderAlloyComponents();
    populateOptTargets();
    $a("alloy-results").classList.add("hidden");
  });

  $a("opt-direction").addEventListener("change", () => {
    const dir = $a("opt-direction").value;
    $a("opt-type").classList.toggle("hidden", dir === "none");
    $a("opt-target").classList.toggle("hidden", dir === "none");
    if (dir !== "none") populateOptTargets();
  });

  $a("opt-type").addEventListener("change", populateOptTargets);
  $a("alloy-calc-btn").addEventListener("click", runAlloyCalc);
  $a("alloy-ingots").addEventListener("keydown", e => { if (e.key === "Enter") runAlloyCalc(); });

  updateCompHeader();
}

function populateAlloyTargets() {
  const sel = $a("alloy-target");
  sel.innerHTML = "";
  if (alloyMode === "alloy") {
    for (const a of ALLOYS) {
      const o = document.createElement("option");
      o.value = a.id; o.textContent = a.name;
      if (a.id === selectedAlloy.id) o.selected = true;
      sel.appendChild(o);
    }
  } else {
    for (const m of ALL_METALS) {
      const o = document.createElement("option");
      o.value = m; o.textContent = m;
      if (m === selectedPureMetal) o.selected = true;
      sel.appendChild(o);
    }
  }
}

function populateOptTargets() {
  const typeVal = $a("opt-type").value;
  const sel = $a("opt-target");
  sel.innerHTML = "";
  if (typeVal === "material") {
    const metals = alloyMode === "alloy"
      ? selectedAlloy.components.map(c => c.metal)
      : [selectedPureMetal];
    for (const m of metals) {
      const o = document.createElement("option");
      o.value = m; o.textContent = m;
      sel.appendChild(o);
    }
  } else {
    for (const it of MELTABLE_ITEMS) {
      const o = document.createElement("option");
      o.value = it.id; o.textContent = it.label;
      sel.appendChild(o);
    }
  }
}

function updateCompHeader() {
  const hdr = $a("alloy-comp-header");
  hdr.textContent = calcMode === "perfect" ? "Recipe (auto-calculated)" : "Enter Available Materials";
}

function renderAlloyComponents() {
  const container = $a("alloy-components");
  container.innerHTML = "";
  if (alloyMode === "alloy") {
    for (const comp of selectedAlloy.components) {
      container.appendChild(buildCompCard(comp.metal, comp.min, comp.max));
    }
  } else {
    container.appendChild(buildCompCard(selectedPureMetal, 1, 1, true));
  }
}

function buildCompCard(metalName, minPct, maxPct, isPure) {
  const card = document.createElement("div");
  card.className = "comp-card";
  card.dataset.metal = metalName;

  const header = document.createElement("div");
  header.className = "comp-header";
  const name = document.createElement("span");
  name.className = "comp-name";
  name.textContent = metalName;
  const range = document.createElement("span");
  range.className = "comp-range";
  range.innerHTML = isPure ? "100%"
    : `<span class="pct-val">${(minPct * 100).toFixed(0)}%</span> – <span class="pct-val">${(maxPct * 100).toFixed(0)}%</span>`;
  header.appendChild(name);
  header.appendChild(range);
  card.appendChild(header);

  const items = document.createElement("div");
  items.className = "comp-items";
  for (const item of MELTABLE_ITEMS) {
    const el = document.createElement("div");
    el.className = "comp-item";
    el.innerHTML = `
      <span class="comp-item-label">${item.label}</span>
      <span class="comp-item-mb">${item.mb}mb</span>
      <input type="number" min="0" max="${item.max}" value="0"
             data-metal="${metalName}" data-item="${item.id}" data-mb="${item.mb}">
    `;
    items.appendChild(el);
  }
  card.appendChild(items);

  const totalLine = document.createElement("div");
  totalLine.className = "comp-mb-total";
  totalLine.innerHTML = `<span class="mb-num">0</span> mB`;
  card.appendChild(totalLine);

  items.querySelectorAll("input").forEach(inp => {
    inp.addEventListener("input", () => updateCompTotal(card));
  });
  return card;
}

function updateCompTotal(card) {
  let total = 0;
  card.querySelectorAll("input[type='number']").forEach(inp => {
    total += (parseInt(inp.value) || 0) * parseInt(inp.dataset.mb);
  });
  card.querySelector(".comp-mb-total").innerHTML = `<span class="mb-num">${total}</span> mB`;
}

function getOptimize() {
  const dir = $a("opt-direction").value;
  if (dir === "none") return { direction: "none", type: null, target: null };
  return { direction: dir, type: $a("opt-type").value, target: $a("opt-target").value };
}

function readInventories() {
  const cards = $a("alloy-components").querySelectorAll(".comp-card");
  const inventories = [];
  for (const card of cards) {
    const inv = {};
    card.querySelectorAll("input[type='number']").forEach(inp => {
      inv[inp.dataset.item] = Math.max(0, parseInt(inp.value) || 0);
    });
    inventories.push(inv);
  }
  return inventories;
}

function runAlloyCalc() {
  const ingots = Math.max(1, Math.min(64, parseInt($a("alloy-ingots").value) || 1));
  $a("alloy-ingots").value = ingots;
  const optimize = getOptimize();

  let result;
  if (alloyMode === "alloy") {
    if (calcMode === "perfect") {
      result = solvePerfect(selectedAlloy.components, ingots, optimize);
    } else {
      const inventories = readInventories();
      result = solveAvailable(selectedAlloy.components, ingots, inventories, optimize);
    }
  } else {
    if (calcMode === "perfect") {
      result = solvePerfectPure(ingots, optimize);
    } else {
      const inventories = readInventories();
      result = solveAvailablePure(ingots, inventories[0], optimize);
    }
  }

  if (!result) {
    $a("alloy-results").classList.remove("hidden");
    $a("alloy-score-row").classList.add("hidden");
    $a("alloy-summary").innerHTML = `<span style="color:var(--red)">No valid combination found. ${calcMode === "available" ? "Try adding more materials." : ""}</span>`;
    $a("alloy-breakdown").innerHTML = "";
    return;
  }

  if (calcMode === "perfect") fillComponentInputs(result);
  renderAlloyResult(result);
}

function fillComponentInputs(result) {
  const cards = $a("alloy-components").querySelectorAll(".comp-card");
  for (let i = 0; i < result.allocations.length && i < cards.length; i++) {
    const alloc = result.allocations[i];
    const card = cards[i];
    card.querySelectorAll("input[type='number']").forEach(inp => {
      const match = alloc.items.find(it => it.id === inp.dataset.item);
      inp.value = match ? match.qty : 0;
    });
    updateCompTotal(card);
    card.classList.remove("valid", "invalid");
    const pct = result.totalMb > 0 ? alloc.mb / result.totalMb : 0;
    card.classList.add(pct >= alloc.min - 0.001 && pct <= alloc.max + 0.001 ? "valid" : "invalid");
  }
}

function renderAlloyResult(result) {
  const resultsEl = $a("alloy-results");
  resultsEl.classList.remove("hidden");

  const score = result.score;
  const scoreRow = $a("alloy-score-row");
  scoreRow.classList.remove("hidden");

  const circle = $a("alloy-score-circle");
  circle.className = "alloy-score-circle"
    + (score.total >= 90 ? " score-high" : score.total >= 70 ? " score-mid" : " score-low");
  $a("score-value").textContent = score.total;

  $a("alloy-score-breakdown").innerHTML = `
    <div class="score-sub"><span class="score-sub-label">Validity</span><span class="score-sub-val">${score.validity}/40</span></div>
    <div class="score-sub"><span class="score-sub-label">Efficiency</span><span class="score-sub-val">${score.efficiency}/30</span></div>
    <div class="score-sub"><span class="score-sub-label">Yield</span><span class="score-sub-val">${score.yield}/30</span></div>
  `;

  const targetName = alloyMode === "alloy" ? selectedAlloy.name : selectedPureMetal;
  const wastePct = result.totalMb > 0 ? ((result.waste / result.totalMb) * 100).toFixed(1) : "0.0";

  let summaryHtml = `
    <div class="alloy-stat">
      <span class="alloy-stat-label">Output</span>
      <span class="alloy-stat-value">${result.outputIngots}x ${targetName}</span>
    </div>
    <div class="alloy-stat">
      <span class="alloy-stat-label">Total mB</span>
      <span class="alloy-stat-value">${result.totalMb}</span>
    </div>
    <div class="alloy-stat">
      <span class="alloy-stat-label">Waste</span>
      <span class="alloy-stat-value ${score.isPerfect ? "perfect" : "wasteful"}">${result.waste} mB (${wastePct}%)</span>
    </div>
  `;
  if (score.isPerfect) {
    summaryHtml += `<div class="alloy-stat"><span class="alloy-stat-label">Status</span><span class="badge-perfect">Perfect</span></div>`;
  }
  $a("alloy-summary").innerHTML = summaryHtml;

  let brkHtml = "";
  for (const alloc of result.allocations) {
    const pct = result.totalMb > 0 ? (alloc.mb / result.totalMb) * 100 : 0;
    const inRange = pct / 100 >= alloc.min - 0.001 && pct / 100 <= alloc.max + 0.001;
    const itemStr = alloc.items.map(it => `${it.qty}x ${it.label}`).join(", ");
    const metalLabel = alloc.metal || selectedPureMetal;
    const barWidth = Math.min(100, pct);
    const barColor = inRange ? "var(--green)" : "var(--red)";
    brkHtml += `
      <div class="alloy-brk-row">
        <span class="alloy-brk-metal">${metalLabel}</span>
        <span class="alloy-brk-items">${itemStr} (${alloc.mb} mB)</span>
        <div class="alloy-brk-bar"><div class="alloy-brk-bar-fill" style="width:${barWidth}%;background:${barColor}"></div></div>
        <span class="alloy-brk-pct ${inRange ? "ok" : "bad"}">${pct.toFixed(1)}%</span>
      </div>`;
  }
  $a("alloy-breakdown").innerHTML = brkHtml;
}

document.addEventListener("DOMContentLoaded", initAlloyUI);
