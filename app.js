"use strict";

// ============================================================
//  MD5 HASH (pure JS, returns Uint8Array(16))
// ============================================================
const md5 = (() => {
  const S = [
    7,12,17,22,7,12,17,22,7,12,17,22,7,12,17,22,
    5,9,14,20,5,9,14,20,5,9,14,20,5,9,14,20,
    4,11,16,23,4,11,16,23,4,11,16,23,4,11,16,23,
    6,10,15,21,6,10,15,21,6,10,15,21,6,10,15,21
  ];
  const K = new Uint32Array(64);
  for (let i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000);

  return function md5(str) {
    const bytes = new TextEncoder().encode(str);
    const bitLen = bytes.length * 8;
    const padLen = bytes.length + 1 + ((55 - bytes.length % 64 + 64) % 64) + 8;
    const buf = new ArrayBuffer(padLen);
    const padded = new Uint8Array(buf);
    const view = new DataView(buf);
    padded.set(bytes);
    padded[bytes.length] = 0x80;
    view.setUint32(padLen - 8, bitLen >>> 0, true);
    view.setUint32(padLen - 4, (bitLen / 0x100000000) >>> 0, true);

    let a0 = 0x67452301, b0 = 0xEFCDAB89, c0 = 0x98BADCFE, d0 = 0x10325476;
    for (let off = 0; off < padLen; off += 64) {
      const M = new Uint32Array(16);
      for (let j = 0; j < 16; j++) M[j] = view.getUint32(off + j * 4, true);
      let A = a0, B = b0, C = c0, D = d0;
      for (let i = 0; i < 64; i++) {
        let F, g;
        if (i < 16)      { F = (B & C) | (~B & D);       g = i; }
        else if (i < 32) { F = (D & B) | (~D & C);       g = (5*i+1) % 16; }
        else if (i < 48) { F = B ^ C ^ D;                g = (3*i+5) % 16; }
        else              { F = C ^ (B | ~D);             g = (7*i) % 16; }
        F = (F + A + K[i] + M[g]) | 0;
        A = D; D = C; C = B;
        B = (B + ((F << S[i]) | (F >>> (32 - S[i])))) | 0;
      }
      a0 = (a0 + A) | 0; b0 = (b0 + B) | 0;
      c0 = (c0 + C) | 0; d0 = (d0 + D) | 0;
    }
    const r = new Uint8Array(16);
    const rv = new DataView(r.buffer);
    rv.setUint32(0, a0, true); rv.setUint32(4, b0, true);
    rv.setUint32(8, c0, true); rv.setUint32(12, d0, true);
    return r;
  };
})();

// ============================================================
//  XOROSHIRO128++ (BigInt, matching Minecraft 1.20.1)
// ============================================================
const M64 = (1n << 64n) - 1n;
const M32 = 0xFFFFFFFFn;

function rotl64(x, k) { return ((x << BigInt(k)) | (x >> BigInt(64 - k))) & M64; }

function staffordMix13(v) {
  v = ((v ^ (v >> 30n)) * 0xBF58476D1CE4E5B9n) & M64;
  v = ((v ^ (v >> 27n)) * 0x94D049BB133111EBn) & M64;
  return (v ^ (v >> 31n)) & M64;
}

function upgradeSeedTo128bit(seed) {
  const l = (seed ^ 0x6A09E667F3BCC909n) & M64;
  const m = (l + 0x9E3779B97F4A7C15n) & M64;
  return [staffordMix13(l), staffordMix13(m)];
}

class Xoroshiro128PlusPlus {
  constructor(lo, hi) {
    this.s0 = lo & M64;
    this.s1 = hi & M64;
    if (this.s0 === 0n && this.s1 === 0n) {
      this.s0 = 0x9E3779B97F4A7C15n;
      this.s1 = 0x6A09E667F3BCC909n;
    }
  }
  nextLong() {
    const s0 = this.s0;
    let s1 = this.s1;
    const result = (rotl64((s0 + s1) & M64, 17) + s0) & M64;
    s1 ^= s0;
    this.s0 = (rotl64(s0, 49) ^ s1 ^ ((s1 << 21n) & M64)) & M64;
    this.s1 = rotl64(s1, 28);
    return result;
  }
  nextInt() { return this.nextLong() & M32; }
  nextIntBounded(bound) {
    const b = BigInt(bound);
    let r = this.nextInt(), p = r * b, low = p & M32;
    if (low < b) {
      const thr = ((0x100000000n - b) % b);
      while (low < thr) { r = this.nextInt(); p = r * b; low = p & M32; }
    }
    return Number(p >> 32n);
  }
}

function bytesToBigInt(bytes) {
  let r = 0n;
  for (let i = 0; i < bytes.length; i++) r = (r << 8n) | BigInt(bytes[i]);
  return r;
}

// ============================================================
//  TARGET CALCULATOR
// ============================================================
function parseSeed(input) {
  const trimmed = input.trim();
  if (/^-?\d+$/.test(trimmed)) return BigInt(trimmed) & M64;
  let h = 0;
  for (let i = 0; i < trimmed.length; i++) h = (Math.imul(31, h) + trimmed.charCodeAt(i)) | 0;
  return BigInt(h) & M64;
}

function computeTarget(seedBigInt, recipeId) {
  const [s0, s1] = upgradeSeedTo128bit(seedBigInt);
  const rng = new Xoroshiro128PlusPlus(s0, s1);
  const posLo = rng.nextLong();
  const posHi = rng.nextLong();
  const hash = md5(recipeId);
  const hLo = bytesToBigInt(hash.slice(0, 8));
  const hHi = bytesToBigInt(hash.slice(8, 16));
  const final_ = new Xoroshiro128PlusPlus((hLo ^ posLo) & M64, (hHi ^ posHi) & M64);
  return 40 + final_.nextIntBounded(74);
}

