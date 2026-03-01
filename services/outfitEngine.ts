import type {
  ClothingItem,
  ClothingCategory,
  Season,
  FabricType,
  Occasion,
  Pattern,
  Outfit,
} from "@/models/types";
import { hexToHSL } from "@/constants/colors";
import { getOutfitFlags, saveOutfitFlag } from "@/services/storage";

// --- Advanced Color Harmony Rules ---

function isNeutral(hex: string): boolean {
  const { s, l } = hexToHSL(hex);
  return s < 15 || l < 15 || l > 90;
}

export function colorCompatibility(hex1: string, hex2: string): number {
  const neutral1 = isNeutral(hex1);
  const neutral2 = isNeutral(hex2);

  // Two neutrals always work (black + white, navy + grey, etc.)
  if (neutral1 && neutral2) return 0.92;
  // One neutral grounds any colour
  if (neutral1 || neutral2) return 0.87;

  const c1 = hexToHSL(hex1);
  const c2 = hexToHSL(hex2);
  const hueDiff = Math.min(Math.abs(c1.h - c2.h), 360 - Math.abs(c1.h - c2.h));

  const satDiff = Math.abs(c1.s - c2.s);
  const satBonus = satDiff < 20 ? 0.05 : satDiff < 40 ? 0.02 : 0;
  const lightDiff = Math.abs(c1.l - c2.l);
  // Tonal dressing bonus: same hue, different lightness = modern & chic
  const tonalBonus = hueDiff < 15 && lightDiff > 15 && lightDiff < 45 ? 0.08 : 0;
  const lightBonus = lightDiff > 15 && lightDiff < 50 ? 0.04 : 0;

  let baseScore = 0.35;

  // Monochromatic: same hue, vary saturation/lightness = very trendy
  if (hueDiff < 10) {
    baseScore = lightDiff > 15 ? 0.92 : 0.74;
  }
  // Analogous: adjacent colours on wheel (e.g., rust + blush, navy + teal)
  else if (hueDiff < 30) {
    baseScore = 0.86;
  }
  // Broader analogous
  else if (hueDiff < 60) {
    baseScore = 0.76;
  }
  // Triadic harmony (~120° apart, e.g., red + blue + yellow tones)
  else if (hueDiff >= 110 && hueDiff <= 130) {
    baseScore = 0.74;
  }
  // Split-complementary (~150° apart — a classic fashion pairing)
  else if (hueDiff >= 135 && hueDiff < 165) {
    baseScore = 0.82;
  }
  // Complementary (opposite on wheel — bold, eye-catching)
  else if (hueDiff >= 165 && hueDiff <= 195) {
    baseScore = 0.9;
  }
  // Awkward gap (80-110° — colours that feel "off" together)
  else if (hueDiff > 80 && hueDiff < 110) {
    baseScore = 0.5;
  }
  // Anything else is a weaker pairing
  else {
    baseScore = 0.42;
  }

  return Math.min(1.0, baseScore + satBonus + lightBonus + tonalBonus);
}

// --- Color Temperature (#74) ---
// Warm hues: red, orange, yellow (0-60°, 330-360°)
// Cool hues: blue, green, purple (120-270°)
// Neutral zone: 60-120° and 270-330° can go either way
function getColorTemp(hex: string): "warm" | "cool" | "neutral" {
  const { h, s, l } = hexToHSL(hex);
  if (s < 12 || l < 12 || l > 90) return "neutral"; // achromatic
  if ((h >= 0 && h <= 60) || h >= 330) return "warm";
  if (h >= 120 && h <= 270) return "cool";
  return "neutral";
}

function colorTemperatureScore(items: ClothingItem[]): number {
  const temps = items.map((i) => getColorTemp(i.color)).filter((t) => t !== "neutral");
  if (temps.length < 2) return 0; // not enough non-neutral items to judge
  const warmCount = temps.filter((t) => t === "warm").length;
  const coolCount = temps.filter((t) => t === "cool").length;
  // All same temperature = great coherence
  if (warmCount === 0 || coolCount === 0) return 3;
  // Mixed temps = penalty proportional to imbalance
  const ratio = Math.min(warmCount, coolCount) / Math.max(warmCount, coolCount);
  if (ratio > 0.6) return -3; // roughly equal warm and cool = clash
  return -1; // minor mix
}

function outfitColorScore(items: ClothingItem[]): { score: number; hasGreatHarmony: boolean } {
  if (items.length < 2) return { score: 0.85, hasGreatHarmony: false };

  const allColors: string[] = [];
  for (const item of items) {
    allColors.push(item.color);
    if (item.secondaryColor) allColors.push(item.secondaryColor);
  }

  let totalScore = 0;
  let pairs = 0;

  for (let i = 0; i < allColors.length; i++) {
    for (let j = i + 1; j < allColors.length; j++) {
      totalScore += colorCompatibility(allColors[i], allColors[j]);
      pairs++;
    }
  }

  if (pairs === 0) return { score: 0.85, hasGreatHarmony: false };
  let avgScore = totalScore / pairs;

  // Trend bonuses:
  // 1. Monochromatic outfits (all similar hue) — very on-trend
  const hsls = allColors.map((c) => hexToHSL(c));
  const nonNeutralHSLs = hsls.filter((h) => h.s >= 15 && h.l > 10 && h.l < 90);
  if (nonNeutralHSLs.length >= 2) {
    const hues = nonNeutralHSLs.map((h) => h.h);
    const maxHueDiff = Math.max(
      ...hues.flatMap((a, i) => hues.slice(i + 1).map((b) =>
        Math.min(Math.abs(a - b), 360 - Math.abs(a - b))
      ))
    );
    if (maxHueDiff < 20) avgScore = Math.max(avgScore, 0.92); // monochrome bonus
  }

  // 2. The "rule of 3 colours or fewer" — more than 3 distinct hues penalised
  const distinctHues = getDistinctHueCount(hsls);
  if (distinctHues > 3) {
    avgScore -= 0.05 * (distinctHues - 3);
  }

  // 3. Neutral base + single accent colour is a fashion staple
  const neutrals = hsls.filter((h) => h.s < 15 || h.l < 15 || h.l > 90);
  const accents = hsls.filter((h) => h.s >= 15 && h.l >= 15 && h.l <= 90);
  if (neutrals.length >= 2 && accents.length === 1) {
    avgScore = Math.max(avgScore, 0.88);
  }

  return { score: Math.min(1.0, Math.max(0, avgScore)), hasGreatHarmony: avgScore > 0.78 };
}

/** Count distinct colour families in the outfit (within 40° hue bands) */
function getDistinctHueCount(hsls: { h: number; s: number; l: number }[]): number {
  const nonNeutral = hsls.filter((h) => h.s >= 15 && h.l > 10 && h.l < 90);
  if (nonNeutral.length === 0) return 0;
  const hues = nonNeutral.map((h) => h.h).sort((a, b) => a - b);
  let groups = 1;
  for (let i = 1; i < hues.length; i++) {
    const diff = Math.min(hues[i] - hues[i - 1], 360 - (hues[i] - hues[i - 1]));
    if (diff > 40) groups++;
  }
  return groups;
}

// --- Fabric Compatibility ---

const FORMAL_FABRICS: FabricType[] = ["silk", "wool", "cashmere", "leather", "satin"];
const CASUAL_FABRICS: FabricType[] = ["cotton", "denim", "linen", "nylon", "polyester", "fleece"];

// Great fabric pairings that stylists love
const ELEVATED_PAIRINGS: [FabricType, FabricType][] = [
  ["denim", "leather"],   // classic cool combo
  ["denim", "cotton"],    // casual staple
  ["silk", "wool"],       // luxe mix
  ["silk", "denim"],      // high-low contrast (very trendy)
  ["cashmere", "denim"],  // casual luxury
  ["linen", "cotton"],    // summer staple
  ["leather", "wool"],    // winter chic
  ["satin", "wool"],      // evening elegance
  ["leather", "silk"],    // edgy meets elegant
  ["fleece", "denim"],    // cozy casual
];

