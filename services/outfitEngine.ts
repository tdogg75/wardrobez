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

function areComplementary(hex1: string, hex2: string): boolean {
  const c1 = hexToHSL(hex1);
  const c2 = hexToHSL(hex2);
  if (isNeutral(hex1) || isNeutral(hex2)) return true;
  const hueDiff = Math.abs(c1.h - c2.h);
  const normalized = Math.min(hueDiff, 360 - hueDiff);
  return normalized > 150 && normalized < 210;
}

function areAnalogous(hex1: string, hex2: string): boolean {
  const c1 = hexToHSL(hex1);
  const c2 = hexToHSL(hex2);
  if (isNeutral(hex1) || isNeutral(hex2)) return true;
  const hueDiff = Math.abs(c1.h - c2.h);
  const normalized = Math.min(hueDiff, 360 - hueDiff);
  return normalized < 45;
}

function colorCompatibility(hex1: string, hex2: string): number {
  if (isNeutral(hex1) || isNeutral(hex2)) return 0.85;
  if (areComplementary(hex1, hex2)) return 0.9;
  if (areAnalogous(hex1, hex2)) return 0.8;

  // Monochromatic
  const c1 = hexToHSL(hex1);
  const c2 = hexToHSL(hex2);
  const hueDiff = Math.min(Math.abs(c1.h - c2.h), 360 - Math.abs(c1.h - c2.h));
  if (hueDiff < 10) return 0.75;

  // Triadic (120 degrees apart)
  const normalized = Math.min(hueDiff, 360 - hueDiff);
  if (normalized > 110 && normalized < 130) return 0.7;

  return 0.4;
}

// --- Fabric Compatibility ---

const FORMAL_FABRICS: FabricType[] = ["silk", "wool", "cashmere", "leather", "satin"];
const CASUAL_FABRICS: FabricType[] = ["cotton", "denim", "linen", "nylon", "polyester", "fleece"];

function fabricCompatibility(items: ClothingItem[]): number {
  const types = items.map((i) => i.fabricType);
  const uniqueTypes = new Set(types);

  // Single fabric type = great cohesion
  if (uniqueTypes.size === 1) return 0.9;

  // Check if mixing formal and casual fabrics
  const hasFormal = types.some((t) => FORMAL_FABRICS.includes(t));
  const hasCasual = types.some((t) => CASUAL_FABRICS.includes(t));

  if (hasFormal && hasCasual) {
    const formalCount = types.filter((t) => FORMAL_FABRICS.includes(t)).length;
    const casualCount = types.filter((t) => CASUAL_FABRICS.includes(t)).length;
    const balance = Math.min(formalCount, casualCount) / Math.max(formalCount, casualCount);
    return 0.6 + balance * 0.2; // 0.6 to 0.8
  }

  // All formal or all casual
  return 0.85;
}

// --- Occasion Logic ---

function occasionScore(items: ClothingItem[], targetOccasion: Occasion): number {
  if (items.length === 0) return 0;
  const matchCount = items.filter((i) => i.occasions.includes(targetOccasion)).length;
  return matchCount / items.length;
}

// --- Build valid outfit combos ---

type OutfitCombo = ClothingItem[];

function getCategoryCombinations(): ClothingCategory[][] {
  return [
    ["tops", "bottoms"],
    ["tops", "bottoms", "outerwear"],
    ["tops", "bottoms", "shoes"],
    ["tops", "bottoms", "outerwear", "shoes"],
    ["tops", "bottoms", "accessories"],
    ["tops", "bottoms", "outerwear", "shoes", "accessories"],
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
  const { occasion, maxResults = 5 } = options;

  // Group items by category
  const byCategory = new Map<ClothingCategory, ClothingItem[]>();
  for (const item of allItems) {
    const list = byCategory.get(item.category) ?? [];
    list.push(item);
    byCategory.set(item.category, list);
  }

  const allCombos: OutfitCombo[] = [];
  for (const categorySet of getCategoryCombinations()) {
    const combos = pickOnePerCategory(byCategory, categorySet);
    allCombos.push(...combos);
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
      score += 15; // neutral bonus if no occasion filter
    }

    return { items: combo, score, reasons };
  });

  // Sort by score descending, take top N
  scored.sort((a, b) => b.score - a.score);

  // Deduplicate (same set of item IDs)
  const seen = new Set<string>();
  const unique: SuggestionResult[] = [];
  for (const result of scored) {
    const key = result.items
      .map((i) => i.id)
      .sort()
      .join(",");
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(result);
    }
    if (unique.length >= maxResults) break;
  }

  return unique;
}

export function outfitToSaveable(
  suggestion: SuggestionResult,
  name: string
): Omit<Outfit, "id" | "createdAt"> {
  const allOccasions = new Set<Occasion>();
  for (const item of suggestion.items) {
    item.occasions.forEach((o) => allOccasions.add(o));
  }

  return {
    name,
    itemIds: suggestion.items.map((i) => i.id),
    occasions: [...allOccasions],
    rating: Math.round(suggestion.score / 20), // normalize to 1-5
    suggested: true,
  };
}