// ============================================================
//  FORGE SOLVER (BFS on full state space)
// ============================================================
const STEPS = [
  { id: "hit_light",  name: "Light Hit",  value: -3,  idx: 0, type: "hit" },
  { id: "hit_medium", name: "Medium Hit", value: -6,  idx: 1, type: "hit" },
  { id: "hit_hard",   name: "Heavy Hit",  value: -9,  idx: 2, type: "hit" },
  { id: "draw",       name: "Draw",       value: -15, idx: 3, type: "draw" },
  { id: "punch",      name: "Punch",      value: 2,   idx: 4, type: "punch" },
  { id: "bend",       name: "Bend",       value: 7,   idx: 5, type: "bend" },
  { id: "upset",      name: "Upset",      value: 13,  idx: 6, type: "upset" },
  { id: "shrink",     name: "Shrink",     value: 16,  idx: 7, type: "shrink" },
];
const NONE = 8;
const LIMIT = 150;
const SS = 9; // state size per dimension (8 steps + none)

function parseRule(ruleStr) {
  const s = ruleStr.toLowerCase();
  const parts = s.split("_");
  const type = parts[0];
  const order = parts.slice(1).join("_");
  return { type, order };
}

function matchesType(ruleType, stepIdx) {
  if (stepIdx === NONE) return false;
  if (ruleType === "hit") return stepIdx <= 2;
  const map = { draw: 3, punch: 4, bend: 5, upset: 6, shrink: 7 };
  return stepIdx === map[ruleType];
}

function rulesMatch(last, sLast, tLast, rules) {
  for (const r of rules) {
    const { type, order } = parseRule(r);
    let ok = false;
    switch (order) {
      case "last":        ok = matchesType(type, last); break;
      case "second_last": ok = matchesType(type, sLast); break;
      case "third_last":  ok = matchesType(type, tLast); break;
      case "not_last":    ok = matchesType(type, sLast) || matchesType(type, tLast); break;
      case "any":         ok = matchesType(type, last) || matchesType(type, sLast) || matchesType(type, tLast); break;
    }
    if (!ok) return false;
  }
  return true;
}

function solve(target, rules) {
  if (target < 0 || target >= LIMIT) return null;

  const encode = (w, l, s, t) => ((w * SS + l) * SS + s) * SS + t;
  const total = LIMIT * SS * SS * SS;
  const visited = new Uint8Array(total);
  const parent  = new Int32Array(total).fill(-1);
  const pAction = new Int8Array(total).fill(-1);

  const start = encode(0, NONE, NONE, NONE);
  visited[start] = 1;
  const queue = [start];
  let head = 0;

  while (head < queue.length) {
    const si = queue[head++];
    const t3 = si % SS;
    const s2 = ((si / SS) | 0) % SS;
    const l1 = ((si / (SS * SS)) | 0) % SS;
    const w  = (si / (SS * SS * SS)) | 0;

    if (w === target && rulesMatch(l1, s2, t3, rules)) {
      const path = [];
      let cur = si;
      while (pAction[cur] !== -1) {
        path.push(STEPS[pAction[cur]]);
        cur = parent[cur];
      }
      path.reverse();
      return path;
    }

    for (const step of STEPS) {
      const nw = w + step.value;
      if (nw < 0 || nw >= LIMIT) continue;
      const ni = encode(nw, step.idx, l1, s2);
      if (visited[ni]) continue;
      visited[ni] = 1;
      parent[ni] = si;
      pAction[ni] = step.idx;
      queue.push(ni);
    }
  }
  return null;
}

// ============================================================
//  RECIPE DATABASE
// ============================================================
const MATERIALS = [
  { id:"copper",          name:"Copper",          tier:1, armor:true,  tool:true,  gtTool:false, utility:true,  sGear:false },
  { id:"bismuth_bronze",  name:"Bismuth Bronze",  tier:2, armor:true,  tool:true,  gtTool:false, utility:true,  sGear:true  },
  { id:"bronze",          name:"Bronze",          tier:2, armor:true,  tool:true,  gtTool:false, utility:true,  sGear:false },
  { id:"black_bronze",    name:"Black Bronze",    tier:2, armor:true,  tool:true,  gtTool:false, utility:true,  sGear:true  },
  { id:"wrought_iron",    name:"Wrought Iron",    tier:3, armor:true,  tool:true,  gtTool:false, utility:true,  sGear:true  },
  { id:"steel",           name:"Steel",           tier:4, armor:true,  tool:true,  gtTool:false, utility:true,  sGear:false },
  { id:"black_steel",     name:"Black Steel",     tier:5, armor:true,  tool:true,  gtTool:false, utility:true,  sGear:false },
  { id:"blue_steel",      name:"Blue Steel",      tier:6, armor:true,  tool:true,  gtTool:false, utility:true,  sGear:false },
  { id:"red_steel",       name:"Red Steel",       tier:6, armor:true,  tool:true,  gtTool:false, utility:true,  sGear:false },
  { id:"gold",            name:"Gold",            tier:1, armor:false, tool:false, gtTool:false, utility:false, sGear:false },
  { id:"bismuth",         name:"Bismuth",         tier:1, armor:false, tool:false, gtTool:false, utility:false, sGear:false },
  { id:"brass",           name:"Brass",           tier:2, armor:false, tool:false, gtTool:false, utility:false, sGear:true  },
  { id:"nickel",          name:"Nickel",          tier:1, armor:false, tool:false, gtTool:false, utility:false, sGear:false },
  { id:"rose_gold",       name:"Rose Gold",       tier:1, armor:false, tool:false, gtTool:false, utility:false, sGear:false },
  { id:"silver",          name:"Silver",          tier:1, armor:false, tool:false, gtTool:false, utility:false, sGear:false },
  { id:"tin",             name:"Tin",             tier:1, armor:false, tool:false, gtTool:false, utility:false, sGear:false },
  { id:"zinc",            name:"Zinc",            tier:1, armor:false, tool:false, gtTool:false, utility:false, sGear:false },
  { id:"sterling_silver", name:"Sterling Silver", tier:1, armor:false, tool:false, gtTool:false, utility:false, sGear:false },
  { id:"iron",            name:"Iron",            tier:3, armor:false, tool:false, gtTool:false, utility:false, sGear:false },
  { id:"redstone",        name:"Redstone",        tier:1, armor:false, tool:false, gtTool:false, utility:false, sGear:false },
  { id:"red_alloy",       name:"Red Alloy",       tier:2, armor:false, tool:false, gtTool:false, utility:false, sGear:true  },
  { id:"tin_alloy",       name:"Tin Alloy",       tier:3, armor:false, tool:false, gtTool:false, utility:false, sGear:false },
  { id:"lead",            name:"Lead",            tier:2, armor:false, tool:false, gtTool:false, utility:false, sGear:false },
  { id:"invar",           name:"Invar",           tier:3, armor:false, tool:false, gtTool:true,  utility:false, sGear:false },
  { id:"potin",           name:"Potin",           tier:2, armor:false, tool:false, gtTool:false, utility:false, sGear:false },
  { id:"cobalt",          name:"Cobalt",          tier:3, armor:false, tool:false, gtTool:false, utility:false, sGear:false },
  { id:"cobalt_brass",    name:"Cobalt Brass",    tier:3, armor:false, tool:false, gtTool:true,  utility:false, sGear:false },
];

