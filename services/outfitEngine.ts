import type {
  ClothingItem,
  ClothingCategory,
  Occasion,
  FabricType,
  Outfit,
} from "@/models/types";
import { hexToHSL } from "@/constants/colors";

// --- Color Harmony Rules ---

function isNeutral(hex: string): boolean {
  const { s, l } = hexToHSL(hex);
  return s < 15 || l < 15 || l > 90;
}

function colorCompatibility(hex1: string, hex2: string): number {
  if (isNeutral(hex1) || isNeutral(hex2)) return 0.85;

  const c1 = hexToHSL(hex1);
  const c2 = hexToHSL(hex2);
  const hueDiff = Math.min(Math.abs(c1.h - c2.h), 360 - Math.abs(c1.h - c2.h));

  // Complementary
  if (hueDiff > 150 && hueDiff < 210) return 0.9;
  // Analogous
  if (hueDiff < 45) return 0.8;
  // Monochromatic
  if (hueDiff < 10) return 0.75;
  // Triadic
  if (hueDiff > 110 && hueDiff < 130) return 0.7;

  return 0.4;
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

// --- Occasion Logic ---

function occasionScore(items: ClothingItem[], targetOccasion: Occasion): number {
  if (items.length === 0) return 0;
  const matchCount = items.filter((i) => i.occasions.includes(targetOccasion)).length;
  return matchCount / items.length;
}

// --- Outfit Rules & Validation ---

const JEWELRY_SUBS = ["earrings", "necklaces", "bracelets", "rings"];

function isBlazer(item: ClothingItem): boolean {
  return item.category === "tops" && item.subCategory === "blazer";
}

function isShirtLike(item: ClothingItem): boolean {
  if (item.category !== "tops") return false;
  const shirtSubs = ["tank_top", "tshirt", "long_sleeve", "blouse", "sweater", "sweatshirt", "hoodie", "workout_shirt"];
  return !item.subCategory || shirtSubs.includes(item.subCategory);
}

function isDress(item: ClothingItem): boolean {
  return item.category === "dresses";
}

/**
 * Validates outfit combos against styling rules:
 * - A dress does NOT pair with bottoms
 * - A dress CAN pair with outerwear/blazer, shoes, accessories
 * - A blazer must have a shirt underneath (or a dress)
 * - T-shirts and tank tops CAN go with a blazer
 * - No duplicate categories (except accessories)
 */
function isValidCombo(combo: ClothingItem[]): boolean {
  const hasDress = combo.some(isDress);
  const hasBottoms = combo.some((i) => i.category === "bottoms");
  const hasBlazer = combo.some(isBlazer);
  const hasShirtUnderneath = combo.some((i) => isShirtLike(i));

  // Dress + bottoms is invalid
  if (hasDress && hasBottoms) return false;

  // Blazer needs a shirt underneath or a dress
  if (hasBlazer && !hasShirtUnderneath && !hasDress) return false;

  return true;
}

// --- Build valid outfit combos ---

type OutfitCombo = ClothingItem[];

function getCategoryCombinations(): ClothingCategory[][] {
  return [
    // Traditional outfits
    ["tops", "bottoms"],
    ["tops", "bottoms", "shoes"],
    ["tops", "bottoms", "outerwear"],
    ["tops", "bottoms", "outerwear", "shoes"],
    ["tops", "bottoms", "accessories"],
    ["tops", "bottoms", "shoes", "accessories"],
    ["tops", "bottoms", "outerwear", "shoes", "accessories"],

    // Dress-based outfits
    ["dresses"],
    ["dresses", "shoes"],
    ["dresses", "outerwear"],
    ["dresses", "shoes", "outerwear"],
    ["dresses", "accessories"],
    ["dresses", "shoes", "accessories"],
    ["dresses", "outerwear", "shoes", "accessories"],

    // Swimwear
    ["swimwear"],
    ["swimwear", "accessories"],
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
 * Adds belt for pants outfits, jewelry for formal/date looks.
 */
function enrichWithAccessories(
  combo: OutfitCombo,
  allAccessories: ClothingItem[]
): OutfitCombo {
  if (allAccessories.length === 0) return combo;

  const hasBottoms = combo.some((i) => i.category === "bottoms");
  const comboOccasions = new Set(combo.flatMap((i) => i.occasions));
  const isFormalish = comboOccasions.has("formal") || comboOccasions.has("work") || comboOccasions.has("date_night");

  const extras: ClothingItem[] = [];
  const usedSubs = new Set<string>();

  // Track already-included accessory subcategories
  for (const item of combo) {
    if (item.category === "accessories" && item.subCategory) {
      usedSubs.add(item.subCategory);
    }
  }

  // Add a belt when wearing pants/jeans
  if (hasBottoms && !usedSubs.has("belts")) {
    const belt = allAccessories.find((a) => a.subCategory === "belts");
    if (belt) {
      extras.push(belt);
      usedSubs.add("belts");
    }
  }

  // For formal/work/date outfits, add 1-2 pieces of jewelry
  if (isFormalish) {
    for (const sub of JEWELRY_SUBS) {
      if (usedSubs.has(sub) || extras.length >= 2) break;
      const piece = allAccessories.find((a) => a.subCategory === sub && !usedSubs.has(sub));
      if (piece) {
        extras.push(piece);
        usedSubs.add(sub);
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
    maxResults?: number;
  } = {}
): SuggestionResult[] {
  const { occasion, maxResults = 6 } = options;

  // Group items by category
  const byCategory = new Map<ClothingCategory, ClothingItem[]>();
  for (const item of allItems) {
    const list = byCategory.get(item.category) ?? [];
    list.push(item);
    byCategory.set(item.category, list);
  }

  const allAccessories = byCategory.get("accessories") ?? [];

  const allCombos: OutfitCombo[] = [];
  for (const categorySet of getCategoryCombinations()) {
    const combos = pickOnePerCategory(byCategory, categorySet);
    for (const combo of combos) {
      if (!isValidCombo(combo)) continue;
      const enriched = enrichWithAccessories(combo, allAccessories);
      allCombos.push(enriched);
    }
  }

  // Score each combo
  const scored: SuggestionResult[] = allCombos.map((combo) => {
    let score = 0;
    const reasons: string[] = [];

    // Color harmony (average pairwise) — 40% weight
    let colorScore = 0;
    let colorPairs = 0;
    for (let i = 0; i < combo.length; i++) {
      for (let j = i + 1; j < combo.length; j++) {
        colorScore += colorCompatibility(combo[i].color, combo[j].color);
        colorPairs++;
      }
    }
    if (colorPairs > 0) {
      const avgColor = colorScore / colorPairs;
      score += avgColor * 40;
      if (avgColor > 0.8) reasons.push("Great color harmony");
      else if (avgColor > 0.6) reasons.push("Good color pairing");
    }

    // Fabric compatibility — 30% weight
    const fabric = fabricCompatibility(combo);
    score += fabric * 30;
    if (fabric > 0.8) reasons.push("Well-balanced fabrics");

    // Occasion match — 30% weight
    if (occasion) {
      const os = occasionScore(combo, occasion);
      score += os * 30;
      if (os > 0.7) reasons.push(`Great for ${occasion.replace("_", " ")}`);
    } else {
      score += 15;
    }

    // Bonus for completeness
    const categories = new Set(combo.map((i) => i.category));
    if (categories.has("shoes")) {
      score += 2;
      reasons.push("Complete with shoes");
    }
    if (categories.has("accessories")) score += 1;
    if (categories.has("dresses")) reasons.push("Dress-based look");

    return { items: combo, score, reasons };
  });

  // Sort by score descending
  scored.sort((a, b) => b.score - a.score);

  // Deduplicate
  const seen = new Set<string>();
  const unique: SuggestionResult[] = [];
  for (const result of scored) {
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
  const hasBlazer = items.some(isBlazer);
  const hasShirt = items.some(isShirtLike);

  if (hasDress && hasBottoms) {
    warnings.push("A dress typically doesn't pair with pants or bottoms");
  }
  if (hasBlazer && !hasShirt && !hasDress) {
    warnings.push("A blazer usually needs a shirt or top underneath");
  }
  if (items.length === 0) {
    warnings.push("Select at least one item to create an outfit");
  }

  return warnings;
}
