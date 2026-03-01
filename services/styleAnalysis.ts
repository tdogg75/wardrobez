import type { ClothingItem, Outfit } from "@/models/types";
import { hexToHSL } from "@/constants/colors";

export interface StyleAnalysisResult {
  overallScore: number; // 0-100
  rating: string; // "Stunning", "Great", "Good", "Needs Work"
  strengths: string[];
  suggestions: string[];
  colorHarmony: { score: number; note: string };
  proportions: { score: number; note: string };
  styleCoherence: { score: number; note: string };
  versatility: { score: number; note: string };
}

/**
 * Analyze an outfit's style based on its component items.
 * Uses heuristic rules about color theory, proportions, and style coherence.
 */
export function analyzeOutfitStyle(items: ClothingItem[]): StyleAnalysisResult {
  if (items.length === 0) {
    return {
      overallScore: 0,
      rating: "Needs Work",
      strengths: [],
      suggestions: ["Add items to your outfit to get a style analysis."],
      colorHarmony: { score: 0, note: "No items to analyze" },
      proportions: { score: 0, note: "No items to analyze" },
      styleCoherence: { score: 0, note: "No items to analyze" },
      versatility: { score: 0, note: "No items to analyze" },
    };
  }

  const colorResult = analyzeColorHarmony(items);
  const proportionResult = analyzeProportions(items);
  const coherenceResult = analyzeStyleCoherence(items);
  const versatilityResult = analyzeVersatility(items);

  const overallScore = Math.round(
    colorResult.score * 0.35 +
    proportionResult.score * 0.25 +
    coherenceResult.score * 0.25 +
    versatilityResult.score * 0.15
  );

  const strengths: string[] = [];
  const suggestions: string[] = [];

  // Collect strengths
  if (colorResult.score >= 75) strengths.push(colorResult.note);
  if (proportionResult.score >= 75) strengths.push(proportionResult.note);
  if (coherenceResult.score >= 75) strengths.push(coherenceResult.note);
  if (versatilityResult.score >= 75) strengths.push(versatilityResult.note);

  // Collect suggestions
  if (colorResult.score < 70) suggestions.push(...getColorSuggestions(items));
  if (proportionResult.score < 70) suggestions.push(...getProportionSuggestions(items));
  if (coherenceResult.score < 70) suggestions.push(...getCoherenceSuggestions(items));
  if (versatilityResult.score < 70) suggestions.push(...getVersatilitySuggestions(items));

  // Extra suggestions based on missing elements
  const categories = new Set(items.map((i) => i.category));
  if (!categories.has("accessories") && !categories.has("jewelry")) {
    suggestions.push("Adding an accessory (scarf, belt, or watch) would elevate this look.");
  }
  if (!categories.has("shoes")) {
    suggestions.push("Don't forget to pick shoes that complement the outfit!");
  }

  const rating =
    overallScore >= 85 ? "Stunning" :
    overallScore >= 70 ? "Great" :
    overallScore >= 50 ? "Good" : "Needs Work";

  return {
    overallScore,
    rating,
    strengths: strengths.slice(0, 4),
    suggestions: suggestions.slice(0, 4),
    colorHarmony: colorResult,
    proportions: proportionResult,
    styleCoherence: coherenceResult,
    versatility: versatilityResult,
  };
}

function analyzeColorHarmony(items: ClothingItem[]): { score: number; note: string } {
  const hsls = items.map((i) => hexToHSL(i.color));
  const hues = hsls.map((h) => h.h);

  // Check for neutrals (low saturation)
  const neutralCount = hsls.filter((h) => h.s < 15).length;
  const colorfulItems = hsls.filter((h) => h.s >= 15);

  // All neutrals = safe but could use a pop of color
  if (neutralCount === items.length) {
    return { score: 70, note: "Clean neutral palette — classic and timeless." };
  }

  // Monochromatic (all similar hue)
  if (colorfulItems.length >= 2) {
    const hueRange = getHueRange(colorfulItems.map((h) => h.h));
    if (hueRange <= 30) {
      return { score: 85, note: "Beautiful monochromatic color scheme." };
    }

    // Complementary (opposite hues, ~180 apart)
    if (colorfulItems.length === 2) {
      const hueDiff = Math.min(
        Math.abs(colorfulItems[0].h - colorfulItems[1].h),
        360 - Math.abs(colorfulItems[0].h - colorfulItems[1].h)
      );
      if (hueDiff >= 150 && hueDiff <= 210) {
        return { score: 90, note: "Bold complementary colors create eye-catching contrast." };
      }
    }

    // Analogous (adjacent hues)
    if (hueRange <= 60) {
      return { score: 80, note: "Harmonious analogous color scheme." };
    }

    // Triadic (3 colors ~120 apart)
    if (colorfulItems.length >= 3 && hueRange > 90) {
      return { score: 65, note: "Multiple colors present — ensure they balance well." };
    }
  }

  // Mix of neutrals and one or two colors
  if (neutralCount >= items.length / 2 && colorfulItems.length <= 2) {
    return { score: 80, note: "Good balance of neutrals with accent color." };
  }

  // Default
  return { score: 60, note: "Color combination is unconventional." };
}