const TEMPLATES = [
  // Always available
  { suffix:"_sheet",      label:"Plate",               cat:"Components",   rules:["hit_last","hit_second_last","hit_third_last"],           bonus:false, req:null,      input:"Double Ingot" },
  { suffix:"_rod",        label:"Rod (x2)",             cat:"Components",   rules:["draw_last"],                                            bonus:false, req:null,      input:"Ingot" },
  { suffix:"_bolt",       label:"Bolt (x2)",            cat:"Components",   rules:["punch_last","draw_second_last","draw_third_last"],       bonus:false, req:null,      input:"Rod" },
  { suffix:"_screw",      label:"Screw",                cat:"Components",   rules:["punch_last","punch_second_last","shrink_third_last"],    bonus:false, req:null,      input:"Rod" },
  { suffix:"_ring",       label:"Ring",                 cat:"Components",   rules:["hit_last","hit_second_last","hit_third_last"],           bonus:false, req:null,      input:"Rod" },
  { suffix:"_spring",     label:"Spring",               cat:"Components",   rules:["hit_last","bend_second_last","bend_third_last"],         bonus:false, req:null,      input:"Long Rod" },
  { suffix:"_small_spring",label:"Small Spring",        cat:"Components",   rules:["hit_last","bend_second_last","bend_third_last"],         bonus:false, req:null,      input:"Rod" },
  { suffix:"_nugget",     label:"Nugget (x6)",          cat:"Components",   rules:["punch_last","hit_second_last","punch_third_last"],       bonus:false, req:null,      input:"Ingot" },
  { suffix:"_bars",       label:"Bars (x4)",            cat:"Utility",      rules:["upset_last","punch_second_last","punch_third_last"],     bonus:false, req:null,      input:"Ingot" },
  { suffix:"_bars_double",label:"Bars (x8)",            cat:"Utility",      rules:["upset_last","punch_second_last","punch_third_last"],     bonus:false, req:null,      input:"Double Ingot" },
  // Small Gear
  { suffix:null, idFn:m=>`tfc:anvil/small_${m.id}_gear`, label:"Small Gear", cat:"Components", rules:["hit_last","shrink_second_last","draw_third_last"], bonus:false, req:"sGear", input:"Ingot" },
  // Armor (requires armor flag)
  { suffix:"_unfinished_helmet",     label:"Unfinished Helmet",     cat:"Armor", rules:["hit_last","bend_second_last","bend_third_last"],     bonus:false, req:"armor",  input:"Double Sheet" },
  { suffix:"_unfinished_chestplate", label:"Unfinished Chestplate", cat:"Armor", rules:["hit_last","hit_second_last","upset_third_last"],     bonus:false, req:"armor",  input:"Double Sheet" },
  { suffix:"_unfinished_greaves",    label:"Unfinished Greaves",    cat:"Armor", rules:["bend_any","draw_any","hit_any"],                     bonus:false, req:"armor",  input:"Double Sheet" },
  { suffix:"_unfinished_boots",      label:"Unfinished Boots",      cat:"Armor", rules:["bend_last","bend_second_last","shrink_third_last"],  bonus:false, req:"armor",  input:"Sheet" },
  // Tool (requires tool flag)
  { suffix:"_tuyere",       label:"Tuyere",         cat:"Tools", rules:["bend_last","bend_second_last"],                     bonus:false, req:"tool",  input:"Double Sheet" },
  { suffix:"_shield",       label:"Shield",          cat:"Tools", rules:["upset_last","bend_second_last","bend_third_last"],  bonus:false, req:"tool",  input:"Double Sheet" },
  { suffix:"_buzzsaw_blade",label:"Buzzsaw Blade",   cat:"Tools", rules:["bend_last","hit_second_last","draw_third_last"],    bonus:false, req:"tool",  input:"Double Sheet" },
  { suffix:"_fish_hook",    label:"Fish Hook",       cat:"Tools", rules:["draw_not_last","bend_any","hit_any"],               bonus:true,  req:"tool",  input:"Sheet" },
  { suffix:"_chisel_head",  label:"Chisel Head",     cat:"Tools", rules:["hit_last","hit_not_last","draw_not_last"],           bonus:true,  req:"tool",  input:"Ingot" },
  { suffix:"_javelin_head", label:"Javelin Head",    cat:"Weapons", rules:["hit_last","hit_second_last","draw_third_last"],    bonus:true,  req:"tool",  input:"Ingot" },
  { suffix:"_propick_head", label:"Propick Head",    cat:"Tools", rules:["punch_last","draw_not_last","bend_not_last"],        bonus:true,  req:"tool",  input:"Ingot" },
  { suffix:"_mace_head",    label:"Mace Head",       cat:"Weapons", rules:["hit_last","shrink_not_last","bend_not_last"],      bonus:true,  req:"tool",  input:"Double Ingot" },
  // Tool heads (requires tool OR gtTool)
  { suffix:"_sword_blade",         label:"Sword Blade",          cat:"Weapons",    rules:["punch_last","bend_not_last","draw_not_last"],        bonus:true, req:"anyTool", input:"Double Ingot" },
  { suffix:"_knife_butchery_head", label:"Butchery Knife Head",  cat:"Tools",      rules:["punch_last","bend_not_last","bend_not_last"],        bonus:true, req:"anyTool", input:"Ingot" },
  { suffix:"_mining_hammer_head",  label:"Mining Hammer Head",   cat:"Tools",      rules:["punch_last","shrink_not_last"],                      bonus:true, req:"anyTool", input:"Double Ingot" },
  { suffix:"_spade_head",          label:"Spade Head",           cat:"Tools",      rules:["punch_last","hit_not_last"],                         bonus:true, req:"anyTool", input:"Double Ingot" },
  { suffix:"_pickaxe_head",        label:"Pickaxe Head",         cat:"Tools",      rules:["punch_last","bend_not_last","draw_not_last"],        bonus:true, req:"anyTool", input:"Ingot" },
  { suffix:"_axe_head",            label:"Axe Head",             cat:"Tools",      rules:["punch_last","hit_second_last","upset_third_last"],   bonus:true, req:"anyTool", input:"Ingot" },
  { suffix:"_shovel_head",         label:"Shovel Head",          cat:"Tools",      rules:["punch_last","hit_not_last"],                         bonus:true, req:"anyTool", input:"Ingot" },
  { suffix:"_hoe_head",            label:"Hoe Head",             cat:"Tools",      rules:["punch_last","hit_not_last","bend_not_last"],         bonus:true, req:"anyTool", input:"Ingot" },
  { suffix:"_hammer_head",         label:"Hammer Head",          cat:"Tools",      rules:["punch_last","shrink_not_last"],                      bonus:true, req:"anyTool", input:"Ingot" },
  { suffix:"_saw_blade",           label:"Saw Blade",            cat:"Tools",      rules:["hit_last","hit_second_last"],                        bonus:true, req:"anyTool", input:"Ingot" },
  { suffix:"_scythe_blade",        label:"Scythe Blade",         cat:"Tools",      rules:["punch_last","bend_not_last","draw_not_last"],        bonus:true, req:"anyTool", input:"Ingot" },
  { suffix:"_file_head",           label:"File Head",            cat:"Tools",      rules:["upset_last","bend_not_last","punch_not_last"],       bonus:true, req:"anyTool", input:"Ingot" },
  { suffix:"_knife_blade",         label:"Knife Blade",          cat:"Tools",      rules:["punch_last","bend_not_last","draw_not_last"],        bonus:true, req:"anyTool", input:"Ingot" },
  // RNR mattock head (requires TFC tool flag)
  { suffix:null, idFn:m=>`rnr:anvil/${m.id}_mattock_head`,       label:"Mattock Head",         cat:"Tools",      rules:["punch_last","punch_not_last","bend_not_last"],      bonus:true, req:"tool",    input:"Ingot" },
  // GT tool tips (requires tool OR gtTool, different namespace)
  { suffix:null, idFn:m=>`gtceu:anvil/${m.id}_screwdriver_tip`, label:"Screwdriver Tip", cat:"GT Tools", rules:["draw_last","hit_second_last","hit_third_last"], bonus:false, req:"anyTool", input:"Ingot" },
  { suffix:null, idFn:m=>`gtceu:anvil/${m.id}_wrench_tip`,      label:"Wrench Tip",      cat:"GT Tools", rules:["draw_last","hit_second_last","hit_third_last"], bonus:false, req:"anyTool", input:"Double Ingot" },
  { suffix:null, idFn:m=>`gtceu:anvil/${m.id}_wire_cutter_head`,label:"Wire Cutter Head", cat:"GT Tools", rules:["draw_last","hit_second_last","hit_third_last"], bonus:false, req:"anyTool", input:"Double Ingot" },
  // Utility (requires utility flag)
  { suffix:"_trapdoor", label:"Trapdoor", cat:"Utility", rules:["bend_last","draw_second_last","draw_third_last"], bonus:false, req:"utility", input:"Sheet" },
];

