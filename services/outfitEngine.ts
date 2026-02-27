import type {
  ClothingItem,
  ClothingCategory,
  Occasion,
  Season,
  FabricType,
  Outfit,
  HardwareColour,
} from "@/models/types";
import { hexToHSL } from "@/constants/colors";

// --- Advanced Color Harmony Rules ---

function isNeutral(hex: string): boolean {
  const { s, l } = hexToHSL(hex);
  return s < 15 || l < 15 || l > 90;
}

/**
 * Sophisticated color wheel matching.
 * Uses HSL values to determine harmony type and score accordingly.
 * Considers hue distance, saturation balance, and lightness contrast.
 */
function colorCompatibility(hex1: string, hex2: string): number {
  const neutral1 = isNeutral(hex1);
  const neutral2 = isNeutral(hex2);

  // Two neutrals always work well together
  if (neutral1 && neutral2) return 0.9;
  // A neutral + any color is good
  if (neutral1 || neutral2) return 0.85;

  const c1 = hexToHSL(hex1);
  const c2 = hexToHSL(hex2);
  const hueDiff = Math.min(Math.abs(c1.h - c2.h), 360 - Math.abs(c1.h - c2.h));

  // Saturation balance bonus: similar saturation levels harmonize better
  const satDiff = Math.abs(c1.s - c2.s);
  const satBonus = satDiff < 20 ? 0.05 : satDiff < 40 ? 0.02 : 0;

  // Lightness contrast bonus: some contrast in lightness is pleasing
  const lightDiff = Math.abs(c1.l - c2.l);
  const lightBonus = lightDiff > 15 && lightDiff < 50 ? 0.05 : 0;

  let baseScore = 0.35;

  // Exact/near match (monochromatic)
  if (hueDiff < 10) {
    baseScore = lightDiff > 15 ? 0.88 : 0.72;
  }
  // Analogous (within 30°)
  else if (hueDiff < 30) {
    baseScore = 0.85;
  }
  // Near-analogous (30-60°)
  else if (hueDiff < 60) {
    baseScore = 0.75;
  }
  // Split-complementary (120-150°)
  else if (hueDiff > 120 && hueDiff < 150) {
    baseScore = 0.78;
  }
  // Triadic (around 120°)
  else if (hueDiff > 110 && hueDiff <= 130) {
    baseScore = 0.73;
  }
  // Complementary (150-210°)
  else if (hueDiff >= 150 && hueDiff <= 210) {
    baseScore = 0.9;
  }
  // Tetradic / square (around 90°)
  else if (hueDiff > 80 && hueDiff <= 100) {
    baseScore = 0.65;
  }
  // Awkward middle zone
  else {
    baseScore = 0.4;
  }

  return Math.min(1.0, baseScore + satBonus + lightBonus);
}

/**
 * Calculate color harmony for an outfit considering both primary and secondary colors.
 */