function analyzeProportions(items: ClothingItem[]): { score: number; note: string } {
  const categories = items.map((i) => i.category);
  const hasTop = categories.some((c) => ["tops", "blazers", "jackets"].includes(c));
  const hasBottom = categories.some((c) => ["bottoms", "shorts", "skirts"].includes(c));
  const hasDress = categories.some((c) => ["dresses", "jumpsuits"].includes(c));
  const hasShoes = categories.includes("shoes");

  // Full outfit check
  if ((hasTop && hasBottom) || hasDress) {
    if (hasShoes) {
      return { score: 90, note: "Complete outfit with balanced head-to-toe proportions." };
    }
    return { score: 75, note: "Good base outfit. Shoes would complete the look." };
  }

  if (hasTop && !hasBottom && !hasDress) {
    return { score: 45, note: "Missing bottoms — outfit feels incomplete." };
  }

  if (hasBottom && !hasTop && !hasDress) {
    return { score: 45, note: "Missing a top — outfit needs more coverage." };
  }

  // Layering bonus
  const layerCount = categories.filter((c) => ["tops", "blazers", "jackets"].includes(c)).length;
  if (layerCount >= 2) {
    return { score: 85, note: "Nice layering creates visual depth and dimension." };
  }

  return { score: 55, note: "Proportions could use adjustment for a polished look." };
}

function analyzeStyleCoherence(items: ClothingItem[]): { score: number; note: string } {
  const subCategories = items.map((i) => i.subCategory ?? "").filter(Boolean);

  // Check for style clashes
  const isFormal = subCategories.some((s) =>
    ["dress_pants", "heels", "formal_blazer", "dress_boots", "formal_dress"].includes(s)
  );
  const isCasual = subCategories.some((s) =>
    ["athletic_shorts", "casual_shorts", "running_shoes", "hoodie", "sweatpants", "flip_flops", "slides"].includes(s)
  );
  const isSporty = subCategories.some((s) =>
    ["running_shoes", "sport", "athletic_shorts", "soccer_shoes"].includes(s)
  );

  if (isFormal && isCasual) {
    return { score: 35, note: "Formal and casual pieces clash — pick one direction." };
  }

  if (isFormal && isSporty) {
    return { score: 30, note: "Athletic and formal pieces don't mix well." };
  }

  // Pattern coherence
  const patterns = items.map((i) => i.pattern ?? "solid");
  const nonSolid = patterns.filter((p) => p !== "solid");
  const boldPatterns = ["floral", "plaid", "animal_print", "camo", "paisley", "houndstooth", "tie_dye"];
  const boldCount = nonSolid.filter((p) => boldPatterns.includes(p)).length;
  if (boldCount >= 2) {
    return { score: 40, note: "Multiple bold patterns compete — simplify to one statement pattern." };
  }
  if (nonSolid.length >= 3) {
    return { score: 50, note: "Three or more patterns is very busy — try replacing some with solids." };
  }

  // Fabric coherence
  const fabrics = items.map((i) => i.fabricType).filter(Boolean);
  const hasDenim = fabrics.includes("denim");
  const hasSilk = fabrics.includes("silk");
  const hasLeather = fabrics.includes("leather");

  if (hasDenim && hasSilk) {
    return { score: 55, note: "Denim and silk is an unexpected mix — can work with confidence." };
  }

  if (hasLeather && hasSilk) {
    return { score: 75, note: "Leather and silk create an edgy-meets-elegant vibe." };
  }

  // Pattern bonus: single pattern + solids is clean
  if (nonSolid.length === 1 && items.length >= 3) {
    return { score: 85, note: "Single pattern anchored by solids — clean and intentional." };
  }

  // Generally coherent
  if (!isFormal && !isCasual) {
    return { score: 80, note: "Pieces work well together stylistically." };
  }

  return { score: 70, note: "Generally cohesive style." };
}