function buildRecipeDB() {
  const recipes = [];

  for (const mat of MATERIALS) {
    for (const tpl of TEMPLATES) {
      if (tpl.req === "armor"   && !mat.armor) continue;
      if (tpl.req === "tool"    && !mat.tool) continue;
      if (tpl.req === "anyTool" && !mat.tool && !mat.gtTool) continue;
      if (tpl.req === "utility" && !mat.utility) continue;
      if (tpl.req === "sGear"   && !mat.sGear) continue;

      const recipeId = tpl.idFn ? tpl.idFn(mat) : `tfc:anvil/${mat.id}${tpl.suffix}`;
      recipes.push({
        id: recipeId,
        name: `${mat.name} ${tpl.label}`,
        rules: tpl.rules,
        tier: mat.tier,
        bonus: tpl.bonus,
        category: tpl.cat,
        material: mat.name,
        input: tpl.input,
      });
    }
  }

  // Fixed recipes
  recipes.push(
    { id:"tfc:anvil/iron_door",                name:"Iron Door",                  rules:["hit_last","draw_not_last","punch_not_last"],         tier:3, bonus:false, category:"Utility",    material:"Wrought Iron", input:"Sheet" },
    { id:"tfc:anvil/wrought_iron_from_bloom",  name:"Wrought Iron from Bloom",    rules:["hit_last","hit_second_last","hit_third_last"],       tier:2, bonus:false, category:"Smelting",   material:"Wrought Iron", input:"Bloom" },
    { id:"tfc:anvil/steel_ingot",              name:"Steel Ingot",                rules:["hit_last","hit_second_last","hit_third_last"],       tier:3, bonus:false, category:"Smelting",   material:"Steel",        input:"Ingot" },
    { id:"tfc:anvil/black_steel_ingot",        name:"Black Steel Ingot",          rules:["hit_last","hit_second_last","hit_third_last"],       tier:4, bonus:false, category:"Smelting",   material:"Black Steel",  input:"Ingot" },
    { id:"tfc:anvil/red_steel_ingot",          name:"Red Steel Ingot",            rules:["hit_last","hit_second_last","hit_third_last"],       tier:5, bonus:false, category:"Smelting",   material:"Red Steel",    input:"Ingot" },
    { id:"tfc:anvil/blue_steel_ingot",         name:"Blue Steel Ingot",           rules:["hit_last","hit_second_last","hit_third_last"],       tier:5, bonus:false, category:"Smelting",   material:"Blue Steel",   input:"Ingot" },
    { id:"tfc:anvil/blowpipe",                 name:"Blowpipe",                  rules:["draw_last","draw_second_last","hit_third_last"],     tier:2, bonus:false, category:"Utility",    material:"Brass",        input:"Rod" },
    { id:"tfc:anvil/jar_lid",                  name:"Jar Lid (x16)",             rules:["hit_last","hit_second_last","punch_third_last"],     tier:1, bonus:false, category:"Utility",    material:"Tin",          input:"Ingot" },
    { id:"tfc:anvil/wrought_iron_grill",       name:"Wrought Iron Grill",        rules:["draw_last","punch_second_last","punch_third_last"],  tier:3, bonus:false, category:"Utility",    material:"Wrought Iron", input:"Double Sheet" },
    { id:"tfc:anvil/refined_iron_bloom",       name:"Refined Iron Bloom",        rules:["hit_last","hit_second_last","hit_third_last"],       tier:3, bonus:false, category:"Smelting",   material:"Wrought Iron", input:"Bloom" },
    { id:"tfc:anvil/high_carbon_steel_ingot",  name:"High Carbon Steel Ingot",   rules:["hit_last","hit_second_last","hit_third_last"],       tier:3, bonus:false, category:"Smelting",   material:"Wrought Iron", input:"Ingot" },
    { id:"tfc:anvil/brass_mechanisms",         name:"Brass Mechanisms (x2)",     rules:["punch_last","shrink_not_last","bend_not_last"],      tier:2, bonus:false, category:"Utility",    material:"Brass",        input:"Ingot" },
  );

  // AFC
  recipes.push(
    { id:"afc:anvil/tree_tap", name:"Tree Tap", rules:["hit_last","upset_second_last","upset_third_last"], tier:1, bonus:false, category:"Misc", material:"Copper", input:"Ingot" },
  );

  // FirmaLife
  recipes.push(
    { id:"firmalife:anvil/pie_pan", name:"Pie Pan (x4)", rules:["hit_last","hit_second_last","draw_third_last"], tier:3, bonus:false, category:"Misc", material:"Wrought Iron", input:"Sheet" },
  );

  // Sacks & Stuff
  recipes.push(
    { id:"sns:anvil/buckle",  name:"Buckle",       rules:["upset_last","hit_second_last","shrink_any"], tier:3, bonus:false, category:"Misc", material:"Wrought Iron", input:"Sheet" },
    { id:"sns:anvil/buckle2", name:"Buckle (x2)",   rules:["upset_last","hit_second_last","shrink_any"], tier:4, bonus:false, category:"Misc", material:"Steel", input:"Sheet" },
  );

  // TFG
  recipes.push(
    { id:"tfg:anvil/steel_support",          name:"Steel Support",           rules:["upset_last","shrink_any"],                                    tier:4, bonus:false, category:"Utility",    material:"Steel", input:"Double Ingot" },
    { id:"tfg:anvil/soaked_unrefined_paper", name:"Soaked Unrefined Paper",  rules:["hit_last","hit_second_last","hit_third_last"],                tier:0, bonus:false, category:"Misc",       material:"Other", input:"Dust" },
  );

  // CreateDeco
  const cdMetals = [
    { metal:"andesite",        mat:"Tin Alloy",     tier:3 },
    { metal:"brass",           mat:"Brass",         tier:2 },
    { metal:"iron",            mat:"Wrought Iron",  tier:3 },
    { metal:"copper",          mat:"Copper",        tier:1 },
    { metal:"industrial_iron", mat:"Steel",         tier:4 },
    { metal:"zinc",            mat:"Zinc",          tier:1 },
  ];
  for (const cd of cdMetals) {
    if (cd.metal !== "iron") {
      recipes.push(
        { id:`createdeco:anvil/${cd.metal}_bars`, name:`CD ${cd.mat} Bars (x4)`, rules:["shrink_last","punch_second_last","punch_third_last"], tier:cd.tier, bonus:false, category:"CreateDeco", material:cd.mat, input:"Ingot" },
        { id:`createdeco:anvil/${cd.metal}_door`, name:`CD ${cd.mat} Door`,      rules:["draw_last","draw_second_last","punch_third_last"],   tier:cd.tier, bonus:false, category:"CreateDeco", material:cd.mat, input:"Double Sheet" },
      );
    }
    recipes.push(
      { id:`createdeco:anvil/${cd.metal}_bars_overlay`, name:`CD ${cd.mat} Bars Overlay`, rules:["draw_last","punch_second_last","punch_third_last"], tier:cd.tier, bonus:false, category:"CreateDeco", material:cd.mat, input:"Ingot" },
    );
  }
  recipes.push(
    { id:"createdeco:anvil/brass_trapdoor",    name:"CD Brass Trapdoor",    rules:["shrink_last","draw_second_last","draw_third_last"], tier:2, bonus:false, category:"CreateDeco", material:"Brass",    input:"Ingot" },
    { id:"createdeco:anvil/zinc_trapdoor",     name:"CD Zinc Trapdoor",     rules:["shrink_last","draw_second_last","draw_third_last"], tier:1, bonus:false, category:"CreateDeco", material:"Zinc",     input:"Ingot" },
    { id:"createdeco:anvil/andesite_trapdoor", name:"CD Andesite Trapdoor", rules:["shrink_last","draw_second_last","draw_third_last"], tier:3, bonus:false, category:"CreateDeco", material:"Tin Alloy", input:"Ingot" },
  );

  recipes.sort((a, b) => a.name.localeCompare(b.name));
  return recipes;
}