function outfitColorScore(items: ClothingItem[]): { score: number; hasGreatHarmony: boolean } {
  if (items.length < 2) return { score: 0.85, hasGreatHarmony: false };

  const allColors: string[] = [];
  for (const item of items) {
    allColors.push(item.color);
    if (item.secondaryColor) {
      allColors.push(item.secondaryColor);
    }
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

  const avgScore = totalScore / pairs;

  return {
    score: avgScore,
    hasGreatHarmony: avgScore > 0.78,
  };
}

// --- Fabric Compatibility ---

const FORMAL_FABRICS: FabricType[] = ["silk", "wool", "cashmere", "leather", "satin"];
const CASUAL_FABRICS: FabricType[] = ["cotton", "denim", "linen", "nylon", "polyester", "fleece"];

function fabricCompatibility(items: ClothingItem[]): number {
  const types = items.map((i) => i.fabricType);
  const uniqueTypes = new Set(types);

  if (uniqueTypes.size === 1) return 0.9;

  const hasFormal = types.some((t) => FORMAL_FABRICS.includes(t));
  const hasCasual = types.some((t) => CASUAL_FABRICS.includes(t));

  if (hasFormal && hasCasual) {
    const formalCount = types.filter((t) => FORMAL_FABRICS.includes(t)).length;
    const casualCount = types.filter((t) => CASUAL_FABRICS.includes(t)).length;
    const balance = Math.min(formalCount, casualCount) / Math.max(formalCount, casualCount);
    return 0.6 + balance * 0.2;
  }

  return 0.85;
}

// --- Seasonal Logic ---

/** Items that are only appropriate in certain seasons */
const WINTER_ONLY_SUBS = ["winter_boots", "ski_jacket", "parka"];
const SUMMER_ONLY_SUBS = ["sandals", "sundress"];
const WARM_SEASON_SUBS = ["shorts", "tank_top", "sandals", "sundress", "cover_up"];
const COLD_SEASON_SUBS = ["winter_boots", "parka", "ski_jacket"];

/** Year-round layering items */
const YEAR_ROUND_SUBS = [
  "blazer", "casual_blazer", "formal_blazer", "sport_coat",
  "sweater", "hoodie", "sweatshirt",
  "work_jacket",
];

function getItemSeasonalFit(item: ClothingItem, season: Season): number {
  const sub = item.subCategory ?? "";

  // Year-round items always score well
  if (YEAR_ROUND_SUBS.includes(sub)) return 1.0;

  // Blazers are always fine (layering)
  if (item.category === "blazers") return 1.0;

  // Sweaters and hoodies in tops are always fine as layering
  if (item.category === "tops" && ["sweater", "hoodie", "sweatshirt"].includes(sub)) return 1.0;

  // Season-specific penalties
  if (season === "winter") {
    if (SUMMER_ONLY_SUBS.includes(sub)) return 0.0; // no sandals in winter
    if (WARM_SEASON_SUBS.includes(sub)) return 0.1;
  }
  if (season === "summer") {
    if (WINTER_ONLY_SUBS.includes(sub)) return 0.0; // no winter boots in summer
    if (COLD_SEASON_SUBS.includes(sub)) return 0.1;
  }

  // Jean jackets and spring jackets best in spring/fall
  if (sub === "jean_jacket" || sub === "spring_jacket") {
    if (season === "spring" || season === "fall") return 1.0;
    if (season === "summer") return 0.6;
    return 0.7; // winter: can layer but not ideal as primary
  }

  // Raincoat works in spring/fall
  if (sub === "raincoat") {
    if (season === "spring" || season === "fall") return 1.0;
    return 0.5;
  }

  // Color-based seasonal reasoning — only penalize genuine faux pas
  // Don't restrict dark colors in summer or light colors in winter (except white pants)
  const { l } = hexToHSL(item.color);
  if (season === "winter") {
    // White pants in winter is a faux pas (but white tops are fine)
    if (item.category === "bottoms" && l > 90) return 0.3;
  }

  // Default: most items work in most seasons — don't be strict on colors
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
  if (blocked) return 0.0; // Hard block: don't suggest sandals+winter
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
  if (withHardware.length < 2) return 1.0; // no conflict possible

  let totalScore = 0;
  let pairs = 0;

  for (let i = 0; i < withHardware.length; i++) {
    for (let j = i + 1; j < withHardware.length; j++) {
      const a = withHardware[i].hardwareColour!;
      const b = withHardware[j].hardwareColour!;
      if (a === b) {
        totalScore += 1.0; // exact match
      } else if (HARDWARE_COMPATIBLE[a]?.includes(b)) {
        totalScore += 0.8; // compatible pair
      } else {
        totalScore += 0.4; // mismatched
      }
      pairs++;
    }
  }

  return pairs > 0 ? totalScore / pairs : 1.0;
}

// --- Outfit Rules & Validation ---

const JEWELRY_SUBS = ["earrings", "necklaces", "bracelets", "rings", "watches"];

function isBlazer(item: ClothingItem): boolean {
  return item.category === "blazers";
}

/**
 * Check if an item is an "open" top — requires a non-open top underneath.
 * Blazers are always open. Cardigans and zip-ups are always open.
 * Items with isOpen === true are open.
 */
function isOpenTop(item: ClothingItem): boolean {
  if (item.isOpen === true) return true;
  if (item.category === "blazers") return true;
  const openSubs = ["cardigan", "zip_up"];
  return !!(item.subCategory && openSubs.includes(item.subCategory));
}

/**
 * Non-open shirt-like top that can serve as a layer underneath open tops.
 */
function isShirtLike(item: ClothingItem): boolean {
  if (item.category !== "tops") return false;
  if (isOpenTop(item)) return false;
  const shirtSubs = ["tank_top", "tshirt", "long_sleeve", "blouse", "sweater", "sweatshirt", "hoodie", "polo", "workout_shirt"];
  return !item.subCategory || shirtSubs.includes(item.subCategory);
}

function isDress(item: ClothingItem): boolean {
  return item.category === "dresses";
}

function isSwimOnePiece(item: ClothingItem): boolean {
  return item.category === "swimwear" && item.subCategory === "one_piece";
}

function isSwimTop(item: ClothingItem): boolean {
  return item.category === "swimwear" && item.subCategory === "swim_top";
}

function isSwimBottom(item: ClothingItem): boolean {
  return item.category === "swimwear" && item.subCategory === "swim_bottom";
}

/**
 * Validates outfit combos against styling rules.
 */
function isValidCombo(combo: ClothingItem[]): boolean {
  const hasDress = combo.some(isDress);
  const hasBottoms = combo.some((i) => i.category === "bottoms");
  const hasNonOpenTop = combo.some((i) => isShirtLike(i));
  const hasAnyOpenTop = combo.some((i) => isOpenTop(i));
  const hasTops = combo.some((i) => i.category === "tops");

  if (hasDress && hasBottoms) return false;

  // Any open top (blazer, cardigan, zip-up, or isOpen items) needs a non-open top underneath
  if (hasAnyOpenTop && !hasNonOpenTop && !hasDress) return false;

  // Regular (non-swim, non-dress) outfits must have at minimum a top + bottoms
  const hasSwimwear = combo.some((i) => i.category === "swimwear");
  if (!hasDress && !hasSwimwear) {
    if (!hasTops || !hasBottoms) return false;
  }

  // Swimwear rules:
  const hasOnePiece = combo.some(isSwimOnePiece);
  const hasSwimTop = combo.some(isSwimTop);
  const hasSwimBottom = combo.some(isSwimBottom);

  // One piece can't combine with swim tops or swim bottoms
  if (hasOnePiece && (hasSwimTop || hasSwimBottom)) return false;

  // Swim top+bottom must come as a pair (not just one)
  if (hasSwimTop && !hasSwimBottom) return false;
  if (hasSwimBottom && !hasSwimTop) return false;

  // Swimwear shouldn't combine with regular tops or bottoms
  if (hasSwimwear && hasTops) return false;
  if (hasSwimwear && hasBottoms) return false;

  return true;
}

// --- Build valid outfit combos ---

type OutfitCombo = ClothingItem[];

function getCategoryCombinations(): ClothingCategory[][] {
  return [
    // Traditional outfits
    ["tops", "bottoms"],
    ["tops", "bottoms", "shoes"],
    ["tops", "bottoms", "jackets"],
    ["tops", "bottoms", "jackets", "shoes"],
    ["tops", "bottoms", "accessories"],
    ["tops", "bottoms", "shoes", "accessories"],
    ["tops", "bottoms", "jackets", "shoes", "accessories"],

    // With blazer
    ["tops", "bottoms", "blazers"],
    ["tops", "bottoms", "blazers", "shoes"],
    ["tops", "bottoms", "blazers", "shoes", "accessories"],

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

    // Swimwear — one-piece (single pick) or swim top + swim bottom (double pick)
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

  // Special handling: when we see two consecutive "swimwear" entries,
  // pick one swim top + one swim bottom pair instead of two arbitrary items.
  if (first === "swimwear" && rest.length > 0 && rest[0] === "swimwear") {
    const swimTops = pool.filter(isSwimTop);
    const swimBottoms = pool.filter(isSwimBottom);
    if (swimTops.length === 0 || swimBottoms.length === 0) return [];

    const remainingCategories = rest.slice(1); // skip the second "swimwear"
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

  // Single "swimwear" entry: for one-piece swimsuits (or cover-ups as solo items)
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
 * Enrich combos with complementary accessories where appropriate.
 */
function enrichWithAccessories(
  combo: OutfitCombo,
  allAccessories: ClothingItem[],
  allItems: ClothingItem[]
): OutfitCombo {
  if (allAccessories.length === 0 && allItems.length === 0) return combo;

  const hasBottoms = combo.some((i) => i.category === "bottoms");
  const hasBlazer = combo.some((i) => i.category === "blazers");
  const isFormalish = hasBlazer;
  const hasSwimwear = combo.some((i) => i.category === "swimwear");

  const extras: ClothingItem[] = [];
  const usedSubs = new Set<string>();
  const usedIds = new Set(combo.map((i) => i.id));

  for (const item of combo) {
    if ((item.category === "accessories" || item.category === "jewelry") && item.subCategory) {
      usedSubs.add(item.subCategory);
    }
  }

  // Add a belt when wearing pants/jeans
  if (hasBottoms && !usedSubs.has("belts")) {
    const belt = allAccessories.find((a) => a.subCategory === "belts" && !usedIds.has(a.id));
    if (belt) {
      extras.push(belt);
      usedSubs.add("belts");
      usedIds.add(belt.id);
    }
  }

  // Try to add a hat when available
  if (!usedSubs.has("hats")) {
    const hat = allAccessories.find((a) => a.subCategory === "hats" && !usedIds.has(a.id));
    if (hat) {
      extras.push(hat);
      usedSubs.add("hats");
      usedIds.add(hat.id);
    }
  }

  // Add jewellery pieces (watches, necklaces, etc.)
  // For formal outfits allow up to 2, for others allow 1
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

  // For swimwear outfits, try to add a cover-up from swimwear subcategory
  if (hasSwimwear) {
    const hasCoverUp = combo.some(
      (i) => i.subCategory === "cover_up"
    );
    if (!hasCoverUp) {
      const coverUp = allItems.find(
        (i) =>
          i.subCategory === "cover_up" &&
          !usedIds.has(i.id)
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
    occasion?: Occasion;
    season?: Season;
    maxResults?: number;
  } = {}
): SuggestionResult[] {
  const { occasion, season, maxResults = 6 } = options;

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
  ];

  const allCombos: OutfitCombo[] = [];
  for (const categorySet of getCategoryCombinations()) {
    const combos = pickOnePerCategory(byCategory, categorySet);
    for (const combo of combos) {
      if (!isValidCombo(combo)) continue;
      const enriched = enrichWithAccessories(combo, allAccessories, allItems);
      allCombos.push(enriched);
    }
  }

  // Score each combo
  const scored: SuggestionResult[] = allCombos.map((combo) => {
    let score = 0;
    const reasons: string[] = [];

    // Color harmony (using advanced scoring) — 40% weight
    const colorResult = outfitColorScore(combo);
    score += colorResult.score * 40;
    if (colorResult.score > 0.85) reasons.push("Excellent color harmony");
    else if (colorResult.score > 0.7) reasons.push("Good color pairing");

    // Fabric compatibility — 25% weight
    const fabric = fabricCompatibility(combo);
    score += fabric * 25;
    if (fabric > 0.8) reasons.push("Well-balanced fabrics");

    // Seasonal fit — 20% weight
    if (season) {
      const sFit = seasonalScore(combo, season);
      if (sFit === 0.0) {
        // Hard block — skip this combo entirely
        return { items: combo, score: -1, reasons: [] };
      }
      score += sFit * 20;
      if (sFit > 0.85) reasons.push(`Great for ${season}`);
    } else {
      score += 10;
    }

    // Occasion is now on outfits, not items, so just give a baseline
    if (occasion) {
      score += 10;
    } else {
      score += 10;
    }

    // Hardware colour matching — 5% weight (small bonus/penalty)
    const hw = hardwareCompatibility(combo);
    score += hw * 5;
    if (hw >= 0.95) reasons.push("Matching hardware");
    else if (hw < 0.6) reasons.push("Mixed hardware tones");

    // Bonus for completeness
    const categories = new Set(combo.map((i) => i.category));
    if (categories.has("shoes")) {
      score += 2;
      reasons.push("Complete with shoes");
    }
    if (categories.has("accessories")) score += 1;
    if (categories.has("dresses")) reasons.push("Dress-based look");
    if (categories.has("blazers")) reasons.push("Polished with blazer");

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
 * Validates a custom outfit (for the designer) against the same rules.
 * Returns an array of warnings (empty = valid).
 */
export function validateOutfit(items: ClothingItem[]): string[] {
  const warnings: string[] = [];
  const hasDress = items.some(isDress);
  const hasBottoms = items.some((i) => i.category === "bottoms");
  const hasAnyOpenTop = items.some(isOpenTop);
  const hasNonOpenTop = items.some(isShirtLike);

  if (hasDress && hasBottoms) {
    warnings.push("A dress typically doesn't pair with pants or bottoms");
  }
  if (hasAnyOpenTop && !hasNonOpenTop && !hasDress) {
    warnings.push("Open layers (blazers, cardigans, zip-ups) usually need a shirt or top underneath");
  }
  if (items.length === 0) {
    warnings.push("Select at least one item to create an outfit");
  }

  // Swimwear warnings
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
  if (hasSwimwear && hasBottoms) {
    warnings.push("Swimwear doesn't typically pair with regular bottoms");
  }

  return warnings;
}