function analyzeVersatility(items: ClothingItem[]): { score: number; note: string } {
  const categories = new Set(items.map((i) => i.category));
  const hasAccessory = categories.has("accessories") || categories.has("jewelry") || categories.has("purse");
  const hasLayers = items.filter((i) => ["blazers", "jackets"].includes(i.category)).length > 0;

  let score = 50;
  const notes: string[] = [];

  // More categories = more versatile
  if (categories.size >= 4) {
    score += 20;
    notes.push("Multi-category outfit offers versatility");
  } else if (categories.size >= 3) {
    score += 10;
  }

  if (hasAccessory) {
    score += 15;
    notes.push("Accessories add polish");
  }

  if (hasLayers) {
    score += 15;
    notes.push("Layers allow temperature adaptation");
  }

  // Neutral-heavy outfits are more versatile
  const neutralCount = items.filter((i) => {
    const hsl = hexToHSL(i.color);
    return hsl.s < 15;
  }).length;

  if (neutralCount >= items.length * 0.6) {
    score += 10;
    notes.push("Neutral base makes this easy to accessorize differently");
  }

  score = Math.min(score, 100);
  const note = notes.length > 0 ? notes[0] + "." : "Outfit has moderate versatility.";

  return { score, note };
}

function getHueRange(hues: number[]): number {
  if (hues.length < 2) return 0;
  let minRange = 360;
  for (let i = 0; i < hues.length; i++) {
    for (let j = i + 1; j < hues.length; j++) {
      const diff = Math.min(
        Math.abs(hues[i] - hues[j]),
        360 - Math.abs(hues[i] - hues[j])
      );
      minRange = Math.min(minRange, diff);
    }
  }
  return minRange;
}

function getColorSuggestions(items: ClothingItem[]): string[] {
  const hsls = items.map((i) => hexToHSL(i.color));
  const suggestions: string[] = [];

  const colorful = hsls.filter((h) => h.s >= 15);
  if (colorful.length > 3) {
    suggestions.push("Try limiting to 2-3 colors max for a more polished look.");
  }

  const allNeutral = hsls.every((h) => h.s < 15);
  if (allNeutral && items.length >= 3) {
    suggestions.push("A pop of color (earrings, scarf, or shoes) would add interest.");
  }

  return suggestions;
}

function getProportionSuggestions(items: ClothingItem[]): string[] {
  const categories = items.map((i) => i.category);
  const suggestions: string[] = [];

  if (!categories.includes("shoes")) {
    suggestions.push("Add shoes to complete the look from head to toe.");
  }

  const topCount = categories.filter((c) => ["tops", "blazers", "jackets"].includes(c)).length;
  if (topCount >= 3) {
    suggestions.push("Three or more top layers may look bulky — consider removing one.");
  }

  return suggestions;
}

function getCoherenceSuggestions(items: ClothingItem[]): string[] {
  const suggestions: string[] = [];
  const subs = items.map((i) => i.subCategory ?? "");

  if (subs.includes("running_shoes") && subs.some((s) => ["dress_pants", "formal_blazer"].includes(s))) {
    suggestions.push("Swap running shoes for loafers or dress shoes to match the formal pieces.");
  }

  if (subs.includes("hoodie") && subs.some((s) => ["heels", "formal_dress"].includes(s))) {
    suggestions.push("A hoodie with formal items sends mixed signals. Try a cardigan or blazer instead.");
  }

  return suggestions;
}

function getVersatilitySuggestions(items: ClothingItem[]): string[] {
  const suggestions: string[] = [];
  const categories = new Set(items.map((i) => i.category));

  if (!categories.has("accessories") && !categories.has("jewelry")) {
    suggestions.push("An accessory like a watch, belt, or simple necklace adds polish.");
  }

  if (!categories.has("blazers") && !categories.has("jackets")) {
    suggestions.push("A blazer or jacket adds structure and makes the outfit more occasion-flexible.");
  }

  return suggestions;
}