const ALL_RECIPES = buildRecipeDB();

// ============================================================
//  UI CONTROLLER
// ============================================================
const STORAGE_SEED = "sts_seed";
const STORAGE_PINS = "sts_pinned";

let currentSeed = null;   // BigInt or null
let selectedRecipe = null;
let filteredRecipes = ALL_RECIPES;
const solverCache = new Map();
let pinnedIds = new Set();

function $(id) { return document.getElementById(id); }

function loadPersisted() {
  try {
    const stored = localStorage.getItem(STORAGE_PINS);
    if (stored) pinnedIds = new Set(JSON.parse(stored));
  } catch { /* ignore corrupt data */ }
}

function savePins() {
  localStorage.setItem(STORAGE_PINS, JSON.stringify([...pinnedIds]));
}

function saveSeed(raw) {
  if (raw) localStorage.setItem(STORAGE_SEED, raw);
  else localStorage.removeItem(STORAGE_SEED);
}

function loadSeed() {
  return localStorage.getItem(STORAGE_SEED) || "";
}

function isPinned(recipeId) {
  return pinnedIds.has(recipeId);
}

function togglePin(recipeId) {
  if (pinnedIds.has(recipeId)) pinnedIds.delete(recipeId);
  else pinnedIds.add(recipeId);
  savePins();
  renderPinnedPanel();
  renderRecipeList();
  renderDetail();
}

