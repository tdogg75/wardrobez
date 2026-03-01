import type {
  ClothingItem,
  ClothingCategory,
  Season,
  FabricType,
} from "@/models/types";
import { hexToHSL } from "@/constants/colors";

// --- Advanced Color Harmony Rules ---

function isNeutral(hex: string): boolean {
  const { s, l } = hexToHSL(hex);
  return s < 15 || l < 15 || l > 90;
}

function colorCompatibility(hex1: string, hex2: string): number {
  const neutral1 = isNeutral(hex1);
  const neutral2 = isNeutral(hex2);

  if (neutral1 && neutral2) return 0.9;
  if (neutral1 || neutral2) return 0.85;

  const c1 = hexToHSL(hex1);
  const c2 = hexToHSL(hex2);
  const hueDiff = Math.min(Math.abs(c1.h - c2.h), 360 - Math.abs(c1.h - c2.h));

  const satDiff = Math.abs(c1.s - c2.s);
  const satBonus = satDiff < 20 ? 0.05 : satDiff < 40 ? 0.02 : 0;
  const lightDiff = Math.abs(c1.l - c2.l);
  const lightBonus = lightDiff > 15 && lightDiff < 50 ? 0.05 : 0;

  let baseScore = 0.35;

  if (hueDiff < 10) {
    baseScore = lightDiff > 15 ? 0.88 : 0.72;
  } else if (hueDiff < 30) {
    baseScore = 0.85;
  } else if (hueDiff < 60) {
    baseScore = 0.75;
  } else if (hueDiff > 120 && hueDiff < 150) {
    baseScore = 0.78;
  } else if (hueDiff > 110 && hueDiff <= 130) {
    baseScore = 0.73;
  } else if (hueDiff >= 150 && hueDiff <= 210) {
    baseScore = 0.9;
  } else if (hueDiff > 80 && hueDiff <= 100) {
    baseScore = 0.65;
  } else {
    baseScore = 0.4;
  }

  return Math.min(1.0, baseScore + satBonus + lightBonus);
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
  const avgScore = totalScore / pairs;
  return { score: avgScore, hasGreatHarmony: avgScore > 0.78 };
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

// --- Comprehensive Seasonal Logic ---

/**
 * Returns a seasonal fitness score for an individual item.
 * 0.0 = hard block (never suggest this combo)
 * 0.1 = very poor fit
 * 0.5 = acceptable but not ideal
 * 0.9-1.0 = good/great fit
 */
function getItemSeasonalFit(item: ClothingItem, season: Season): number {
  const sub = item.subCategory ?? "";
  const cat = item.category;

  // --- SWIMWEAR: summer only ---
  if (cat === "swimwear") {
    return season === "summer" ? 1.0 : 0.0;
  }

  // --- SHOES ---
  if (cat === "shoes") {
    // Sandals: summer only
    if (sub === "sandals") return season === "summer" ? 1.0 : 0.0;
    // Winter boots: winter only
    if (sub === "winter_boots") return season === "winter" ? 1.0 : 0.0;
    // Ankle boots: any season (short boots)
    if (sub === "ankle_boots") return 1.0;
    // Knee-high boots / dress boots: any season except summer
    if (sub === "knee_boots" || sub === "dress_boots") {
      return season === "summer" ? 0.0 : 1.0;
    }
    // Flats, loafers, running shoes: year-round
    if (["flats", "loafers", "running_shoes", "soccer_shoes"].includes(sub)) return 0.9;
    // Heels: year-round
    if (sub === "heels") return 0.9;
    return 0.9;
  }

  // --- JACKETS ---
  if (cat === "jackets") {
    // Winter jackets: winter only
    if (sub === "parka" || sub === "ski_jacket") {
      return season === "winter" ? 1.0 : 0.0;
    }
    // Jean jacket / spring jacket: spring, summer, fall (not winter as sole jacket)
    if (sub === "jean_jacket" || sub === "spring_jacket") {
      if (season === "spring" || season === "fall") return 1.0;
      if (season === "summer") return 0.7;
      return 0.3; // winter: too light alone
    }
    // Raincoat: spring and fall primarily
    if (sub === "raincoat") {
      if (season === "spring" || season === "fall") return 1.0;
      if (season === "summer") return 0.5;
      return 0.6;
    }
    // Work jacket: year-round
    if (sub === "work_jacket") return 1.0;
    return 0.9;
  }

  // --- BLAZERS: year-round layering ---
  if (cat === "blazers") return 1.0;

  // --- TOPS ---
  if (cat === "tops") {
    // Tank tops: summer only
    if (sub === "tank_top") {
      return season === "summer" ? 1.0 : 0.0;
    }
    // Sweaters, hoodies, sweatshirts: year-round (layering)
    if (["sweater", "hoodie", "sweatshirt", "cardigan", "zip_up"].includes(sub)) return 1.0;
    // T-shirts, polos: spring/summer/fall, not great standalone in winter
    if (["tshirt", "polo", "workout_shirt"].includes(sub)) {
      if (season === "winter") return 0.6; // can layer under jacket
      return 1.0;
    }
    // Long sleeve, blouse: year-round
    return 0.9;
  }

  // --- BOTTOMS ---
  if (cat === "bottoms") {
    // White pants in winter is a faux pas
    if (season === "winter") {
      const { l } = hexToHSL(item.color);
      if (l > 90) return 0.3;
    }
    return 0.9;
  }

  // --- SKIRTS & SHORTS ---
  if (cat === "skirts_shorts") {
    // Shorts: summer only
    if (sub === "casual_shorts" || sub === "athletic_shorts" || sub === "dressy_shorts") {
      return season === "summer" ? 1.0 : 0.0;
    }
    // Skorts: spring/summer
    if (sub === "skort") {
      return (season === "summer" || season === "spring") ? 1.0 : 0.0;
    }
    // Mini skirts: spring/summer/fall
    if (sub === "mini_skirt") {
      return season === "winter" ? 0.3 : 0.9;
    }
    // Midi/maxi skirts: year-round
    return 0.9;
  }

  // --- JUMPSUITS ---
  if (cat === "jumpsuits") {
    if (season === "winter") return 0.5;
    return 0.9;
  }

  // --- DRESSES ---
  if (cat === "dresses") {
    // Sundresses: summer only
    if (sub === "sundress") return season === "summer" ? 1.0 : 0.0;
    // Work dresses: any season
    if (sub === "work_dress") return 1.0;
    // Cover-ups: summer only
    if (sub === "cover_up") return season === "summer" ? 1.0 : 0.0;
    // Formal dresses: any season
    if (sub === "formal_dress") return 1.0;
    // Casual dresses: any season except winter
    if (sub === "casual_dress") {
      return season === "winter" ? 0.0 : 1.0;
    }
    // Default dress: any season except winter
    return season === "winter" ? 0.3 : 0.9;
  }

  // --- ACCESSORIES & JEWELRY: year-round ---
  if (cat === "accessories" || cat === "jewelry") {
    // Sunglasses: best in summer/spring
    if (sub === "sunglasses") {
      if (season === "summer" || season === "spring") return 1.0;
      return 0.6;
    }
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

function isStocking(item: ClothingItem): boolean {
  return item.category === "accessories" && item.subCategory === "stockings";
}

function isJumpsuit(item: ClothingItem): boolean {
  return item.category === "jumpsuits";
}

function isSkirtOrShorts(item: ClothingItem): boolean {
  return item.category === "skirts_shorts";
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

  // Dress/jumpsuit + regular bottoms conflict
  if ((hasDress || hasJumpsuit) && hasLowerBody) return false;
  // Jumpsuit + dress conflict
  if (hasDress && hasJumpsuit) return false;

  // Open tops need a non-open top underneath (unless dress/jumpsuit)
  if (hasAnyOpenTop && !hasNonOpenTop && !hasDress && !hasJumpsuit) return false;

  // Regular outfits need at minimum a top + bottoms/skirt
  const hasSwimwear = combo.some((i) => i.category === "swimwear");
  if (!hasDress && !hasSwimwear && !hasJumpsuit) {
    if (!hasTops || !hasLowerBody) return false;
  }

  // Swimwear rules
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

    // With skirts/shorts
    ["tops", "skirts_shorts"],
    ["tops", "skirts_shorts", "shoes"],
    ["tops", "skirts_shorts", "jackets"],
    ["tops", "skirts_shorts", "jackets", "shoes"],
    ["tops", "skirts_shorts", "shoes", "accessories"],

    // With blazer + bottoms
    ["tops", "bottoms", "blazers"],
    ["tops", "bottoms", "blazers", "shoes"],
    ["tops", "bottoms", "blazers", "shoes", "accessories"],

    // With blazer + skirts/shorts
    ["tops", "skirts_shorts", "blazers"],
    ["tops", "skirts_shorts", "blazers", "shoes"],
    ["tops", "skirts_shorts", "blazers", "shoes", "accessories"],

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
  const hasSkirt = combo.some((i) => i.category === "skirts_shorts" && (i.subCategory?.includes("skirt") || i.subCategory === "skort"));

  const extras: ClothingItem[] = [];
  const usedSubs = new Set<string>();
  const usedIds = new Set(combo.map((i) => i.id));

  for (const item of combo) {
    if ((item.category === "accessories" || item.category === "jewelry") && item.subCategory) {
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

  // In winter: add stockings with dress or skirt if colour-compatible
  if (season === "winter" && (hasDress || hasSkirt)) {
    const stockings = allItems.filter(
      (i) => isStocking(i) && !usedIds.has(i.id)
    );
    if (stockings.length > 0) {
      // Find one that matches the outfit's colour palette
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

  // For swimwear: try cover-up
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
    maxResults?: number;
  } = {}
): SuggestionResult[] {
  const { season, maxResults = 6 } = options;

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
    if (fabric > 0.8) reasons.push("Well-balanced fabrics");

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

    // Jacket bonus for non-summer seasons
    if (season && season !== "summer") {
      const hasOuterwear = combo.some(
        (i) => i.category === "jackets" || i.category === "blazers"
      );
      if (hasOuterwear) {
        score += 3;
        reasons.push("Layered for the season");
      } else {
        // Penalize outfits without a jacket/blazer in cooler seasons
        score -= 2;
      }
    }

    // Bonus for completeness
    const categories = new Set(combo.map((i) => i.category));
    if (categories.has("shoes")) {
      score += 2;
      reasons.push("Complete with shoes");
    }
    if (categories.has("accessories")) score += 1;
    if (categories.has("dresses")) reasons.push("Dress-based look");
    if (categories.has("blazers")) reasons.push("Polished with blazer");

    // Winter stockings with dress/skirt bonus
    if (season === "winter") {
      const hasDressOrSkirt = combo.some(
        (i) => isDress(i) || isSkirtOrShorts(i)
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

  return warnings;
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
  if (subs.has("leggings")) return "Athleisure";
  if (cats.has("jackets")) return "Layered";
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

/** Generate a descriptive, grounded outfit name based on items */
export function generateOutfitName(items: ClothingItem[]): string {
  if (items.length === 0) return "New Outfit";

  const mood = getColorMood(items);
  const moodOptions = COLOR_MOOD_DESCRIPTORS[mood] ?? COLOR_MOOD_DESCRIPTORS.neutral;
  const catDesc = getCategoryDescriptor(items);
  const fabDesc = getFabricDescriptor(items);

  const candidates: string[] = [];

  // Combine mood with category: "Fall Vibes Blazer", "Light and Bright Denim"
  if (catDesc) {
    const moodPick = moodOptions[Math.floor(Math.random() * moodOptions.length)];
    candidates.push(`${moodPick} ${catDesc}`);
  }

  // Fabric + mood: "Linen Light & Easy"
  if (fabDesc && fabDesc !== catDesc) {
    const moodPick = moodOptions[Math.floor(Math.random() * moodOptions.length)];
    candidates.push(`${fabDesc} ${moodPick}`);
  }

  // Standalone mood descriptor
  candidates.push(moodOptions[Math.floor(Math.random() * moodOptions.length)]);

  // Category + simple descriptor
  if (catDesc) {
    const simple = ["Day", "Look", "Style", "Outfit"];
    candidates.push(`${catDesc} ${simple[Math.floor(Math.random() * simple.length)]}`);
  }

  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  return pick.replace(/\s+/g, " ").trim();
}