// Pairings that usually feel "off"
const AWKWARD_PAIRINGS: [FabricType, FabricType][] = [
  ["fleece", "silk"],     // too much contrast
  ["fleece", "satin"],    // gym meets gala
  ["nylon", "silk"],      // athletic vs dressy
  ["nylon", "satin"],     // both shiny but wrong contexts
  ["polyester", "cashmere"], // cheap meets luxury
];

function fabricCompatibility(items: ClothingItem[]): number {
  const types = items.map((i) => i.fabricType).filter(Boolean);
  const uniqueTypes = new Set(types);
  if (uniqueTypes.size <= 1) return 0.9;

  // Check for specifically elevated or awkward pairings
  let elevatedPairs = 0;
  let awkwardPairs = 0;
  let totalPairs = 0;

  for (let i = 0; i < types.length; i++) {
    for (let j = i + 1; j < types.length; j++) {
      totalPairs++;
      const pair: [FabricType, FabricType] = [types[i], types[j]];
      if (ELEVATED_PAIRINGS.some(([a, b]) => (pair[0] === a && pair[1] === b) || (pair[0] === b && pair[1] === a))) {
        elevatedPairs++;
      }
      if (AWKWARD_PAIRINGS.some(([a, b]) => (pair[0] === a && pair[1] === b) || (pair[0] === b && pair[1] === a))) {
        awkwardPairs++;
      }
    }
  }

  if (totalPairs === 0) return 0.85;

  // Base score from formal/casual mix
  const hasFormal = types.some((t) => FORMAL_FABRICS.includes(t));
  const hasCasual = types.some((t) => CASUAL_FABRICS.includes(t));
  let baseScore = 0.85;

  if (hasFormal && hasCasual) {
    // Mixed formality is OK and often intentional in modern fashion (e.g. silk + denim)
    const formalCount = types.filter((t) => FORMAL_FABRICS.includes(t)).length;
    const casualCount = types.filter((t) => CASUAL_FABRICS.includes(t)).length;
    const balance = Math.min(formalCount, casualCount) / Math.max(formalCount, casualCount);
    baseScore = 0.65 + balance * 0.15;
  }

  // Apply pairing bonuses/penalties
  const elevatedBonus = (elevatedPairs / totalPairs) * 0.15;
  const awkwardPenalty = (awkwardPairs / totalPairs) * 0.2;

  return Math.min(1.0, Math.max(0.3, baseScore + elevatedBonus - awkwardPenalty));
}

// --- Comprehensive Seasonal Logic ---

function getItemSeasonalFit(item: ClothingItem, season: Season): number {
  const sub = item.subCategory ?? "";
  const cat = item.category;

  if (cat === "swimwear") {
    return season === "summer" ? 1.0 : 0.0;
  }

  if (cat === "shoes") {
    if (sub === "sandals" || sub === "casual_sandals" || sub === "birks") return season === "summer" ? 1.0 : 0.0;
    if (sub === "winter_boots") return season === "winter" ? 1.0 : 0.0;
    if (sub === "ankle_boots") return 1.0;
    if (sub === "knee_boots") {
      return season === "summer" ? 0.0 : 1.0;
    }
    if (["flats", "loafers", "running_shoes", "soccer_shoes"].includes(sub)) return 0.9;
    if (sub === "heels") return 0.9;
    return 0.9;
  }

  if (cat === "jackets") {
    if (sub === "parka" || sub === "ski_jacket") {
      return season === "winter" ? 1.0 : 0.0;
    }
    if (sub === "jean_jacket" || sub === "spring_jacket") {
      if (season === "spring" || season === "fall") return 1.0;
      if (season === "summer") return 0.7;
      return 0.3;
    }
    if (sub === "raincoat") {
      if (season === "spring" || season === "fall") return 1.0;
      if (season === "summer") return 0.5;
      return 0.6;
    }
    if (sub === "work_jacket") return 1.0;
    return 0.9;
  }

  if (cat === "blazers") return 1.0;

  if (cat === "tops") {
    if (sub === "tank_top") {
      return season === "summer" ? 1.0 : 0.0;
    }
    if (["sweater", "hoodie", "sweatshirt", "cardigan", "zip_up"].includes(sub)) return 1.0;
    if (["tshirt", "lounge_shirt", "sport"].includes(sub)) {
      if (season === "winter") return 0.6;
      return 1.0;
    }
    return 0.9;
  }

  if (cat === "bottoms") {
    if (season === "winter") {
      const { l } = hexToHSL(item.color);
      if (l > 90) return 0.3;
    }
    return 0.9;
  }

  // --- SHORTS: summer only ---
  if (cat === "shorts") {
    return season === "summer" ? 1.0 : 0.0;
  }

  // --- SKIRTS ---
  if (cat === "skirts") {
    if (sub === "skort") {
      return (season === "summer" || season === "spring") ? 1.0 : 0.0;
    }
    if (sub === "mini_skirt") {
      return season === "winter" ? 0.3 : 0.9;
    }
    return 0.9;
  }

  if (cat === "jumpsuits") {
    if (season === "winter") return 0.5;
    return 0.9;
  }

  if (cat === "dresses") {
    if (sub === "sundress") return season === "summer" ? 1.0 : 0.0;
    if (sub === "work_dress") return 1.0;
    if (sub === "cover_up") return season === "summer" ? 1.0 : 0.0;
    if (sub === "casual_dress") {
      return season === "winter" ? 0.0 : 1.0;
    }
    return season === "winter" ? 0.3 : 0.9;
  }

  if (cat === "accessories" || cat === "jewelry" || cat === "purse") {
    if (sub === "sunglasses") {
      if (season === "summer" || season === "spring") return 1.0;
      return 0.6;
    }
    if (sub === "beach_bag") return season === "summer" ? 1.0 : 0.1;
    return 1.0;
  }

  return 0.9;
}

function seasonalScore(items: ClothingItem[], season: Season): number {
  if (items.length === 0) return 0.9;
  let total = 0;
  let blocked = false;
  for (const item of items) {
    const fit = getItemSeasonalFit(item, season);
    if (fit === 0.0) blocked = true;
    total += fit;
  }
  if (blocked) return 0.0;
  return total / items.length;
}

// --- Hardware Colour Matching ---

const HARDWARE_COMPATIBLE: Record<string, string[]> = {
  gold: ["gold", "rose_gold"],
  rose_gold: ["rose_gold", "gold"],
  silver: ["silver", "gunmetal"],
  gunmetal: ["gunmetal", "silver"],
  black: ["black"],
  bronze: ["bronze"],
};

function hardwareCompatibility(items: ClothingItem[]): number {
  const withHardware = items.filter((i) => i.hardwareColour);
  if (withHardware.length < 2) return 1.0;

  let totalScore = 0;
  let pairs = 0;

  for (let i = 0; i < withHardware.length; i++) {
    for (let j = i + 1; j < withHardware.length; j++) {
      const a = withHardware[i].hardwareColour!;
      const b = withHardware[j].hardwareColour!;
      if (a === b) totalScore += 1.0;
      else if (HARDWARE_COMPATIBLE[a]?.includes(b)) totalScore += 0.8;
      else totalScore += 0.4;
      pairs++;
    }
  }

  return pairs > 0 ? totalScore / pairs : 1.0;
}

// --- Work Outfit Rules ---

/** Items that should NEVER appear in a work outfit */
const WORK_BLOCKED_SUBCATEGORIES: string[] = [
  "casual", "leggings", "sweatpants", // bottoms
  "hoodie", "lounge_shirt", "sport", // tops
  "casual_shorts", "athletic_shorts", // shorts
  "skort", "mini_skirt", // skirts (skort and mini)
  "party_dress", "sundress", "cover_up", "casual_jumpsuit", // dresses/jumpsuits
  "casual_sandals", "birks", "running_shoes", "soccer_shoes", // shoes
  "beach_bag", // purse
];

const WORK_BLOCKED_CATEGORIES: ClothingCategory[] = [
  "shorts", // never wear shorts to work
  "swimwear",
];

/** Jeans are OK for work on Fridays but penalized other days */
function isJeansItem(item: ClothingItem): boolean {
  return item.category === "bottoms" && item.subCategory === "jeans";
}

/** Items that are too casual to pair with formal items */
const CASUAL_ONLY_SUBS: string[] = [
  "hoodie", "sweatshirt", "lounge_shirt", "sport",
  "sweatpants", "leggings",
  "casual_shorts", "athletic_shorts",
  "running_shoes", "soccer_shoes",
];