function formatRule(ruleStr) {
  const { type, order } = parseRule(ruleStr);
  const typeLabel = type.charAt(0).toUpperCase() + type.slice(1);
  const orderLabel = order.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
  return { type: typeLabel, order: orderLabel, raw: ruleStr };
}

function renderRuleBadge(rule) {
  const f = formatRule(rule);
  const el = document.createElement("div");
  el.className = "rule-badge";
  el.innerHTML = `<span class="rule-type">${f.type}</span><span class="rule-order">${f.order}</span>`;
  return el;
}

function stepClass(stepId) {
  return "step-" + stepId;
}

function renderStepBadge(step, isRule) {
  const el = document.createElement("span");
  el.className = `step-badge ${stepClass(step.id)}${isRule ? " is-rule" : ""}`;
  el.textContent = step.name;
  return el;
}

function solveForRecipe(recipe) {
  if (currentSeed === null) return null;
  const target = computeTarget(currentSeed, recipe.id);
  const cacheKey = `${target}|${recipe.rules.join(",")}`;
  let path = solverCache.get(cacheKey);
  if (path === undefined) {
    path = solve(target, recipe.rules);
    solverCache.set(cacheKey, path);
  }
  return { target, path };
}

function renderPinnedPanel() {
  const panel = $("pinned-panel");
  const list = $("pinned-list");
  const count = $("pinned-count");

  const pinned = ALL_RECIPES.filter(r => pinnedIds.has(r.id));
  count.textContent = pinned.length;

  const main = panel.parentElement;
  if (pinned.length === 0) {
    panel.classList.add("hidden");
    main.classList.remove("has-pins");
    return;
  }
  panel.classList.remove("hidden");
  main.classList.add("has-pins");
  list.innerHTML = "";

  for (const r of pinned) {
    const card = document.createElement("div");
    card.className = "pinned-card";

    const header = document.createElement("div");
    header.className = "pinned-card-header";

    const name = document.createElement("span");
    name.className = "pinned-card-name";
    name.textContent = r.name;
    name.title = r.name;

    const unpin = document.createElement("button");
    unpin.className = "btn-unpin";
    unpin.innerHTML = "&#x2716;";
    unpin.title = "Unpin";
    unpin.addEventListener("click", (e) => { e.stopPropagation(); togglePin(r.id); });

    header.appendChild(name);
    header.appendChild(unpin);
    card.appendChild(header);

    const meta = document.createElement("div");
    meta.className = "pinned-card-meta";
    if (r.input) {
      const inp = document.createElement("span");
      inp.className = `pinned-input input-${r.input.toLowerCase().replace(/\s+/g, "-")}`;
      inp.textContent = r.input;
      meta.appendChild(inp);
    }

    if (currentSeed !== null) {
      const result = solveForRecipe(r);
      const tgt = document.createElement("span");
      tgt.className = "pinned-target";
      tgt.textContent = `Target: ${result.target}`;
      meta.appendChild(tgt);
      card.appendChild(meta);

      if (result.path) {
        const seq = document.createElement("div");
        seq.className = "pinned-card-seq";
        const ruleCount = r.rules.length;
        const ruleStart = result.path.length - ruleCount;
        for (let i = 0; i < result.path.length; i++) {
          if (i > 0) {
            const arrow = document.createElement("span");
            arrow.className = "step-arrow";
            arrow.textContent = "\u25B8";
            seq.appendChild(arrow);
          }
          const step = result.path[i];
          const el = document.createElement("span");
          el.className = `step-badge step-badge-sm ${stepClass(step.id)}${i >= ruleStart ? " is-rule" : ""}`;
          el.textContent = step.name;
          seq.appendChild(el);
        }
        card.appendChild(seq);
      } else {
        const noSol = document.createElement("div");
        noSol.className = "pinned-card-nosol";
        noSol.textContent = "No solution";
        card.appendChild(noSol);
      }
    } else {
      const noSeed = document.createElement("span");
      noSeed.className = "pinned-target pinned-no-seed";
      noSeed.textContent = "No seed";
      meta.appendChild(noSeed);
      card.appendChild(meta);
    }

    card.addEventListener("click", () => selectRecipe(r));
    list.appendChild(card);
  }
}

