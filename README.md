# Seed to Steel

A static web calculator for **TerraFirmaGreg Modern** (TFC 1.20.1-3.2.19) that provides two tools:

## Anvil Forging Calculator

Enter your world seed and get the exact forging target for every anvil recipe. The solver computes the optimal step sequence to hit each target.

- **PRNG-accurate targets** — reverse-engineered from TFC's `XoroshiroRandomSource` / `Xoroshiro128PlusPlus` implementation, using BigInt for full 64-bit fidelity
- **400+ recipes** — all TFC + TFG anvil recipes with correct rules, tiers, and input types
- **Optimal forging paths** — BFS pathfinder returns the shortest sequence of hits/punches/bends to reach the target
- **Pin recipes** — star your frequently-used recipes; pins and world seed persist in localStorage
- **Filter & search** — by material, type, tier, and input item

## Alloy Calculator

Calculate the exact item quantities needed to produce any of the 14 TFG alloys, or melt down items for pure metals.

- **14 alloys** — Bronze, Brass, Bismuth Bronze, Black Bronze, Rose Gold, Sterling Silver, Weak Steel, Weak/Blue/Red Steel, Red Alloy, Tin Alloy, Invar, Potin, Cobalt Brass
- **Constraint solver** — finds combinations that satisfy percentage requirements with zero waste when possible
- **6 meltable item types** — Ingot (144 mB), Double Ingot (288 mB), Dust (144 mB), Small Dust (36 mB), Tiny Dust (16 mB), Nugget (16 mB)
- **Pure Metal mode** — calculates optimal item breakdown for non-alloy metals
- **Waste analysis** — reports waste mB/percentage and flags perfect (zero-waste) recipes

## Usage

**No server required.** Open `index.html` in any modern browser — everything runs client-side.

To host it yourself: drop the folder on any static file host (GitHub Pages, Netlify, a simple HTTP server, etc.).

### Files

| File | Purpose |
|------|---------|
| `index.html` | Page structure and layout |
| `style.css` | All styling (dark theme) |
| `app.js` | PRNG engine, anvil recipe database, forging solver, anvil tab UI |
| `alloy.js` | Alloy recipe database, constraint solver, alloy tab UI |

## Project Status

**This project is not actively maintained.** It was built for a specific TFG modpack version (TFC 1.20.1-3.2.19) and is released as-is. Feel free to fork and adapt it for other versions.

## License

[MIT](LICENSE) — use it however you want.
