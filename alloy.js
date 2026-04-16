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
//  ORE DATA — ore minerals that smelt into alloy metals
// ============================================================

function calcAmountOfMetal(base, pct) {
  const value = base * pct / 100;
  return value % 2 === 0 ? value : Math.round(value) - 1;
}

function calcAmountOfMetalProcessed(base, pct) {
  const ppItem = pct / Math.ceil(pct / 100);
  const value = base * (ppItem / 100);
  return value % 2 === 0 ? value : Math.round(value) - 1;
}

const ORE_ITEM_TYPES = [
  { id: "small_ore",   label: "Small Ore",   baseMb: 16,  fn: "flat" },
  { id: "poor_raw",    label: "Poor Raw",    baseMb: 24,  fn: "metal" },
  { id: "normal_raw",  label: "Normal Raw",  baseMb: 36,  fn: "metal" },
  { id: "rich_raw",    label: "Rich Raw",    baseMb: 48,  fn: "metal" },
  { id: "crushed",     label: "Crushed",     baseMb: 80,  fn: "processed" },
  { id: "washed",      label: "Washed",      baseMb: 100, fn: "processed" },
  { id: "centrifuged", label: "Centrifuged", baseMb: 110, fn: "processed" },
  { id: "ore_dust",    label: "Dust",        baseMb: 144, fn: "processed" },
];

const ORE_SOURCES = {
  "Copper": [
    { id: "malachite",    name: "Malachite",      pct: 90,  smallOre: true },
    { id: "tetrahedrite", name: "Tetrahedrite",    pct: 90,  smallOre: true },
    { id: "chalcopyrite", name: "Chalcopyrite",    pct: 85,  smallOre: false },
    { id: "chalcocite",   name: "Chalcocite",      pct: 95,  smallOre: false },
    { id: "bornite",      name: "Bornite",         pct: 90,  smallOre: false },
  ],
  "Tin": [
    { id: "cassiterite",      name: "Cassiterite",      pct: 100, smallOre: true },
    { id: "cassiterite_sand", name: "Cassiterite Sand", pct: 85,  smallOre: false },
  ],
  "Zinc": [
    { id: "sphalerite", name: "Sphalerite", pct: 90, smallOre: true },
  ],
  "Nickel": [
    { id: "garnierite",  name: "Garnierite",  pct: 100, smallOre: true },
    { id: "pentlandite", name: "Pentlandite", pct: 85,  smallOre: false },
  ],
  "Lead": [
    { id: "galena", name: "Galena", pct: 85, smallOre: false },
  ],
  "Cobalt": [
    { id: "cobaltite", name: "Cobaltite", pct: 85, smallOre: false },
  ],
  "Aluminium Silicate": [
    { id: "kyanite",   name: "Kyanite",   pct: 95, smallOre: false },
    { id: "mica",      name: "Mica",      pct: 90, smallOre: false },
    { id: "spodumene", name: "Spodumene", pct: 85, smallOre: false },
    { id: "pollucite", name: "Pollucite", pct: 85, smallOre: false },
  ],
};

function getOreItemMb(tmpl, pct) {
  if (tmpl.fn === "flat") return tmpl.baseMb;
  if (tmpl.fn === "metal") return calcAmountOfMetal(tmpl.baseMb, pct);
  return calcAmountOfMetalProcessed(tmpl.baseMb, pct);
}

function getItemsForMetal(metalName) {
  const items = MELTABLE_ITEMS.map(it => ({ ...it }));
  const ores = ORE_SOURCES[metalName];
  if (ores) {
    for (const ore of ores) {
      for (const tmpl of ORE_ITEM_TYPES) {
        if (tmpl.id === "small_ore" && !ore.smallOre) continue;
        const mb = getOreItemMb(tmpl, ore.pct);
        if (mb <= 0) continue;
        items.push({
          id: `${ore.id}__${tmpl.id}`,
          label: `${ore.name} ${tmpl.label}`,
          mb,
          max: 64,
          oreId: ore.id,
        });
      }
    }
  }
  return items;
}

// ============================================================
//  BLOOMERY DATA
// ============================================================