function populateFilters() {
  const matSet = new Set(), catSet = new Set(), inputSet = new Set();
  for (const r of ALL_RECIPES) {
    matSet.add(r.material);
    catSet.add(r.category);
    if (r.input) inputSet.add(r.input);
  }
  const matSelect = $("filter-material");
  [...matSet].sort().forEach(m => {
    const o = document.createElement("option");
    o.value = m; o.textContent = m;
    matSelect.appendChild(o);
  });
  const catSelect = $("filter-category");
  [...catSet].sort().forEach(c => {
    const o = document.createElement("option");
    o.value = c; o.textContent = c;
    catSelect.appendChild(o);
  });
  const inputSelect = $("filter-input");
  [...inputSet].sort().forEach(i => {
    const o = document.createElement("option");
    o.value = i; o.textContent = i;
    inputSelect.appendChild(o);
  });
}

function filterRecipes() {
  const q = $("recipe-search").value.toLowerCase();
  const mat = $("filter-material").value;
  const cat = $("filter-category").value;
  const tier = $("filter-tier").value;
  const inp = $("filter-input").value;

  filteredRecipes = ALL_RECIPES.filter(r => {
    if (q && !r.name.toLowerCase().includes(q) && !r.id.toLowerCase().includes(q)) return false;
    if (mat && r.material !== mat) return false;
    if (cat && r.category !== cat) return false;
    if (tier && r.tier !== parseInt(tier)) return false;
    if (inp && r.input !== inp) return false;
    return true;
  });

  renderRecipeList();
}

function renderRecipeList() {
  const list = $("recipe-list");
  list.innerHTML = "";
  $("recipe-count").textContent = filteredRecipes.length;

  for (const r of filteredRecipes) {
    const li = document.createElement("li");
    li.className = "recipe-item" + (selectedRecipe && selectedRecipe.id === r.id ? " selected" : "");
    const pinned = isPinned(r.id);
    const inputTag = r.input ? `<span class="recipe-item-input input-${r.input.toLowerCase().replace(/\s+/g, "-")}">${r.input}</span>` : "";
    li.innerHTML = `
      <button class="btn-star ${pinned ? "starred" : ""}" title="${pinned ? "Unpin" : "Pin"}">${pinned ? "\u2605" : "\u2606"}</button>
      <div class="recipe-item-info">
        <div class="recipe-item-name">${r.name}</div>
        <div class="recipe-item-sub">${r.id}</div>
      </div>
      ${inputTag}
      <span class="recipe-item-tier tier-${r.tier}">T${r.tier}</span>
    `;
    li.querySelector(".btn-star").addEventListener("click", (e) => { e.stopPropagation(); togglePin(r.id); });
    li.addEventListener("click", () => selectRecipe(r));
    list.appendChild(li);
  }
}

function selectRecipe(recipe) {
  selectedRecipe = recipe;
  renderRecipeList();
  renderDetail();
}

function renderDetail() {
  if (!selectedRecipe) {
    $("detail-empty").classList.remove("hidden");
    $("detail-content").classList.add("hidden");
    return;
  }
  $("detail-empty").classList.add("hidden");
  $("detail-content").classList.remove("hidden");

  const r = selectedRecipe;
  $("detail-title").textContent = r.name;
  const pinBtn = $("detail-pin");
  const pinned = isPinned(r.id);
  pinBtn.innerHTML = pinned ? "&#x2605;" : "&#x2606;";
  pinBtn.className = `btn-pin${pinned ? " starred" : ""}`;
  pinBtn.title = pinned ? "Unpin recipe" : "Pin recipe";
  $("detail-tier").textContent = `Tier ${r.tier}`;
  $("detail-tier").className = `meta-badge tier-badge tier-${r.tier}`;
  const inputEl = $("detail-input");
  if (r.input) {
    inputEl.textContent = r.input;
    inputEl.className = `meta-badge input-badge input-${r.input.toLowerCase().replace(/\s+/g, "-")}`;
    inputEl.classList.remove("hidden");
  } else {
    inputEl.classList.add("hidden");
  }
  $("detail-bonus").classList.toggle("hidden", !r.bonus);
  $("detail-id").textContent = r.id;

  const rulesEl = $("detail-rules");
  rulesEl.innerHTML = "";
  for (const rule of r.rules) rulesEl.appendChild(renderRuleBadge(rule));

  renderTarget();
}

function renderTarget() {
  if (!selectedRecipe) return;
  const targetEl = $("detail-target");
  const barContainer = $("anvil-bar-container");
  const solSection = $("solution-section");

  if (currentSeed === null) {
    targetEl.innerHTML = `<span class="target-no-seed">Enter a world seed above to compute target.</span>`;
    barContainer.classList.add("hidden");
    solSection.classList.add("hidden");
    return;
  }

  const target = computeTarget(currentSeed, selectedRecipe.id);
  targetEl.textContent = target;
  barContainer.classList.remove("hidden");

  const pct = (target / LIMIT) * 100;
  $("anvil-bar-fill").style.width = pct + "%";
  $("anvil-bar-marker").style.left = `calc(${pct}% - 1.5px)`;

  renderSolution(target);
}