const FORMAL_ITEM_SUBS: string[] = [
  "trousers", "formal_blazer", "casual_blazer",
  "heels", "loafers", "blouse",
];

// Volume/silhouette pairings that work well
const SLIM_SUBS = ["leggings", "skinny", "pencil_skirt", "mini_skirt"];
const LOOSE_SUBS = ["hoodie", "sweatshirt", "oversized", "wide_leg"];

/**
 * Check if an outfit violates style pairing rules.
 * Returns negative penalty for clashes, or positive bonus for great pairings.
 */
// --- Pattern / Print Compatibility ---

// Bold patterns that demand attention
const BOLD_PATTERNS: string[] = ["floral", "plaid", "animal_print", "camo", "paisley", "houndstooth", "tie_dye"];
// Subtle/regular patterns that can mix with one bold
const SUBTLE_PATTERNS: string[] = ["striped", "polka_dot", "checkered", "color_block"];
// Graphic is a wildcard — usually only one per outfit
const GRAPHIC_PATTERNS: string[] = ["graphic", "abstract"];

/**
 * Evaluate how well the patterns in an outfit work together.
 * Returns a score from 0 to 1 (1 = perfect pattern pairing).
 *
 * Rules (real styling best-practices):
 *  1. All solids = safe, always works (1.0)
 *  2. One patterned piece + rest solid = great (0.95)
 *  3. One bold + one subtle (different scales) + solids = intentional mix (0.80)
 *  4. Two bold patterns = clash unless they share the same pattern type (0.40-0.55)
 *  5. 3+ patterned items = risky (0.30-0.50)
 *  6. Matching pattern types (e.g., two stripes) get a small penalty for being matchy-matchy (0.65)
 *  7. Graphic tees: max 1 per outfit
 */
export function patternCompatibility(items: ClothingItem[]): { score: number; note: string } {
  const patterns = items.map((i) => i.pattern ?? "solid");
  const nonSolid = patterns.filter((p) => p !== "solid");
  const solidCount = patterns.length - nonSolid.length;

  // All solid — always works
  if (nonSolid.length === 0) {
    return { score: 1.0, note: "Clean solid palette" };
  }

  // One pattern + rest solid — classic approach
  if (nonSolid.length === 1) {
    const thePattern = nonSolid[0];
    if (GRAPHIC_PATTERNS.includes(thePattern)) {
      return { score: 0.92, note: `${thePattern} as statement piece` };
    }
    return { score: 0.95, note: "Single pattern anchored by solids" };
  }

  // Two patterned items
  if (nonSolid.length === 2) {
    const [a, b] = nonSolid;
    const aBold = BOLD_PATTERNS.includes(a);
    const bBold = BOLD_PATTERNS.includes(b);
    const aGraphic = GRAPHIC_PATTERNS.includes(a);
    const bGraphic = GRAPHIC_PATTERNS.includes(b);

    // Two graphics = too busy
    if (aGraphic && bGraphic) {
      return { score: 0.30, note: "Two graphic pieces compete for attention" };
    }
    // Same pattern type = matchy-matchy (not terrible, but not ideal)
    if (a === b) {
      return { score: 0.65, note: `Double ${a} — consider varying the scale` };
    }
    // One bold + one subtle = intentional pattern mixing (great styling)
    if ((aBold && SUBTLE_PATTERNS.includes(b)) || (bBold && SUBTLE_PATTERNS.includes(a))) {
      return { score: 0.80, note: "Intentional pattern mix — bold + subtle" };
    }
    // Two bold patterns = usually clashes
    if (aBold && bBold) {
      return { score: 0.40, note: "Two bold patterns compete — consider replacing one with a solid" };
    }
    // Two subtle patterns = can work
    if (SUBTLE_PATTERNS.includes(a) && SUBTLE_PATTERNS.includes(b)) {
      return { score: 0.72, note: "Two subtle patterns — works if scales differ" };
    }
    // Graphic + bold = loud
    if ((aGraphic && bBold) || (bGraphic && aBold)) {
      return { score: 0.35, note: "Graphic + bold pattern is very busy" };
    }
    // Graphic + subtle = can work
    if ((aGraphic && SUBTLE_PATTERNS.includes(b)) || (bGraphic && SUBTLE_PATTERNS.includes(a))) {
      return { score: 0.68, note: "Graphic with subtle pattern — keep colours aligned" };
    }

    return { score: 0.55, note: "Mixed patterns — proceed with care" };
  }

  // 3+ patterned items = very risky
  const boldCount = nonSolid.filter((p) => BOLD_PATTERNS.includes(p)).length;
  const graphicCount = nonSolid.filter((p) => GRAPHIC_PATTERNS.includes(p)).length;

  if (graphicCount >= 2 || boldCount >= 2) {
    return { score: 0.25, note: "Too many competing patterns — simplify" };
  }

  return { score: 0.40, note: `${nonSolid.length} patterns is ambitious — ensure scales vary` };
}

function getStyleClashPenalty(items: ClothingItem[]): number {
  let penalty = 0;
  const subs = items.map((i) => i.subCategory ?? "");

  // 1. Formal vs casual clash
  const hasFormalItem = items.some(
    (i) =>
      FORMAL_ITEM_SUBS.includes(i.subCategory ?? "") ||
      i.category === "blazers"
  );
  const hasCasualOnly = items.some((i) =>
    CASUAL_ONLY_SUBS.includes(i.subCategory ?? "")
  );
  if (hasFormalItem && hasCasualOnly) penalty -= 8;

  // 2. Specific bad pairings
  const hasRunningShoes = subs.includes("running_shoes") || subs.includes("soccer_shoes");
  const hasFormalDress = subs.includes("formal_dress") || subs.includes("cocktail_dress");
  if (hasRunningShoes && hasFormalDress) penalty -= 12; // athletic shoes with formal dress = big no

  const hasFlipFlops = subs.includes("casual_sandals") || subs.includes("flip_flops") || subs.includes("slides");
  const hasBlazer = items.some((i) => i.category === "blazers");
  if (hasFlipFlops && hasBlazer) penalty -= 6; // slides with a blazer is usually wrong

  // 3. Volume balance bonus: slim bottom + loose top (or vice versa) is a classic rule
  const hasSlimBottom = items.some(
    (i) => (i.category === "bottoms" || i.category === "skirts") && SLIM_SUBS.includes(i.subCategory ?? "")
  );
  const hasLooseTop = items.some(
    (i) => i.category === "tops" && LOOSE_SUBS.includes(i.subCategory ?? "")
  );
  if (hasSlimBottom && hasLooseTop) penalty += 3; // balanced proportions

  // 4. Matching metals bonus (already handled by hardware, but reinforce)
  const hwColors = items.map((i) => i.hardwareColour).filter(Boolean);
  const uniqueHW = new Set(hwColors);
  if (uniqueHW.size === 1 && hwColors.length >= 2) penalty += 2;

  // 5. "Elevated casual" bonus: denim + blazer or leather jacket
  const hasDenim = items.some((i) => i.subCategory === "jeans" || i.fabricType === "denim");
  if (hasDenim && hasBlazer) penalty += 3; // classic elevated casual

  return penalty;
}

function getWorkScore(items: ClothingItem[]): number {
  for (const item of items) {
    if (WORK_BLOCKED_CATEGORIES.includes(item.category)) return -100;
    if (item.subCategory && WORK_BLOCKED_SUBCATEGORIES.includes(item.subCategory)) return -100;
  }
  // Jeans get a small penalty for work (OK on casual Fridays)
  const hasJeans = items.some(isJeansItem);
  return hasJeans ? -3 : 0;
}

// --- Outfit Flagging ---

export interface OutfitFlag {
  id: string;
  /** Item subcategory or category combination that was flagged */
  pattern: string;
  reason: string;
  createdAt: number;
}

let cachedFlags: OutfitFlag[] | null = null;

async function loadFlags(): Promise<OutfitFlag[]> {
  if (cachedFlags) return cachedFlags;
  cachedFlags = await getOutfitFlags();
  return cachedFlags;
}