const IRON_ORES = [
  { name: "Hematite",  pct: 90 },
  { name: "Limonite",  pct: 90 },
  { name: "Magnetite", pct: 90 },
  { name: "Pyrite",    pct: 90 },
  { name: "Goethite",  pct: 90 },
];

const BLOOMERY_ITEM_TYPES = [
  { id: "ore_dust",    label: "Dust",        baseMb: 144, fn: "processed" },
  { id: "centrifuged", label: "Centrifuged", baseMb: 110, fn: "processed" },
  { id: "washed",      label: "Washed",      baseMb: 100, fn: "processed" },
  { id: "crushed",     label: "Crushed",     baseMb: 80,  fn: "processed" },
  { id: "rich_raw",    label: "Rich Raw",    baseMb: 48,  fn: "metal" },
  { id: "small_dust",  label: "Small Dust",  baseMb: 36,  fn: "processed" },
  { id: "normal_raw",  label: "Normal Raw",  baseMb: 36,  fn: "metal" },
  { id: "poor_raw",    label: "Poor Raw",    baseMb: 24,  fn: "metal" },
  { id: "small_ore",   label: "Small Ore",   baseMb: 16,  fn: "flat" },
  { id: "tiny_dust",   label: "Tiny Dust",   baseMb: 16,  fn: "processed" },
];

const BLOOMERY_CAPACITY_PER_LAYER = 16;
const BLOOMERY_MAX_LAYERS = 3;
const BLOOMERY_MB_PER_BLOOM = 144;

const BLOOMERY_ITEMS_RESOLVED = BLOOMERY_ITEM_TYPES.map(t => ({
  ...t, mb: getOreItemMb(t, 90),
}));

function optimizeBloomery(capacity, mbPerItem) {
  let best = null;
  for (let ore = 1; ore < capacity; ore++) {
    const coal = capacity - ore;
    const mB = ore * mbPerItem;
    const fromMb = Math.floor(mB / BLOOMERY_MB_PER_BLOOM);
    const blooms = Math.min(coal, fromMb);
    if (!best || blooms > best.blooms || (blooms === best.blooms && ore < best.oreCount)) {
      const used = blooms * BLOOMERY_MB_PER_BLOOM;
      best = { blooms, charcoal: blooms, oreCount: ore, totalMb: mB, mbUsed: used, waste: mB - used };
    }
  }
  return best;
}

function solveBloomeryCustom(capacity, items) {
  let totalMb = 0, totalOre = 0;
  for (const it of items) {
    totalMb += it.mb * it.qty;
    totalOre += it.qty;
  }
  const charcoalSlots = capacity - totalOre;
  if (charcoalSlots < 1 || totalOre < 1) return null;
  const fromMb = Math.floor(totalMb / BLOOMERY_MB_PER_BLOOM);
  const blooms = Math.min(charcoalSlots, fromMb);
  const used = blooms * BLOOMERY_MB_PER_BLOOM;
  return { blooms, charcoal: blooms, oreCount: totalOre, totalMb, mbUsed: used, waste: totalMb - used, slotsUsed: totalOre + blooms, capacity };
}

// ============================================================
//  SOLVER ENGINE
// ============================================================

function buildDP(maxMb, limits, items) {
  items = items || MELTABLE_ITEMS;
  const dp = new Uint8Array(maxMb + 1);
  dp[0] = 1;
  for (const item of items) {
    const maxQty = limits ? (limits[item.id] || 0) : item.max;
    for (let c = 0; c < maxQty; c++) {
      for (let v = maxMb; v >= item.mb; v--) {
        if (dp[v - item.mb]) dp[v] = 1;
      }
    }
  }
  return dp;
}

