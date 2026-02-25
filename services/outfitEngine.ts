import type {
  ClothingItem,
  ClothingCategory,
  Season,
  Occasion,
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

// --- Fabric / Weight Rules ---

function fabricCompatibility(items: ClothingItem[]): number {
  const weights = items.map((i) => i.fabricWeight);
  const hasHeavy = weights.includes("heavy");
  const hasLight = weights.includes("light");

  // Mixing extremes (heavy coat with light tank) is fine — layering
  // All heavy = 0.6 (too bulky), all light = fine
  if (weights.every((w) => w === "heavy")) return 0.6;
  if (hasHeavy && hasLight) return 0.85;
  return 0.9;
}

// --- Season Logic ---

function seasonScore(items: ClothingItem[], targetSeason: Season): number {
  if (items.length === 0) return 0;
  const matchCount = items.filter((i) => i.seasons.includes(targetSeason)).length;
  return matchCount / items.length;
}

// --- Occasion Logic ---

function occasionScore(items: ClothingItem[], targetOccasion: Occasion): number {
  if (items.length === 0) return 0;
  const matchCount = items.filter((i) => i.occasions.includes(targetOccasion)).length;
  return matchCount / items.length;
}

// --- Build valid outfit combos ---

type OutfitCombo = ClothingItem[];

function getCategoryCombinations(items: ClothingItem[]): ClothingCategory[][] {
  return [
    ["tops", "bottoms"],
    ["tops", "bottoms", "outerwear"],
    ["tops", "bottoms", "shoes"],
    ["tops", "bottoms", "outerwear", "shoes"],
    ["tops", "bottoms", "accessories"],
    ["dresses"],
    ["dresses", "outerwear"],
    ["dresses", "shoes"],
    ["dresses", "outerwear", "shoes"],
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
    season?: Season;
    occasion?: Occasion;
    maxResults?: number;
  } = {}
): SuggestionResult[] {
  const { season, occasion, maxResults = 5 } = options;

  // Group items by category
  const byCategory = new Map<ClothingCategory, ClothingItem[]>();
  for (const item of allItems) {
    const list = byCategory.get(item.category) ?? [];
    list.push(item);
    byCategory.set(item.category, list);
  }

  const allCombos: OutfitCombo[] = [];
  for (const categorySet of getCategoryCombinations(allItems)) {
    const combos = pickOnePerCategory(byCategory, categorySet);
    allCombos.push(...combos);
  }

  // Score each combo
  const scored: SuggestionResult[] = allCombos.map((combo) => {
    let score = 0;
    const reasons: string[] = [];

    // Color harmony (average pairwise)
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
      score += avgColor * 35; // 35% weight
      if (avgColor > 0.8) reasons.push("Great color harmony");
      else if (avgColor > 0.6) reasons.push("Good color pairing");
    }

    // Fabric compatibility
    const fabric = fabricCompatibility(combo);
    score += fabric * 20; // 20% weight
    if (fabric > 0.8) reasons.push("Well-balanced fabrics");

    // Season match
    if (season) {
      const ss = seasonScore(combo, season);
      score += ss * 25; // 25% weight
      if (ss > 0.7) reasons.push(`Perfect for ${season}`);
    } else {
      score += 15; // neutral bonus if no season filter
    }

    // Occasion match
    if (occasion) {
      const os = occasionScore(combo, occasion);
      score += os * 20; // 20% weight
      if (os > 0.7) reasons.push(`Great for ${occasion.replace("_", " ")}`);
    } else {
      score += 10;
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
  const allSeasons = new Set<Season>();
  const allOccasions = new Set<Occasion>();
  for (const item of suggestion.items) {
    item.seasons.forEach((s) => allSeasons.add(s));
    item.occasions.forEach((o) => allOccasions.add(o));
  }

  return {
    name,
    itemIds: suggestion.items.map((i) => i.id),
    seasons: [...allSeasons],
    occasions: [...allOccasions],
    rating: Math.round(suggestion.score / 20), // normalize to 1-5
    suggested: true,
  };
}