export async function flagOutfit(pattern: string, reason: string): Promise<void> {
  const flag: OutfitFlag = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 9),
    pattern,
    reason,
    createdAt: Date.now(),
  };
  await saveOutfitFlag(flag);
  cachedFlags = null; // bust cache
}

function matchesFlagPattern(items: ClothingItem[], flags: OutfitFlag[]): boolean {
  if (flags.length === 0) return false;
  const itemSubs = new Set(items.map((i) => i.subCategory ?? i.category));
  const itemCats = new Set(items.map((i) => i.category));
  for (const flag of flags) {
    const parts = flag.pattern.split("+").map((p) => p.trim());
    const allMatch = parts.every((p) => itemSubs.has(p) || itemCats.has(p));
    if (allMatch) return true;
  }
  return false;
}

// --- Outfit Rules & Validation ---

const JEWELRY_SUBS = ["earrings", "necklaces", "bracelets", "rings", "watches"];

function isOpenTop(item: ClothingItem): boolean {
  if (item.isOpen === true) return true;
  if (item.category === "blazers") return true;
  const openSubs = ["cardigan", "zip_up"];
  return !!(item.subCategory && openSubs.includes(item.subCategory));
}

function isShirtLike(item: ClothingItem): boolean {
  if (item.category !== "tops") return false;
  if (isOpenTop(item)) return false;
  const shirtSubs = ["tank_top", "tshirt", "long_sleeve", "blouse", "sweater", "sweatshirt", "hoodie", "lounge_shirt", "sport"];
  return !item.subCategory || shirtSubs.includes(item.subCategory);
}

function isDress(item: ClothingItem): boolean {
  return item.category === "dresses";
}

function isSwimOnePiece(item: ClothingItem): boolean {
  return item.category === "swimwear" && item.subCategory === "one_piece";
}

function isSwimTop(item: ClothingItem): boolean {
  return item.category === "swimwear" && item.subCategory === "top";
}

function isSwimBottom(item: ClothingItem): boolean {
  return item.category === "swimwear" && item.subCategory === "bottom";
}

function isStocking(item: ClothingItem): boolean {
  return item.category === "accessories" && item.subCategory === "stockings";
}

function isJumpsuit(item: ClothingItem): boolean {
  return item.category === "jumpsuits";
}

function isSkirtOrShorts(item: ClothingItem): boolean {
  return item.category === "skirts" || item.category === "shorts";
}

function isValidCombo(combo: ClothingItem[]): boolean {
  const hasDress = combo.some(isDress);
  const hasJumpsuit = combo.some(isJumpsuit);
  const hasBottoms = combo.some((i) => i.category === "bottoms");
  const hasSkirtShorts = combo.some(isSkirtOrShorts);
  const hasNonOpenTop = combo.some((i) => isShirtLike(i));
  const hasAnyOpenTop = combo.some((i) => isOpenTop(i));
  const hasTops = combo.some((i) => i.category === "tops");
  const hasLowerBody = hasBottoms || hasSkirtShorts;

  if ((hasDress || hasJumpsuit) && hasLowerBody) return false;
  if (hasDress && hasJumpsuit) return false;
  if (hasAnyOpenTop && !hasNonOpenTop && !hasDress && !hasJumpsuit) return false;

  const hasSwimwear = combo.some((i) => i.category === "swimwear");
  if (!hasDress && !hasSwimwear && !hasJumpsuit) {
    if (!hasTops || !hasLowerBody) return false;
  }

  const hasOnePiece = combo.some(isSwimOnePiece);
  const hasSwimTop = combo.some(isSwimTop);
  const hasSwimBottom = combo.some(isSwimBottom);

  if (hasOnePiece && (hasSwimTop || hasSwimBottom)) return false;
  if (hasSwimTop && !hasSwimBottom) return false;
  if (hasSwimBottom && !hasSwimTop) return false;
  if (hasSwimwear && hasTops) return false;
  if (hasSwimwear && (hasBottoms || hasSkirtShorts)) return false;

  return true;
}

// --- Build valid outfit combos ---

type OutfitCombo = ClothingItem[];

function getCategoryCombinations(): ClothingCategory[][] {
  return [
    // Traditional outfits with pants
    ["tops", "bottoms"],
    ["tops", "bottoms", "shoes"],
    ["tops", "bottoms", "jackets"],
    ["tops", "bottoms", "jackets", "shoes"],
    ["tops", "bottoms", "accessories"],
    ["tops", "bottoms", "shoes", "accessories"],
    ["tops", "bottoms", "jackets", "shoes", "accessories"],

    // With skirts
    ["tops", "skirts"],
    ["tops", "skirts", "shoes"],
    ["tops", "skirts", "jackets"],
    ["tops", "skirts", "jackets", "shoes"],
    ["tops", "skirts", "shoes", "accessories"],

    // With shorts
    ["tops", "shorts"],
    ["tops", "shorts", "shoes"],
    ["tops", "shorts", "jackets"],
    ["tops", "shorts", "shoes", "accessories"],

    // With blazer + bottoms
    ["tops", "bottoms", "blazers"],
    ["tops", "bottoms", "blazers", "shoes"],
    ["tops", "bottoms", "blazers", "shoes", "accessories"],

    // With blazer + skirts
    ["tops", "skirts", "blazers"],
    ["tops", "skirts", "blazers", "shoes"],
    ["tops", "skirts", "blazers", "shoes", "accessories"],

    // Blazer + jacket (layering)
    ["tops", "bottoms", "blazers", "jackets", "shoes"],

    // Dress-based outfits
    ["dresses"],
    ["dresses", "shoes"],
    ["dresses", "jackets"],
    ["dresses", "shoes", "jackets"],
    ["dresses", "accessories"],
    ["dresses", "shoes", "accessories"],
    ["dresses", "jackets", "shoes", "accessories"],
    ["dresses", "blazers"],
    ["dresses", "blazers", "shoes"],

    // Jumpsuit-based outfits
    ["jumpsuits"],
    ["jumpsuits", "shoes"],
    ["jumpsuits", "jackets"],
    ["jumpsuits", "shoes", "jackets"],
    ["jumpsuits", "blazers"],
    ["jumpsuits", "blazers", "shoes"],
    ["jumpsuits", "shoes", "accessories"],

    // Swimwear
    ["swimwear"],
    ["swimwear", "shoes"],
    ["swimwear", "accessories"],
    ["swimwear", "shoes", "accessories"],
    ["swimwear", "swimwear"],
    ["swimwear", "swimwear", "shoes"],
    ["swimwear", "swimwear", "accessories"],
    ["swimwear", "swimwear", "shoes", "accessories"],
  ];
}

function pickOnePerCategory(
  itemsByCategory: Map<ClothingCategory, ClothingItem[]>,
  categories: ClothingCategory[]
): OutfitCombo[] {
  if (categories.length === 0) return [[]];

  const [first, ...rest] = categories;
  const pool = itemsByCategory.get(first) ?? [];
  if (pool.length === 0) return [];

  // Two consecutive "swimwear" = swim top + swim bottom pair
  if (first === "swimwear" && rest.length > 0 && rest[0] === "swimwear") {
    const swimTops = pool.filter(isSwimTop);
    const swimBottoms = pool.filter(isSwimBottom);
    if (swimTops.length === 0 || swimBottoms.length === 0) return [];

    const remainingCategories = rest.slice(1);
    const subCombos = pickOnePerCategory(itemsByCategory, remainingCategories);
    const results: OutfitCombo[] = [];

    for (const top of swimTops) {
      for (const bottom of swimBottoms) {
        for (const sub of subCombos) {
          results.push([top, bottom, ...sub]);
        }
      }
    }
    return results;
  }

  // Single "swimwear" = one-piece only
  if (first === "swimwear") {
    const onePieces = pool.filter(isSwimOnePiece);
    if (onePieces.length === 0) return [];

    const subCombos = pickOnePerCategory(itemsByCategory, rest);
    const results: OutfitCombo[] = [];
    for (const item of onePieces) {
      for (const sub of subCombos) {
        results.push([item, ...sub]);
      }
    }
    return results;
  }

  const subCombos = pickOnePerCategory(itemsByCategory, rest);
  const results: OutfitCombo[] = [];

  for (const item of pool) {
    for (const sub of subCombos) {
      results.push([item, ...sub]);
    }
  }
  return results;
}