function getItemOrder(items, optimize) {
  const sorted = [...items];
  if (!optimize || optimize.direction === "none" || optimize.type !== "item") {
    return sorted.sort((a, b) => b.mb - a.mb);
  }
  const tid = optimize.target;
  if (optimize.direction === "maximize") {
    return sorted.sort((a, b) => {
      if (a.id === tid && b.id !== tid) return -1;
      if (b.id === tid && a.id !== tid) return 1;
      return b.mb - a.mb;
    });
  }
  return sorted.sort((a, b) => {
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
    const key = r * available.length + idx;
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

function allocate(components, totalMb, dps, itemOrders, optimize, limitsArr) {
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
    const order = Array.isArray(itemOrders[0]) ? itemOrders[i] : itemOrders;
    const items = fillWithItems(amounts[i], order, lim);
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
  const compItems = components.map(c => getItemsForMetal(c.metal));
  const dps = compItems.map(items => buildDP(maxSearch, null, items));
  const itemOrders = compItems.map(items => getItemOrder(items, optimize));

  let bestResult = null;
  let bestWaste = Infinity;

  for (let totalMb = desiredMb; totalMb <= maxSearch; totalMb++) {
    const outputIngots = Math.floor(totalMb / MB_PER_INGOT);
    if (outputIngots < desiredIngots) continue;
    const waste = totalMb % MB_PER_INGOT;
    if (waste >= bestWaste) continue;

    const allocs = allocate(components, totalMb, dps, itemOrders, optimize, null);
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
  const items = getItemsForMetal(selectedPureMetal);
  const itemOrder = getItemOrder(items, optimize);
  const filled = fillWithItems(target, itemOrder, null);
  if (!filled) return null;
  const result = { totalMb: target, outputIngots: desiredIngots, waste: 0,
    allocations: [{ metal: null, min: 1, max: 1, mb: target, items: filled }] };
  result.score = scoreResultPure(result, desiredIngots);
  return result;
}

// ============================================================
//  SOLVER: USE AVAILABLE
// ============================================================

function solveAvailable(components, desiredIngots, inventories, optimize) {
  const compItems = components.map(c => getItemsForMetal(c.metal));
  const itemOrders = compItems.map(items => getItemOrder(items, optimize));

  const compMax = inventories.map((inv, i) =>
    Object.entries(inv).reduce((s, [id, qty]) => {
      const it = compItems[i].find(m => m.id === id);
      return s + (it ? it.mb * qty : 0);
    }, 0)
  );
  const maxTotal = compMax.reduce((a, b) => a + b, 0);
  if (maxTotal < 16) return null;

  const dps = inventories.map((inv, i) => buildDP(compMax[i], inv, compItems[i]));
  const goalMb = Math.min(desiredIngots * MB_PER_INGOT, maxTotal);
  const searchRadius = MB_PER_INGOT * 6;

  let bestResult = null;
  let bestScore = -1;

  for (let delta = 0; delta <= searchRadius; delta++) {
    const trials = delta === 0 ? [goalMb] : [goalMb + delta, goalMb - delta];
    for (const t of trials) {
      if (t < 16 || t > maxTotal) continue;

      const allocs = allocate(components, t, dps, itemOrders, optimize, inventories);
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
  const items = getItemsForMetal(selectedPureMetal);
  const itemOrder = getItemOrder(items, optimize);
  const maxMb = Object.entries(inventory).reduce((s, [id, qty]) => {
    const it = items.find(m => m.id === id);
    return s + (it ? it.mb * qty : 0);
  }, 0);
  if (maxMb < 16) return null;

  const dp = buildDP(maxMb, inventory, items);
  const goalMb = Math.min(desiredIngots * MB_PER_INGOT, maxMb);

  let bestResult = null;
  let bestScore = -1;

  for (let delta = 0; delta <= MB_PER_INGOT * 4; delta++) {
    const trials = delta === 0 ? [goalMb] : [goalMb + delta, goalMb - delta];
    for (const t of trials) {
      if (t < 16 || t > maxMb || !dp[t]) continue;
      const filled = fillWithItems(t, itemOrder, inventory);
      if (!filled) continue;

      const waste = t % MB_PER_INGOT;
      const result = { totalMb: t, outputIngots: Math.floor(t / MB_PER_INGOT), waste,
        allocations: [{ metal: null, min: 1, max: 1, mb: t, items: filled }] };
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
      const isBloomery = alloyMode === "bloomery";
      $a("alloy-calc-toggle").classList.toggle("hidden", isBloomery);
      $a("alloy-target-row").classList.toggle("hidden", isBloomery);
      $a("alloy-optimize-row").classList.toggle("hidden", isBloomery);
      $a("alloy-results").classList.add("hidden");
      if (isBloomery) {
        renderBloomeryUI();
      } else {
        populateAlloyTargets();
        renderAlloyComponents();
        populateOptTargets();
        updateCompHeader();
      }
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

// ============================================================
//  BLOOMERY UI
// ============================================================

let bloomeryLayers = 3;
let bloomeryCalcMode = "optimal";

function renderBloomeryUI() {
  const container = $a("alloy-components");
  container.innerHTML = "";
  $a("alloy-comp-header").textContent = "Raw Iron Bloom Calculator";
  $a("alloy-results").classList.add("hidden");

  const panel = document.createElement("div");
  panel.className = "bloomery-panel";

  // --- Size selector ---
  const sizeRow = document.createElement("div");
  sizeRow.className = "bloomery-row";
  sizeRow.innerHTML = `<span class="bloomery-label">Bloomery Size</span>`;
  const sizeToggle = document.createElement("div");
  sizeToggle.className = "bloomery-size-toggle";
  for (let l = 1; l <= BLOOMERY_MAX_LAYERS; l++) {
    const cap = l * BLOOMERY_CAPACITY_PER_LAYER;
    const btn = document.createElement("button");
    btn.className = "mode-btn" + (l === bloomeryLayers ? " active" : "");
    btn.textContent = `${l} Layer${l > 1 ? "s" : ""} (${cap})`;
    btn.addEventListener("click", () => {
      bloomeryLayers = l;
      sizeToggle.querySelectorAll(".mode-btn").forEach(b => b.classList.toggle("active", b === btn));
      updateBloomeryResults();
    });
    sizeToggle.appendChild(btn);
  }
  sizeRow.appendChild(sizeToggle);
  panel.appendChild(sizeRow);

  // --- Mode toggle ---
  const modeRow = document.createElement("div");
  modeRow.className = "bloomery-row";
  modeRow.innerHTML = `<span class="bloomery-label">Mode</span>`;
  const modeToggle = document.createElement("div");
  modeToggle.className = "bloomery-size-toggle";
  for (const [val, label] of [["optimal", "Optimal Fill"], ["custom", "Use Available"]]) {
    const btn = document.createElement("button");
    btn.className = "mode-btn" + (val === bloomeryCalcMode ? " active" : "");
    btn.textContent = label;
    btn.addEventListener("click", () => {
      bloomeryCalcMode = val;
      modeToggle.querySelectorAll(".mode-btn").forEach(b => b.classList.toggle("active", b === btn));
      renderBloomeryBody(panel);
    });
    modeToggle.appendChild(btn);
  }
  modeRow.appendChild(modeToggle);
  panel.appendChild(modeRow);

  container.appendChild(panel);
  renderBloomeryBody(panel);
}

function renderBloomeryBody(panel) {
  let body = panel.querySelector(".bloomery-body");
  if (body) body.remove();
  body = document.createElement("div");
  body.className = "bloomery-body";

  if (bloomeryCalcMode === "optimal") {
    renderBloomeryOptimal(body);
  } else {
    renderBloomeryCustom(body);
  }
  panel.appendChild(body);
}

function renderBloomeryOptimal(body) {
  // Reference table header
  const info = document.createElement("div");
  info.className = "bloomery-info";
  info.innerHTML = `All standard iron ores (${IRON_ORES.map(o => o.name).join(", ")}) yield <strong>90%</strong> iron.
    <br>Each <strong>Raw Iron Bloom</strong> requires <strong>144 mB</strong> of iron + <strong>1 Charcoal</strong>.`;
  body.appendChild(info);

  const capacity = bloomeryLayers * BLOOMERY_CAPACITY_PER_LAYER;

  // Table
  const table = document.createElement("table");
  table.className = "bloomery-table";
  table.innerHTML = `<thead><tr>
    <th>Item Type</th><th>mB / item</th><th>Ore Items</th><th>Charcoal</th><th>Blooms</th><th>Waste</th>
  </tr></thead>`;
  const tbody = document.createElement("tbody");

  let bestBlooms = 0;
  const rows = [];
  for (const item of BLOOMERY_ITEMS_RESOLVED) {
    const r = optimizeBloomery(capacity, item.mb);
    if (r && r.blooms > bestBlooms) bestBlooms = r.blooms;
    rows.push({ item, r });
  }

  for (const { item, r } of rows) {
    if (!r) continue;
    const tr = document.createElement("tr");
    if (r.blooms === bestBlooms) tr.className = "bloomery-best";
    const wastePct = r.totalMb > 0 ? ((r.waste / r.totalMb) * 100).toFixed(1) : "0.0";
    tr.innerHTML = `
      <td class="bl-item-name">${item.label}</td>
      <td class="bl-num">${item.mb}</td>
      <td class="bl-num">${r.oreCount}</td>
      <td class="bl-num">${r.charcoal}</td>
      <td class="bl-num bl-blooms">${r.blooms}</td>
      <td class="bl-waste">${r.waste} mB (${wastePct}%)</td>`;
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  body.appendChild(table);

  const bestItem = rows.find(r => r.r && r.r.blooms === bestBlooms);
  if (bestItem) {
    const r = bestItem.r;
    const summary = document.createElement("div");
    summary.className = "bloomery-summary";
    summary.innerHTML = `<strong>${bestItem.item.label}</strong> is optimal at <strong>${capacity}</strong> capacity &rarr;
      <span class="bl-highlight">${r.blooms} Raw Iron Blooms</span>
      (${r.oreCount} ore + ${r.charcoal} charcoal = ${r.oreCount + r.charcoal} items, ${r.waste} mB waste)`;
    body.appendChild(summary);
  }
}

function renderBloomeryCustom(body) {
  const info = document.createElement("div");
  info.className = "bloomery-info";
  info.innerHTML = `Enter the quantities of each iron ore item type you have available.
    <br>All standard iron ores at <strong>90%</strong> purity share the same mB values.`;
  body.appendChild(info);

  const grid = document.createElement("div");
  grid.className = "bloomery-custom-grid";

  for (const item of BLOOMERY_ITEMS_RESOLVED) {
    const row = document.createElement("div");
    row.className = "comp-item";
    row.innerHTML = `
      <span class="comp-item-label">${item.label}</span>
      <span class="comp-item-mb">${item.mb}mb</span>
      <input type="number" min="0" max="999" value="0"
             class="bloomery-input" data-id="${item.id}" data-mb="${item.mb}">
    `;
    grid.appendChild(row);
  }
  body.appendChild(grid);

  const btnRow = document.createElement("div");
  btnRow.className = "bloomery-btn-row";
  const btn = document.createElement("button");
  btn.className = "btn btn-primary";
  btn.textContent = "Calculate";
  btn.addEventListener("click", () => runBloomeryCustomCalc(body));
  btnRow.appendChild(btn);
  body.appendChild(btnRow);
}

function runBloomeryCustomCalc(body) {
  const capacity = bloomeryLayers * BLOOMERY_CAPACITY_PER_LAYER;
  const items = [];
  body.querySelectorAll(".bloomery-input").forEach(inp => {
    const qty = parseInt(inp.value, 10) || 0;
    if (qty > 0) items.push({ id: inp.dataset.id, mb: parseInt(inp.dataset.mb, 10), qty });
  });

  let resultEl = body.querySelector(".bloomery-custom-result");
  if (!resultEl) {
    resultEl = document.createElement("div");
    resultEl.className = "bloomery-custom-result";
    body.appendChild(resultEl);
  }

  if (items.length === 0) {
    resultEl.innerHTML = `<span class="bl-warn">Enter at least one ore item.</span>`;
    return;
  }

  const totalOre = items.reduce((s, i) => s + i.qty, 0);
  if (totalOre >= capacity) {
    resultEl.innerHTML = `<span class="bl-warn">Too many ore items (${totalOre}) for capacity (${capacity}). Leave room for charcoal.</span>`;
    return;
  }

  const r = solveBloomeryCustom(capacity, items);
  if (!r || r.blooms === 0) {
    resultEl.innerHTML = `<span class="bl-warn">Not enough iron mB for a single bloom (need 144 mB).</span>`;
    return;
  }

  const wastePct = r.totalMb > 0 ? ((r.waste / r.totalMb) * 100).toFixed(1) : "0.0";
  const unusedSlots = capacity - r.slotsUsed;
  resultEl.innerHTML = `
    <div class="bloomery-result-card">
      <div class="bl-result-row"><span>Raw Iron Blooms</span><strong class="bl-highlight">${r.blooms}</strong></div>
      <div class="bl-result-row"><span>Charcoal Needed</span><strong>${r.charcoal}</strong></div>
      <div class="bl-result-row"><span>Ore Items Used</span><strong>${r.oreCount}</strong></div>
      <div class="bl-result-row"><span>Total Iron mB</span><strong>${r.totalMb}</strong></div>
      <div class="bl-result-row"><span>Iron mB Used</span><strong>${r.mbUsed}</strong></div>
      <div class="bl-result-row"><span>Waste</span><strong>${r.waste} mB (${wastePct}%)</strong></div>
      <div class="bl-result-row"><span>Slots Used</span><strong>${r.slotsUsed} / ${capacity}</strong></div>
      ${unusedSlots > 0 ? `<div class="bl-result-row bl-note"><span>Unused Slots</span><strong>${unusedSlots}</strong></div>` : ""}
    </div>
  `;
}

function updateBloomeryResults() {
  if (bloomeryCalcMode === "optimal") {
    const panel = $a("alloy-components").querySelector(".bloomery-panel");
    if (panel) renderBloomeryBody(panel);
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

  const itemsGrid = document.createElement("div");
  itemsGrid.className = "comp-items";
  for (const item of MELTABLE_ITEMS) {
    itemsGrid.appendChild(buildItemInput(metalName, item.id, item.label, item.mb, item.max));
  }
  card.appendChild(itemsGrid);

  const ores = ORE_SOURCES[metalName];
  if (ores && ores.length > 0) {
    const toggle = document.createElement("button");
    toggle.className = "ore-toggle";
    toggle.textContent = `Ore Sources (${ores.length})`;
    toggle.type = "button";
    const oreContainer = document.createElement("div");
    oreContainer.className = "ore-sections hidden";

    toggle.addEventListener("click", () => {
      oreContainer.classList.toggle("hidden");
      toggle.classList.toggle("open");
    });
    card.appendChild(toggle);

    for (const ore of ores) {
      const sec = document.createElement("div");
      sec.className = "ore-section";
      sec.innerHTML = `<div class="ore-section-header"><span class="ore-section-name">${ore.name}</span><span class="ore-section-pct">${ore.pct}%</span></div>`;
      const oreGrid = document.createElement("div");
      oreGrid.className = "comp-items";
      for (const tmpl of ORE_ITEM_TYPES) {
        if (tmpl.id === "small_ore" && !ore.smallOre) continue;
        const mb = getOreItemMb(tmpl, ore.pct);
        if (mb <= 0) continue;
        const itemId = `${ore.id}__${tmpl.id}`;
        oreGrid.appendChild(buildItemInput(metalName, itemId, tmpl.label, mb, 64));
      }
      sec.appendChild(oreGrid);
      oreContainer.appendChild(sec);
    }
    card.appendChild(oreContainer);
  }

  const totalLine = document.createElement("div");
  totalLine.className = "comp-mb-total";
  totalLine.innerHTML = `<span class="mb-num">0</span> mB`;
  card.appendChild(totalLine);

  card.querySelectorAll("input[type='number']").forEach(inp => {
    inp.addEventListener("input", () => updateCompTotal(card));
  });
  return card;
}

function buildItemInput(metalName, itemId, label, mb, max) {
  const el = document.createElement("div");
  el.className = "comp-item";
  el.innerHTML = `
    <span class="comp-item-label">${label}</span>
    <span class="comp-item-mb">${mb}mb</span>
    <input type="number" min="0" max="${max}" value="0"
           data-metal="${metalName}" data-item="${itemId}" data-mb="${mb}">
  `;
  return el;
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
    let hasOreValues = false;
    card.querySelectorAll("input[type='number']").forEach(inp => {
      const match = alloc.items.find(it => it.id === inp.dataset.item);
      inp.value = match ? match.qty : 0;
      if (match && match.qty > 0 && inp.dataset.item.includes("__")) hasOreValues = true;
    });
    if (hasOreValues) {
      const oreSec = card.querySelector(".ore-sections");
      const toggle = card.querySelector(".ore-toggle");
      if (oreSec) oreSec.classList.remove("hidden");
      if (toggle) toggle.classList.add("open");
    }
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
