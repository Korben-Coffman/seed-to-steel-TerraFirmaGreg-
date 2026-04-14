"use strict";

// ============================================================
//  ALLOY DATA — from TFC v3.2.19 + TFG KubeJS overrides
// ============================================================

const MB_PER_INGOT = 144;

const MELTABLE_ITEMS = [
  { id: "ingot",        label: "Ingot",        mb: 144, max: 64 },
  { id: "double_ingot", label: "Double Ingot", mb: 288, max: 32 },
  { id: "dust",         label: "Dust",         mb: 144, max: 64 },
  { id: "small_dust",   label: "Small Dust",   mb: 36,  max: 64 },
  { id: "tiny_dust",    label: "Tiny Dust",    mb: 16,  max: 64 },
  { id: "nugget",       label: "Nugget",       mb: 16,  max: 64 },
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
//  ALLOY SOLVER
// ============================================================

const _achievableCache = new Map();

function buildAchievableSet(maxMb) {
  if (_achievableCache.has(maxMb)) return _achievableCache.get(maxMb);
  const dp = new Uint8Array(maxMb + 1);
  dp[0] = 1;
  for (const item of MELTABLE_ITEMS) {
    for (let copies = 0; copies < item.max; copies++) {
      for (let v = maxMb; v >= item.mb; v--) {
        if (dp[v - item.mb]) dp[v] = 1;
      }
    }
  }
  _achievableCache.set(maxMb, dp);
  return dp;
}

function fillWithItems(target) {
  if (target === 0) return [];
  if (target < 0) return null;

  const sorted = [...MELTABLE_ITEMS].sort((a, b) => b.mb - a.mb);
  const result = [];
  let rem = target;

  for (const item of sorted) {
    if (item.mb > rem) continue;
    const qty = Math.min(Math.floor(rem / item.mb), item.max);
    if (qty > 0) {
      result.push({ id: item.id, label: item.label, mb: item.mb, qty });
      rem -= qty * item.mb;
    }
    if (rem === 0) break;
  }
  return rem === 0 ? result : null;
}

function solveAlloy(alloy, desiredIngots) {
  const desiredMb = desiredIngots * MB_PER_INGOT;
  const maxSearch = desiredMb + MB_PER_INGOT * 6;
  const dp = buildAchievableSet(maxSearch);

  let bestResult = null;
  let bestWaste = Infinity;

  for (let totalMb = desiredMb; totalMb <= maxSearch; totalMb++) {
    const outputIngots = Math.floor(totalMb / MB_PER_INGOT);
    if (outputIngots < desiredIngots) continue;
    const waste = totalMb % MB_PER_INGOT;
    if (waste >= bestWaste) continue;

    const allocs = allocateComponents(alloy.components, totalMb, dp);
    if (!allocs) continue;

    bestWaste = waste;
    bestResult = { totalMb, outputIngots, waste, allocations: allocs };
    if (waste === 0) break;
  }

  return bestResult;
}

function allocateComponents(components, totalMb, dp) {
  const ranges = components.map(c => ({
    metal: c.metal, min: c.min, max: c.max,
    loMb: Math.ceil(totalMb * c.min),
    hiMb: Math.floor(totalMb * c.max),
  }));

  const allocs = new Array(components.length);
  return _backtrack(ranges, totalMb, dp, 0, totalMb, allocs) ? allocs : null;
}

function _backtrack(ranges, totalMb, dp, idx, remaining, allocs) {
  if (idx === ranges.length) return remaining === 0;

  const r = ranges[idx];
  const isLast = idx === ranges.length - 1;

  if (isLast) {
    if (remaining < r.loMb || remaining > r.hiMb) return false;
    if (!dp[remaining]) return false;
    const items = fillWithItems(remaining);
    if (!items) return false;
    allocs[idx] = { metal: r.metal, min: r.min, max: r.max, mb: remaining, items };
    return true;
  }

  const midMb = Math.round(totalMb * (r.min + r.max) / 2);
  const lo = Math.max(r.loMb, 0);
  const hi = Math.min(r.hiMb, remaining);
  if (lo > hi) return false;

  const clampedMid = Math.max(lo, Math.min(hi, midMb));
  const candidates = [clampedMid];
  for (let delta = 1; delta <= hi - lo; delta++) {
    if (clampedMid - delta >= lo) candidates.push(clampedMid - delta);
    if (clampedMid + delta <= hi) candidates.push(clampedMid + delta);
  }

  for (const amt of candidates) {
    if (!dp[amt]) continue;
    const items = fillWithItems(amt);
    if (!items) continue;
    allocs[idx] = { metal: r.metal, min: r.min, max: r.max, mb: amt, items };
    if (_backtrack(ranges, totalMb, dp, idx + 1, remaining - amt, allocs)) return true;
  }
  return false;
}

function solvePureMetal(desiredIngots) {
  const target = desiredIngots * MB_PER_INGOT;
  const items = fillWithItems(target);
  if (!items) return null;
  return {
    totalMb: target,
    outputIngots: desiredIngots,
    waste: 0,
    allocations: [{ metal: null, min: 1, max: 1, mb: target, items }],
  };
}

// ============================================================
//  ALLOY UI CONTROLLER
// ============================================================
let alloyMode = "alloy";
let selectedAlloy = ALLOYS[0];
let selectedPureMetal = ALL_METALS[0];

function $a(id) { return document.getElementById(id); }

function initAlloyUI() {
  populateAlloyTargets();
  renderAlloyComponents();

  const modeToggle = $a("alloy-mode-toggle");
  modeToggle.querySelectorAll(".mode-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      alloyMode = btn.dataset.mode;
      modeToggle.querySelectorAll(".mode-btn").forEach(b => b.classList.toggle("active", b === btn));
      populateAlloyTargets();
      renderAlloyComponents();
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
    $a("alloy-results").classList.add("hidden");
  });

  $a("alloy-calc-btn").addEventListener("click", runAlloyCalc);
  $a("alloy-ingots").addEventListener("keydown", e => { if (e.key === "Enter") runAlloyCalc(); });
}