/**
 * Enrich combos with complementary accessories, stockings in winter, etc.
 */
function enrichWithAccessories(
  combo: OutfitCombo,
  allAccessories: ClothingItem[],
  allItems: ClothingItem[],
  season?: Season
): OutfitCombo {
  if (allAccessories.length === 0 && allItems.length === 0) return combo;

  const hasBottoms = combo.some((i) => i.category === "bottoms");
  const hasBlazer = combo.some((i) => i.category === "blazers");
  const isFormalish = hasBlazer;
  const hasSwimwear = combo.some((i) => i.category === "swimwear");
  const hasDress = combo.some(isDress);
  const hasSkirt = combo.some((i) => i.category === "skirts");

  const extras: ClothingItem[] = [];
  const usedSubs = new Set<string>();
  const usedIds = new Set(combo.map((i) => i.id));

  for (const item of combo) {
    if ((item.category === "accessories" || item.category === "jewelry" || item.category === "purse") && item.subCategory) {
      usedSubs.add(item.subCategory);
    }
  }

  // Add belt with pants/jeans
  if (hasBottoms && !usedSubs.has("belts")) {
    const belt = allAccessories.find((a) => a.subCategory === "belts" && !usedIds.has(a.id));
    if (belt) {
      extras.push(belt);
      usedSubs.add("belts");
      usedIds.add(belt.id);
    }
  }

  // Try to add a hat
  if (!usedSubs.has("hats")) {
    const hat = allAccessories.find((a) => a.subCategory === "hats" && !usedIds.has(a.id));
    if (hat) {
      extras.push(hat);
      usedSubs.add("hats");
      usedIds.add(hat.id);
    }
  }

  // Add jewellery pieces
  const maxJewelry = isFormalish ? 2 : 1;
  let jewelryAdded = 0;
  for (const sub of JEWELRY_SUBS) {
    if (usedSubs.has(sub) || jewelryAdded >= maxJewelry) break;
    const piece = allAccessories.find((a) => a.subCategory === sub && !usedIds.has(a.id));
    if (piece) {
      extras.push(piece);
      usedSubs.add(sub);
      usedIds.add(piece.id);
      jewelryAdded++;
    }
  }

  // Try to add a purse
  const hasPurse = combo.some((i) => i.category === "purse");
  if (!hasPurse) {
    const purse = allItems.find(
      (i) => i.category === "purse" && !usedIds.has(i.id) &&
        (hasSwimwear ? i.subCategory === "beach_bag" : i.subCategory !== "beach_bag")
    );
    if (purse) {
      extras.push(purse);
      usedIds.add(purse.id);
    }
  }

  // In winter: add stockings with dress or skirt if colour-compatible
  if (season === "winter" && (hasDress || hasSkirt)) {
    const stockings = allItems.filter(
      (i) => isStocking(i) && !usedIds.has(i.id)
    );
    if (stockings.length > 0) {
      const outfitColors = combo.map((i) => i.color);
      let bestStocking = stockings[0];
      let bestScore = 0;
      for (const s of stockings) {
        const avgCompat = outfitColors.reduce(
          (sum, c) => sum + colorCompatibility(s.color, c), 0
        ) / outfitColors.length;
        if (avgCompat > bestScore) {
          bestScore = avgCompat;
          bestStocking = s;
        }
      }
      extras.push(bestStocking);
      usedIds.add(bestStocking.id);
    }
  }

  // For swimwear: try cover-up dress
  if (hasSwimwear) {
    const hasCoverUp = combo.some((i) => i.subCategory === "cover_up");
    if (!hasCoverUp) {
      const coverUp = allItems.find(
        (i) => i.subCategory === "cover_up" && !usedIds.has(i.id)
      );
      if (coverUp) {
        extras.push(coverUp);
        usedIds.add(coverUp.id);
      }
    }
  }

  return [...combo, ...extras];
}

// --- Main Suggestion Engine ---

export interface SuggestionResult {
  items: ClothingItem[];
  score: number;
  reasons: string[];
}

export function suggestOutfits(
  allItems: ClothingItem[],
  options: {
    season?: Season;
    occasion?: Occasion;
    maxResults?: number;
    /** Past outfits with ratings for feedback-based scoring (#66) */
    ratedOutfits?: Array<{ itemIds: string[]; rating: number }>;
  } = {}
): SuggestionResult[] {
  const { season, occasion, maxResults = 6, ratedOutfits } = options;

  // Build item affinity map from rated outfits (#66)
  // Items that appeared in high-rated outfits get a boost
  const itemAffinity = new Map<string, number>();
  if (ratedOutfits) {
    for (const ro of ratedOutfits) {
      if (ro.rating >= 4) {
        for (const itemId of ro.itemIds) {
          itemAffinity.set(itemId, (itemAffinity.get(itemId) ?? 0) + (ro.rating - 3));
        }
      } else if (ro.rating <= 2) {
        for (const itemId of ro.itemIds) {
          itemAffinity.set(itemId, (itemAffinity.get(itemId) ?? 0) - 1);
        }
      }
    }
  }

  // Group items by category
  const byCategory = new Map<ClothingCategory, ClothingItem[]>();
  for (const item of allItems) {
    const list = byCategory.get(item.category) ?? [];
    list.push(item);
    byCategory.set(item.category, list);
  }

  const allAccessories = [
    ...(byCategory.get("accessories") ?? []),
    ...(byCategory.get("jewelry") ?? []),
    ...(byCategory.get("purse") ?? []),
  ];

  const allCombos: OutfitCombo[] = [];
  for (const categorySet of getCategoryCombinations()) {
    const combos = pickOnePerCategory(byCategory, categorySet);
    for (const combo of combos) {
      if (!isValidCombo(combo)) continue;
      const enriched = enrichWithAccessories(combo, allAccessories, allItems, season);
      allCombos.push(enriched);
    }
  }

  // Score each combo
  const scored: SuggestionResult[] = allCombos.map((combo) => {
    let score = 0;
    const reasons: string[] = [];

    // Color harmony — 40% weight
    const colorResult = outfitColorScore(combo);
    score += colorResult.score * 40;
    if (colorResult.score > 0.85) reasons.push("Excellent colour harmony");
    else if (colorResult.score > 0.7) reasons.push("Good colour pairing");

    // Fabric compatibility — 25% weight
    const fabric = fabricCompatibility(combo);
    score += fabric * 25;
    if (fabric > 0.8) {
      const fabricSet = [...new Set(combo.map((i) => i.fabricType).filter(Boolean))];
      if (fabricSet.length >= 2) {
        reasons.push(`${fabricSet.slice(0, 2).join(" + ")} works well together`);
      } else {
        reasons.push("Well-balanced fabrics");
      }
    }

    // Seasonal fit — 20% weight
    if (season) {
      const sFit = seasonalScore(combo, season);
      if (sFit === 0.0) {
        return { items: combo, score: -1, reasons: [] };
      }
      score += sFit * 20;
      if (sFit > 0.85) reasons.push(`Great for ${season}`);
    } else {
      score += 10;
    }

    // Baseline for non-seasonal factors — 10%
    score += 10;

    // Hardware colour matching — 5% weight
    const hw = hardwareCompatibility(combo);
    score += hw * 5;
    if (hw >= 0.95) reasons.push("Matching hardware");
    else if (hw < 0.6) reasons.push("Mixed hardware tones");

    // Work occasion rules
    if (occasion === "work") {
      const workPenalty = getWorkScore(combo);
      if (workPenalty <= -100) {
        return { items: combo, score: -1, reasons: [] };
      }
      score += workPenalty;
    }

    // Style clash penalty (e.g., running shoes with blazer)
    score += getStyleClashPenalty(combo);

    // Color temperature coherence (#74)
    const tempScore = colorTemperatureScore(combo);
    score += tempScore;
    if (tempScore >= 3) reasons.push("Cohesive colour temperature");
    else if (tempScore <= -2) reasons.push("Mixed warm and cool tones");

    // Pattern compatibility — 8% weight (deducted from base)
    const patResult = patternCompatibility(combo);
    const patScore = patResult.score;
    score += (patScore - 0.5) * 16; // ranges from -8 to +8
    if (patScore >= 0.9) reasons.push("Great pattern balance");
    else if (patScore < 0.5) reasons.push(patResult.note);

    // Jacket bonus for non-summer seasons
    if (season && season !== "summer") {
      const hasOuterwear = combo.some(
        (i) => i.category === "jackets" || i.category === "blazers"
      );
      if (hasOuterwear) {
        score += 3;
        reasons.push("Layered for the season");
      } else {
        score -= 2;
      }
    }

    // Bonus for completeness
    const categories = new Set(combo.map((i) => i.category));
    if (categories.has("shoes")) {
      score += 2;
      reasons.push("Complete with shoes");
    }
    if (categories.has("accessories") || categories.has("purse")) score += 1;
    if (categories.has("dresses")) reasons.push("Dress-based look");
    if (categories.has("blazers")) reasons.push("Polished with blazer");

    // Texture/fabric contrast bonus (silk + denim, leather + knit = intentional high-low)
    const fabrics = new Set(combo.map((i) => i.fabricType).filter(Boolean));
    if ((fabrics.has("silk") && fabrics.has("denim")) ||
        (fabrics.has("leather") && fabrics.has("wool")) ||
        (fabrics.has("cashmere") && fabrics.has("denim"))) {
      score += 2;
      reasons.push("Great fabric contrast");
    }

    // Monochromatic outfit bonus
    const comboHSLs = combo.map((i) => hexToHSL(i.color));
    const nonNeutralH = comboHSLs.filter((h) => h.s >= 15 && h.l > 10 && h.l < 90);
    if (nonNeutralH.length >= 2) {
      const maxDiff = Math.max(
        ...nonNeutralH.flatMap((a, i) => nonNeutralH.slice(i + 1).map((b) =>
          Math.min(Math.abs(a.h - b.h), 360 - Math.abs(a.h - b.h))
        ))
      );
      if (maxDiff < 15) {
        score += 3;
        reasons.push("Trendy monochromatic look");
      }
    }

    // Rating affinity bonus (#66) — items from highly-rated outfits get boosted
    if (itemAffinity.size > 0) {
      let affinityScore = 0;
      for (const item of combo) {
        affinityScore += itemAffinity.get(item.id) ?? 0;
      }
      score += Math.min(affinityScore * 0.5, 5);
      if (affinityScore >= 3) reasons.push("Items from your top-rated outfits");
    }

    // Wear recency penalty (#67) — deprioritize recently worn items
    const now = Date.now();
    const recentlyWorn = combo.filter((item) => {
      const lastWorn = item.wearDates?.[item.wearDates.length - 1];
      if (!lastWorn) return false;
      const daysSince = (now - new Date(lastWorn).getTime()) / 86400000;
      return daysSince < 3;
    });
    if (recentlyWorn.length > 0) {
      score -= recentlyWorn.length * 3;
    }
    // Boost neglected items (#67)
    const neglected = combo.filter((item) => {
      if (!item.wearDates?.length) return item.wearCount === 0;
      const lastWorn = item.wearDates[item.wearDates.length - 1];
      const daysSince = (now - new Date(lastWorn).getTime()) / 86400000;
      return daysSince > 30;
    });
    if (neglected.length >= 2) {
      score += 2;
      reasons.push("Rediscover neglected pieces");
    }

    // Winter stockings with dress/skirt bonus
    if (season === "winter") {
      const hasDressOrSkirt = combo.some(
        (i) => isDress(i) || i.category === "skirts"
      );
      const hasStockings = combo.some(isStocking);
      if (hasDressOrSkirt && hasStockings) {
        score += 2;
        reasons.push("Stockings for warmth");
      }
    }

    return { items: combo, score, reasons };
  });

  // Filter out blocked combos
  const valid = scored.filter((s) => s.score >= 0);

  // Sort by score descending
  valid.sort((a, b) => b.score - a.score);

  // Deduplicate
  const seen = new Set<string>();
  const unique: SuggestionResult[] = [];
  for (const result of valid) {
    const key = result.items.map((i) => i.id).sort().join(",");
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(result);
    }
    if (unique.length >= maxResults) break;
  }

  return unique;
}