function renderSolution(target) {
  const solSection = $("solution-section");
  const cacheKey = `${target}|${selectedRecipe.rules.join(",")}`;
  let path = solverCache.get(cacheKey);
  if (path === undefined) {
    path = solve(target, selectedRecipe.rules);
    solverCache.set(cacheKey, path);
  }

  if (!path) {
    solSection.classList.remove("hidden");
    $("step-count").textContent = "No solution";
    $("solution-steps").innerHTML = `<span style="color:var(--red)">No valid path found.</span>`;
    $("solution-path").textContent = "";
    return;
  }

  solSection.classList.remove("hidden");
  $("step-count").textContent = `${path.length} steps`;

  const stepsEl = $("solution-steps");
  stepsEl.innerHTML = "";
  const ruleCount = selectedRecipe.rules.length;
  const ruleStart = path.length - ruleCount;

  for (let i = 0; i < path.length; i++) {
    if (i > 0) {
      const arrow = document.createElement("span");
      arrow.className = "step-arrow";
      arrow.textContent = "\u25B8";
      stepsEl.appendChild(arrow);
    }
    stepsEl.appendChild(renderStepBadge(path[i], i >= ruleStart));
  }

  let val = 0;
  const nums = ["0"];
  for (const step of path) {
    val += step.value;
    nums.push(String(val));
  }
  $("solution-path").textContent = nums.join(" \u2192 ");
}

function applySeed() {
  const raw = $("seed-input").value.trim();
  if (!raw) {
    currentSeed = null;
    saveSeed("");
    $("seed-status").textContent = "No seed entered \u2014 targets will not be computed.";
    $("seed-status").classList.remove("active");
  } else {
    currentSeed = parseSeed(raw);
    saveSeed(raw);
    const isNumeric = /^-?\d+$/.test(raw);
    const display = isNumeric ? raw : `"${raw}" \u2192 ${currentSeed}`;
    $("seed-status").textContent = `Seed active: ${display}`;
    $("seed-status").classList.add("active");
  }
  solverCache.clear();
  renderTarget();
  renderPinnedPanel();
}

// ============================================================
//  TAB SWITCHING
// ============================================================
const CHANGELOG_ENTRIES = [
  {
    date: "2026-04-16",
    version: "v1.3.0",
    title: "Added Change Log tab",
    summary: "Introduced an in-app Change Log tab to track updates in a consistent format.",
    points: [
      "Added a dedicated Change Log tab beside Anvil and Alloy calculators",
      "Rendered versioned entries with date, summary, and detailed bullets",
      "Added an agent-maintained format guide for future consistency",
    ],
  },
  {
    date: "2026-04-16",
    version: "v1.2.1",
    title: "Added RNR Mattock Head anvil recipes",
    summary: "Restored missing mattock head recipes for all supported tool materials in the Anvil Calculator.",
    points: [
      "Added recipe IDs using rnr:anvil/<material>_mattock_head",
      "Applied correct rules: punch_last, punch_not_last, bend_not_last",
      "Scoped recipes to valid tool materials only",
    ],
  },
];

const STORAGE_TAB = "sts_tab";

function renderChangeLog() {
  const list = $("changelog-list");
  if (!list) return;
  list.innerHTML = "";

  for (const entry of CHANGELOG_ENTRIES) {
    const card = document.createElement("article");
    card.className = "changelog-item";
    const pointsHtml = entry.points.map(p => `<li>${p}</li>`).join("");
    card.innerHTML = `
      <div class="changelog-item-head">
        <span class="changelog-date">${entry.date}</span>
        <span class="changelog-version">${entry.version}</span>
      </div>
      <h3 class="changelog-title">${entry.title}</h3>
      <p class="changelog-summary">${entry.summary}</p>
      <ul class="changelog-points">${pointsHtml}</ul>
    `;
    list.appendChild(card);
  }
}

function initTabs() {
  const bar = $("tab-bar");
  const btns = bar.querySelectorAll(".tab-btn");
  const indicator = $("tab-indicator");

  function activateTab(tabId) {
    btns.forEach(b => b.classList.toggle("active", b.dataset.tab === tabId));
    document.querySelectorAll(".tab-content").forEach(tc => {
      tc.classList.toggle("hidden", tc.id !== `tab-${tabId}`);
    });
    const activeBtn = bar.querySelector(`.tab-btn[data-tab="${tabId}"]`);
    if (activeBtn && indicator) {
      indicator.style.left = activeBtn.offsetLeft + "px";
      indicator.style.width = activeBtn.offsetWidth + "px";
    }
    localStorage.setItem(STORAGE_TAB, tabId);
  }

  btns.forEach(b => {
    b.addEventListener("click", () => activateTab(b.dataset.tab));
  });

  const saved = localStorage.getItem(STORAGE_TAB) || "anvil";
  activateTab(saved);

  window.addEventListener("resize", () => {
    const activeBtn = bar.querySelector(".tab-btn.active");
    if (activeBtn && indicator) {
      indicator.style.left = activeBtn.offsetLeft + "px";
      indicator.style.width = activeBtn.offsetWidth + "px";
    }
  });
}

// ---- Event Binding ----
document.addEventListener("DOMContentLoaded", () => {
  loadPersisted();
  populateFilters();
  renderChangeLog();
  initTabs();

  const savedSeed = loadSeed();
  if (savedSeed) {
    $("seed-input").value = savedSeed;
    applySeed();
  }

  renderRecipeList();
  renderPinnedPanel();

  $("seed-apply").addEventListener("click", applySeed);
  $("seed-input").addEventListener("keydown", e => { if (e.key === "Enter") applySeed(); });
  $("recipe-search").addEventListener("input", filterRecipes);
  $("filter-material").addEventListener("change", filterRecipes);
  $("filter-category").addEventListener("change", filterRecipes);
  $("filter-tier").addEventListener("change", filterRecipes);
  $("filter-input").addEventListener("change", filterRecipes);
  $("detail-pin").addEventListener("click", () => { if (selectedRecipe) togglePin(selectedRecipe.id); });
});