function populateAlloyTargets() {
  const sel = $a("alloy-target");
  sel.innerHTML = "";
  if (alloyMode === "alloy") {
    for (const a of ALLOYS) {
      const o = document.createElement("option");
      o.value = a.id;
      o.textContent = a.name;
      if (a.id === selectedAlloy.id) o.selected = true;
      sel.appendChild(o);
    }
  } else {
    for (const m of ALL_METALS) {
      const o = document.createElement("option");
      o.value = m;
      o.textContent = m;
      if (m === selectedPureMetal) o.selected = true;
      sel.appendChild(o);
    }
  }
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

  const header = document.createElement("div");
  header.className = "comp-header";

  const name = document.createElement("span");
  name.className = "comp-name";
  name.textContent = metalName;

  const range = document.createElement("span");
  range.className = "comp-range";
  if (isPure) {
    range.textContent = "100%";
  } else {
    range.innerHTML = `<span class="pct-val">${(minPct * 100).toFixed(0)}%</span> – <span class="pct-val">${(maxPct * 100).toFixed(0)}%</span>`;
  }

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
      <input type="number" min="0" max="${item.max}" value="0" data-metal="${metalName}" data-item="${item.id}" data-mb="${item.mb}">
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
  const totalLine = card.querySelector(".comp-mb-total");
  totalLine.innerHTML = `<span class="mb-num">${total}</span> mB`;
}

function runAlloyCalc() {
  const ingots = Math.max(1, Math.min(64, parseInt($a("alloy-ingots").value) || 1));
  $a("alloy-ingots").value = ingots;

  let result;
  if (alloyMode === "alloy") {
    result = solveAlloy(selectedAlloy, ingots);
  } else {
    result = solvePureMetal(ingots);
  }

  if (!result) {
    $a("alloy-results").classList.remove("hidden");
    $a("alloy-summary").innerHTML = `<span style="color:var(--red)">No valid combination found.</span>`;
    $a("alloy-breakdown").innerHTML = "";
    return;
  }

  fillComponentInputs(result);
  renderAlloyResult(result);
}

function fillComponentInputs(result) {
  const cards = $a("alloy-components").querySelectorAll(".comp-card");
  for (let i = 0; i < result.allocations.length && i < cards.length; i++) {
    const alloc = result.allocations[i];
    const card = cards[i];
    card.querySelectorAll("input[type='number']").forEach(inp => {
      const itemId = inp.dataset.item;
      const match = alloc.items.find(it => it.id === itemId);
      inp.value = match ? match.qty : 0;
    });
    updateCompTotal(card);

    card.classList.remove("valid", "invalid");
    const pct = result.totalMb > 0 ? alloc.mb / result.totalMb : 0;
    if (pct >= alloc.min && pct <= alloc.max) {
      card.classList.add("valid");
    } else {
      card.classList.add("invalid");
    }
  }
}

function renderAlloyResult(result) {
  const resultsEl = $a("alloy-results");
  resultsEl.classList.remove("hidden");

  const isPerfect = result.waste === 0;
  const wastePct = result.totalMb > 0 ? ((result.waste / result.totalMb) * 100).toFixed(1) : "0.0";
  const targetName = alloyMode === "alloy" ? selectedAlloy.name : selectedPureMetal;

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
      <span class="alloy-stat-value ${isPerfect ? "perfect" : "wasteful"}">${result.waste} mB (${wastePct}%)</span>
    </div>
  `;
  if (isPerfect) {
    summaryHtml += `
    <div class="alloy-stat">
      <span class="alloy-stat-label">Status</span>
      <span class="badge-perfect">Perfect</span>
    </div>`;
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

// ---- Init on DOM ready ----
document.addEventListener("DOMContentLoaded", initAlloyUI);