/**
 * Validates a custom outfit (for the designer) against styling rules.
 */
export function validateOutfit(items: ClothingItem[]): string[] {
  const warnings: string[] = [];
  const hasDress = items.some(isDress);
  const hasJumpsuit = items.some(isJumpsuit);
  const hasBottoms = items.some((i) => i.category === "bottoms");
  const hasSkirtShorts = items.some(isSkirtOrShorts);
  const hasAnyOpenTop = items.some(isOpenTop);
  const hasNonOpenTop = items.some(isShirtLike);

  if ((hasDress || hasJumpsuit) && (hasBottoms || hasSkirtShorts)) {
    warnings.push("A dress or jumpsuit typically doesn't pair with separate bottoms");
  }
  if (hasDress && hasJumpsuit) {
    warnings.push("A dress and jumpsuit don't typically go together");
  }
  if (hasAnyOpenTop && !hasNonOpenTop && !hasDress && !hasJumpsuit) {
    warnings.push("Open layers (blazers, cardigans, zip-ups) usually need a shirt or top underneath");
  }
  if (items.length === 0) {
    warnings.push("Select at least one item to create an outfit");
  }

  const hasOnePiece = items.some(isSwimOnePiece);
  const hasSwimTop = items.some(isSwimTop);
  const hasSwimBottom = items.some(isSwimBottom);
  if (hasOnePiece && (hasSwimTop || hasSwimBottom)) {
    warnings.push("A one-piece swimsuit doesn't pair with separate swim tops or bottoms");
  }
  const hasSwimwear = items.some((i) => i.category === "swimwear");
  if (hasSwimwear && items.some((i) => i.category === "tops")) {
    warnings.push("Swimwear doesn't typically pair with regular tops");
  }
  if (hasSwimwear && (hasBottoms || hasSkirtShorts)) {
    warnings.push("Swimwear doesn't typically pair with regular bottoms");
  }

  // Style clash warnings
  const hasFormal = items.some(
    (i) => FORMAL_ITEM_SUBS.includes(i.subCategory ?? "") || i.category === "blazers"
  );
  const hasCasualOnly = items.some((i) => CASUAL_ONLY_SUBS.includes(i.subCategory ?? ""));
  if (hasFormal && hasCasualOnly) {
    warnings.push("Mixing very casual items (hoodies, sweats) with formal pieces may clash");
  }

  // Running/athletic shoes with dressy outfit
  const hasAthleticShoes = items.some(
    (i) => i.category === "shoes" && ["running_shoes", "soccer_shoes"].includes(i.subCategory ?? "")
  );
  const hasDressyItems = items.some(
    (i) => ["formal_dress", "cocktail_dress", "formal_blazer"].includes(i.subCategory ?? "")
  );
  if (hasAthleticShoes && hasDressyItems) {
    warnings.push("Athletic shoes don't pair well with dressy pieces — try loafers, heels, or ankle boots");
  }

  // Too many colours warning
  const nonNeutralItems = items.filter((i) => !isNeutral(i.color));
  if (nonNeutralItems.length > 3) {
    const hues = nonNeutralItems.map((i) => hexToHSL(i.color).h);
    const distinctHues = getDistinctHueCount(nonNeutralItems.map((i) => hexToHSL(i.color)));
    if (distinctHues > 3) {
      warnings.push(`${distinctHues} different colour families — try sticking to 2-3 max for a cohesive look`);
    }
  }

  // Color temperature warning (#74)
  const tempCheck = colorTemperatureScore(items);
  if (tempCheck <= -2) {
    warnings.push("Mixing warm and cool tones — consider sticking to one temperature family");
  }

  // Pattern clash warning
  const patCheck = patternCompatibility(items);
  if (patCheck.score < 0.5) {
    warnings.push(patCheck.note);
  }

  // Fabric clash warning
  const fabricTypes = new Set(items.map((i) => i.fabricType).filter(Boolean));
  if (
    (fabricTypes.has("fleece") && fabricTypes.has("silk")) ||
    (fabricTypes.has("nylon") && fabricTypes.has("satin"))
  ) {
    warnings.push("These fabrics have very different formality levels — the outfit may feel disjointed");
  }

  return warnings;
}

/* ------------------------------------------------------------------ */
/*  Outfit Building Suggestions                                        */
/* ------------------------------------------------------------------ */

/**
 * Given the items already in an outfit, suggest what to add next.
 * Returns styling tips based on colour/vibe matching.
 */
export function getNextItemSuggestion(currentItems: ClothingItem[], allItems: ClothingItem[]): string | null {
  if (currentItems.length === 0) return null;

  const cats = new Set(currentItems.map((i) => i.category));
  const hasTops = cats.has("tops");
  const hasBottoms = cats.has("bottoms") || cats.has("skirts") || cats.has("shorts");
  const hasDress = cats.has("dresses") || cats.has("jumpsuits");
  const hasShoes = cats.has("shoes");
  const hasAccessories = cats.has("accessories") || cats.has("jewelry") || cats.has("purse");

  // Check for gold/warm accents in the outfit
  const hasGoldHardware = currentItems.some((i) => i.hardwareColour === "gold" || i.hardwareColour === "rose_gold");
  const hasSilverHardware = currentItems.some((i) => i.hardwareColour === "silver" || i.hardwareColour === "gunmetal");

  const outfitColors = currentItems.map((i) => i.color);
  const avgHSL = outfitColors.reduce(
    (acc, hex) => {
      const hsl = hexToHSL(hex);
      return { h: acc.h + hsl.h, s: acc.s + hsl.s, l: acc.l + hsl.l };
    },
    { h: 0, s: 0, l: 0 }
  );
  avgHSL.h /= outfitColors.length;
  avgHSL.s /= outfitColors.length;
  avgHSL.l /= outfitColors.length;

  // Suggest based on what's missing
  if (!hasTops && !hasDress) {
    return "Start with a top or dress as the foundation of your outfit.";
  }

  if (hasTops && !hasBottoms && !hasDress) {
    return "Add bottoms, a skirt, or shorts to complete the base of your look.";
  }

  if (!hasShoes && (hasBottoms || hasDress)) {
    // Suggest shoe type based on outfit vibe
    const hasBlazer = cats.has("blazers");
    if (hasBlazer) return "Complete this polished look with loafers or heels.";
    if (avgHSL.l > 70) return "Light, airy outfit — sandals or flats would complement this.";
    return "Don't forget the shoes! They pull the whole look together.";
  }

  if (!hasAccessories && hasShoes) {
    if (hasGoldHardware) {
      return "Adding some gold jewelry would really help bring this outfit together!";
    }
    if (hasSilverHardware) {
      return "Silver-toned jewelry would beautifully tie this look together.";
    }
    const isNeutralOutfit = outfitColors.every((c) => isNeutral(c));
    if (isNeutralOutfit) {
      return "A bold-colored accessory or statement jewelry could add a pop of interest to your neutral palette.";
    }
    return "A few accessories — earrings, a necklace, or a belt — can elevate this outfit.";
  }

  // If outfit is fairly complete, suggest refinements
  if (cats.has("blazers") && !cats.has("purse")) {
    return "A structured bag or clutch would complement this polished look.";
  }

  // Pattern suggestions
  const currentPatterns = currentItems.map((i) => i.pattern ?? "solid");
  const nonSolidCount = currentPatterns.filter((p) => p !== "solid").length;
  if (nonSolidCount === 0 && currentItems.length >= 3) {
    return "All solids — a subtle patterned piece (striped scarf, polka dot bag) could add visual interest.";
  }
  if (nonSolidCount >= 2) {
    const boldPats = currentPatterns.filter((p) => BOLD_PATTERNS.includes(p));
    if (boldPats.length >= 2) {
      return "Two bold patterns compete for attention — consider swapping one for a solid piece.";
    }
  }

  // Texture suggestions
  const fabrics = new Set(currentItems.map((i) => i.fabricType).filter(Boolean));
  if (fabrics.size === 1 && currentItems.length >= 3) {
    const fabric = [...fabrics][0];
    if (fabric === "cotton" || fabric === "denim") {
      return "Adding a leather or silk piece would create appealing texture contrast.";
    }
    if (fabric === "wool" || fabric === "cashmere") {
      return "A denim or leather piece would break up the knit textures nicely.";
    }
  }

  // Monochromatic refinement
  const hsls = currentItems.map((i) => hexToHSL(i.color));
  const nonNeutral = hsls.filter((h) => h.s >= 15 && h.l > 10 && h.l < 90);
  if (nonNeutral.length >= 2) {
    const maxHueDiff = Math.max(
      ...nonNeutral.flatMap((a, i) => nonNeutral.slice(i + 1).map((b) =>
        Math.min(Math.abs(a.h - b.h), 360 - Math.abs(a.h - b.h))
      ))
    );
    if (maxHueDiff < 20) {
      return "Beautiful tonal outfit! A metallic accessory would add just the right amount of contrast.";
    }
  }

  // All neutrals suggestion
  const allNeutral = currentItems.every((i) => isNeutral(i.color));
  if (allNeutral && currentItems.length >= 3) {
    return "Chic neutral palette! A pop of colour through a shoe, bag, or scarf would bring it to life.";
  }

  return null;
}

/* ------------------------------------------------------------------ */
/*  Repeat Outfit Detector — warns about recently worn outfits          */
/* ------------------------------------------------------------------ */

/**
 * Detects whether a candidate outfit (set of clothing items) is a repeat or
 * near-repeat of any saved outfit that was worn within the last 14 days.
 *
 * - **Exact repeat**: the candidate item IDs match a saved outfit's itemIds
 *   exactly (order-independent) and that outfit was worn in the past 14 days.
 * - **Near repeat**: 80 %+ overlap in item IDs with a saved outfit worn in
 *   the past 14 days.
 *
 * When both an exact repeat and a near-repeat exist the exact repeat takes
 * priority. Among multiple matches the most-recently-worn outfit wins.
 */
export function detectRepeatOutfit(
  candidateItems: ClothingItem[],
  savedOutfits: Outfit[]
): {
  isRepeat: boolean;
  nearRepeat: boolean;
  repeatOutfitName?: string;
  daysSinceWorn?: number;
  overlapPct?: number;
} {
  const candidateIds = new Set(candidateItems.map((item) => item.id));
  const now = new Date();
  const fourteenDaysMs = 14 * 24 * 60 * 60 * 1000;

  let bestExact: {
    outfitName: string;
    daysSinceWorn: number;
  } | null = null;

  let bestNear: {
    outfitName: string;
    daysSinceWorn: number;
    overlapPct: number;
  } | null = null;

  for (const outfit of savedOutfits) {
    // Find the most recent worn date within the last 14 days
    let mostRecentDays: number | null = null;

    for (const dateStr of outfit.wornDates) {
      const wornDate = new Date(dateStr);
      const diffMs = now.getTime() - wornDate.getTime();
      if (diffMs < 0 || diffMs > fourteenDaysMs) continue;

      const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
      if (mostRecentDays === null || days < mostRecentDays) {
        mostRecentDays = days;
      }
    }

    // Skip outfits not worn within the past 14 days
    if (mostRecentDays === null) continue;

    const outfitIds = new Set(outfit.itemIds);

    // Calculate overlap
    const intersectionSize = [...candidateIds].filter((id) =>
      outfitIds.has(id)
    ).length;
    const unionSize = new Set([...candidateIds, ...outfitIds]).size;
    const overlapPct = unionSize === 0 ? 0 : intersectionSize / unionSize;

    // Exact repeat: identical sets of item IDs
    const isExact =
      candidateIds.size === outfitIds.size &&
      [...candidateIds].every((id) => outfitIds.has(id));

    if (isExact) {
      if (
        bestExact === null ||
        mostRecentDays < bestExact.daysSinceWorn
      ) {
        bestExact = {
          outfitName: outfit.name,
          daysSinceWorn: mostRecentDays,
        };
      }
    } else if (overlapPct >= 0.8) {
      if (
        bestNear === null ||
        mostRecentDays < bestNear.daysSinceWorn
      ) {
        bestNear = {
          outfitName: outfit.name,
          daysSinceWorn: mostRecentDays,
          overlapPct: Math.round(overlapPct * 100),
        };
      }
    }
  }

  // Exact repeat takes priority over near-repeat
  if (bestExact) {
    return {
      isRepeat: true,
      nearRepeat: false,
      repeatOutfitName: bestExact.outfitName,
      daysSinceWorn: bestExact.daysSinceWorn,
      overlapPct: 100,
    };
  }

  if (bestNear) {
    return {
      isRepeat: false,
      nearRepeat: true,
      repeatOutfitName: bestNear.outfitName,
      daysSinceWorn: bestNear.daysSinceWorn,
      overlapPct: bestNear.overlapPct,
    };
  }

  return { isRepeat: false, nearRepeat: false };
}

/* ------------------------------------------------------------------ */
/*  Outfit Name Generator — grounded, descriptive names                 */
/* ------------------------------------------------------------------ */

function getColorMood(items: ClothingItem[]): string {
  const colors = items.map((i) => hexToHSL(i.color));
  const avgL = colors.reduce((s, c) => s + c.l, 0) / colors.length;
  const avgS = colors.reduce((s, c) => s + c.s, 0) / colors.length;
  const avgH = colors.reduce((s, c) => s + c.h, 0) / colors.length;

  if (avgL < 25) return "dark";
  if (avgL > 80 && avgS < 20) return "light_neutral";
  if (avgL > 75) return "light";
  if (avgS < 15) return "neutral";
  if (avgH >= 0 && avgH < 40) return "warm";
  if (avgH >= 40 && avgH < 80) return "autumn";
  if (avgH >= 80 && avgH < 160) return "earthy";
  if (avgH >= 160 && avgH < 220) return "cool";
  if (avgH >= 220 && avgH < 280) return "blue";
  if (avgH >= 280 && avgH < 330) return "jewel";
  return "warm";
}

const COLOR_MOOD_DESCRIPTORS: Record<string, string[]> = {
  dark: ["Dark & Polished", "All Black", "Midnight", "Evening Edge"],
  light_neutral: ["Light and Bright", "Fresh Neutrals", "Soft & Clean", "Airy"],
  light: ["Bright Day", "Light & Easy", "Sun-Kissed", "Pastel Pop"],
  neutral: ["Classic Neutrals", "Earth Tones", "Understated", "Minimal Mix"],
  warm: ["Warm Glow", "Sunset Tones", "Rich & Warm", "Golden Hour"],
  autumn: ["Fall Vibes", "Autumn Palette", "Harvest Tones", "Cozy Warm"],
  earthy: ["Natural Tones", "Down to Earth", "Olive & Sage", "Green Scene"],
  cool: ["Cool Tones", "Ocean Breeze", "Blue-Green", "Minted"],
  blue: ["Blue Hour", "Denim Days", "Sky High", "Navy & Nice"],
  jewel: ["Jewel Tones", "Rich Hues", "Berry Beautiful", "Deep Purple"],
};

function getCategoryDescriptor(items: ClothingItem[]): string {
  const cats = new Set(items.map((i) => i.category));
  const subs = new Set(items.map((i) => i.subCategory).filter(Boolean));

  if (cats.has("blazers")) return "Blazer";
  if (cats.has("jumpsuits")) return "Jumpsuit";
  if (cats.has("swimwear")) return "Beach";
  if (cats.has("dresses")) return "Dress";
  if (subs.has("jeans")) return "Denim";
  if (subs.has("heels")) return "Heels";
  if (subs.has("trousers")) return "Trouser";
  if (subs.has("leggings") || subs.has("sport")) return "Athleisure";
  if (cats.has("jackets")) return "Layered";
  if (cats.has("skirts")) return "Skirt";
  return "";
}

function getFabricDescriptor(items: ClothingItem[]): string {
  const fabrics = new Set(items.map((i) => i.fabricType));
  if (fabrics.has("linen")) return "Linen";
  if (fabrics.has("cashmere")) return "Cashmere";
  if (fabrics.has("silk")) return "Silk";
  if (fabrics.has("leather")) return "Leather";
  if (fabrics.has("denim")) return "Denim";
  if (fabrics.has("wool") || fabrics.has("fleece")) return "Cozy";
  return "";
}

// Pattern descriptor (#94)
function getPatternDescriptor(items: ClothingItem[]): string {
  const patterns = items.map((i) => i.pattern ?? "solid").filter((p) => p !== "solid");
  if (patterns.length === 0) return "";
  const p = patterns[0];
  const map: Record<string, string> = {
    striped: "Striped", plaid: "Plaid", floral: "Floral", polka_dot: "Dotted",
    graphic: "Graphic", camo: "Camo", abstract: "Abstract", animal_print: "Wild",
    checkered: "Checkered", paisley: "Bohemian", houndstooth: "Tailored",
    tie_dye: "Tie-Dye", color_block: "Colour-Block",
  };
  return map[p] ?? "";
}

// Vibe descriptor based on overall feel (#94)
function getVibeDescriptor(items: ClothingItem[]): string {
  const subs = items.map((i) => i.subCategory ?? "");
  const cats = new Set(items.map((i) => i.category));
  const fabrics = new Set(items.map((i) => i.fabricType));

  if (subs.includes("running_shoes") || subs.includes("sport") || subs.includes("athletic_shorts")) return "Athletic";
  if (fabrics.has("cashmere") && fabrics.has("silk")) return "Luxe";
  if (cats.has("blazers") && (subs.includes("jeans") || fabrics.has("denim"))) return "Smart Casual";
  if (cats.has("blazers") && subs.includes("heels")) return "Power";
  if (fabrics.has("linen")) return "Resort";
  if (subs.includes("hoodie") || subs.includes("sweatpants")) return "Loungewear";
  if (cats.has("jackets") && cats.has("bottoms")) return "Layered";
  return "";
}

// Creative name templates (#94)
const NAME_TEMPLATES = [
  (mood: string, cat: string, _fab: string, _pat: string, _vibe: string) => cat ? `${mood} ${cat}` : mood,
  (_mood: string, cat: string, fab: string, _pat: string, _vibe: string) => fab && cat ? `${fab} ${cat} Look` : "",
  (mood: string, _cat: string, _fab: string, pat: string, _vibe: string) => pat ? `${pat} ${mood}` : "",
  (_mood: string, _cat: string, _fab: string, _pat: string, vibe: string) => vibe ? `${vibe} Moment` : "",
  (mood: string, _cat: string, _fab: string, _pat: string, vibe: string) => vibe ? `${vibe} ${mood}` : "",
  (_mood: string, cat: string, _fab: string, _pat: string, vibe: string) => vibe && cat ? `${vibe} ${cat}` : "",
  (mood: string, cat: string, _fab: string, _pat: string, _vibe: string) => {
    const suffixes = ["Edit", "Moment", "Day", "Look", "Vibe", "Energy", "Hour"];
    return cat ? `${cat} ${suffixes[Math.floor(Math.random() * suffixes.length)]}` : `${mood} ${suffixes[Math.floor(Math.random() * suffixes.length)]}`;
  },
];

/** Generate a creative, descriptive outfit name based on items (#94 enhanced) */
export function generateOutfitName(items: ClothingItem[]): string {
  if (items.length === 0) return "New Outfit";

  const mood = getColorMood(items);
  const moodOptions = COLOR_MOOD_DESCRIPTORS[mood] ?? COLOR_MOOD_DESCRIPTORS.neutral;
  const moodPick = moodOptions[Math.floor(Math.random() * moodOptions.length)];
  const catDesc = getCategoryDescriptor(items);
  const fabDesc = getFabricDescriptor(items);
  const patDesc = getPatternDescriptor(items);
  const vibeDesc = getVibeDescriptor(items);

  const candidates: string[] = [];

  for (const template of NAME_TEMPLATES) {
    const name = template(moodPick, catDesc, fabDesc, patDesc, vibeDesc);
    if (name && name.trim().length > 3) candidates.push(name.trim());
  }

  // Fallback options
  if (catDesc) candidates.push(`${moodPick} ${catDesc}`);
  if (fabDesc) candidates.push(`${fabDesc} ${moodPick}`);
  candidates.push(moodPick);

  // Deduplicate
  const unique = [...new Set(candidates)];
  const pick = unique[Math.floor(Math.random() * unique.length)];
  return pick.replace(/\s+/g, " ").trim();
}
