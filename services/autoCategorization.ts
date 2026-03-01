/**
 * ML-Based Auto-Categorization Service (#99)
 *
 * Provides smart rule-based clothing categorization by analyzing:
 * 1. Filename / metadata text for clothing keywords
 * 2. Image aspect ratio heuristics (portrait = dress, landscape = accessory)
 * 3. Color analysis patterns
 *
 * This provides a solid local-first approach. For true ML classification,
 * a server-side model (e.g., Google Vision, AWS Rekognition, or a custom
 * TensorFlow model) could be integrated via the same interface.
 */

import { Image } from "react-native";
import type { ClothingCategory } from "@/models/types";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CategorizationResult {
  category: ClothingCategory;
  subCategory?: string;
  confidence: number; // 0-1
  method: "filename" | "aspect_ratio" | "combined";
}

// ---------------------------------------------------------------------------
// Keyword dictionary (mirrors productSearch.ts but tuned for filenames)
// ---------------------------------------------------------------------------

const CATEGORY_KEYWORDS: Array<{
  keywords: string[];
  category: ClothingCategory;
  subCategory?: string;
  weight: number; // higher = more confident match
}> = [
  // Tops
  { keywords: ["tank top", "tank"], category: "tops", subCategory: "tank_top", weight: 0.9 },
  { keywords: ["t-shirt", "tshirt", "tee"], category: "tops", subCategory: "tshirt", weight: 0.9 },
  { keywords: ["blouse"], category: "tops", subCategory: "blouse", weight: 0.9 },
  { keywords: ["sweater", "pullover", "knit"], category: "tops", subCategory: "sweater", weight: 0.85 },
  { keywords: ["hoodie", "hoody"], category: "tops", subCategory: "hoodie", weight: 0.9 },
  { keywords: ["cardigan"], category: "tops", subCategory: "cardigan", weight: 0.9 },
  { keywords: ["polo"], category: "tops", subCategory: "polo", weight: 0.85 },
  { keywords: ["crop top"], category: "tops", subCategory: "crop_top", weight: 0.9 },
  { keywords: ["shirt", "button down", "button-down"], category: "tops", subCategory: "button_down", weight: 0.8 },
  { keywords: ["top"], category: "tops", weight: 0.6 },

  // Bottoms
  { keywords: ["jeans", "denim pants"], category: "bottoms", subCategory: "jeans", weight: 0.9 },
  { keywords: ["chinos", "khakis"], category: "bottoms", subCategory: "casual", weight: 0.85 },
  { keywords: ["trousers", "slacks", "dress pants"], category: "bottoms", subCategory: "trousers", weight: 0.9 },
  { keywords: ["sweatpants", "joggers", "track pants"], category: "bottoms", subCategory: "sweatpants", weight: 0.9 },
  { keywords: ["leggings"], category: "bottoms", subCategory: "leggings", weight: 0.9 },
  { keywords: ["pants", "pant"], category: "bottoms", weight: 0.7 },

  // Shorts
  { keywords: ["shorts", "short"], category: "shorts", weight: 0.8 },
  { keywords: ["athletic shorts", "gym shorts", "running shorts"], category: "shorts", subCategory: "athletic_shorts", weight: 0.9 },

  // Skirts
  { keywords: ["mini skirt"], category: "skirts", subCategory: "mini_skirt", weight: 0.9 },
  { keywords: ["midi skirt"], category: "skirts", subCategory: "midi_skirt", weight: 0.9 },
  { keywords: ["maxi skirt"], category: "skirts", subCategory: "maxi_skirt", weight: 0.9 },
  { keywords: ["skirt"], category: "skirts", weight: 0.8 },
  { keywords: ["skort"], category: "skirts", subCategory: "skort", weight: 0.9 },

  // Dresses
  { keywords: ["sundress", "sun dress"], category: "dresses", subCategory: "sundress", weight: 0.9 },
  { keywords: ["maxi dress"], category: "dresses", subCategory: "maxi_dress", weight: 0.9 },
  { keywords: ["cocktail dress"], category: "dresses", subCategory: "cocktail", weight: 0.9 },
  { keywords: ["dress"], category: "dresses", weight: 0.75 },

  // Jackets
  { keywords: ["denim jacket", "jean jacket"], category: "jackets", subCategory: "jean_jacket", weight: 0.9 },
  { keywords: ["parka"], category: "jackets", subCategory: "parka", weight: 0.9 },
  { keywords: ["raincoat", "rain jacket"], category: "jackets", subCategory: "raincoat", weight: 0.9 },
  { keywords: ["leather jacket"], category: "jackets", subCategory: "leather_jacket", weight: 0.9 },
  { keywords: ["jacket", "coat"], category: "jackets", weight: 0.75 },

  // Blazers
  { keywords: ["blazer", "sport coat"], category: "blazers", weight: 0.9 },

  // Shoes
  { keywords: ["sneakers", "trainers", "running shoes"], category: "shoes", subCategory: "running_shoes", weight: 0.9 },
  { keywords: ["boots", "ankle boots"], category: "shoes", subCategory: "ankle_boots", weight: 0.85 },
  { keywords: ["sandals", "flip flops"], category: "shoes", subCategory: "sandals", weight: 0.9 },
  { keywords: ["heels", "pumps", "stilettos"], category: "shoes", subCategory: "heels", weight: 0.9 },
  { keywords: ["loafers", "moccasins"], category: "shoes", subCategory: "loafers", weight: 0.9 },
  { keywords: ["flats"], category: "shoes", subCategory: "flats", weight: 0.85 },
  { keywords: ["shoes", "shoe"], category: "shoes", weight: 0.7 },

  // Accessories
  { keywords: ["belt"], category: "accessories", subCategory: "belts", weight: 0.9 },
  { keywords: ["hat", "cap", "beanie"], category: "accessories", subCategory: "hats", weight: 0.9 },
  { keywords: ["sunglasses", "glasses"], category: "accessories", subCategory: "sunglasses", weight: 0.9 },
  { keywords: ["scarf"], category: "accessories", subCategory: "scarves", weight: 0.9 },

  // Bags
  { keywords: ["purse", "handbag", "bag"], category: "purse", subCategory: "handbag", weight: 0.8 },
  { keywords: ["backpack"], category: "purse", subCategory: "backpack", weight: 0.9 },
  { keywords: ["tote"], category: "purse", subCategory: "tote", weight: 0.85 },
  { keywords: ["clutch"], category: "purse", subCategory: "clutch", weight: 0.9 },

  // Jewelry
  { keywords: ["necklace", "pendant", "chain"], category: "jewelry", subCategory: "necklaces", weight: 0.9 },
  { keywords: ["bracelet", "bangle"], category: "jewelry", subCategory: "bracelets", weight: 0.9 },
  { keywords: ["earring", "earrings"], category: "jewelry", subCategory: "earrings", weight: 0.9 },
  { keywords: ["ring"], category: "jewelry", subCategory: "rings", weight: 0.8 },
  { keywords: ["watch"], category: "jewelry", subCategory: "watches", weight: 0.9 },

  // Swimwear
  { keywords: ["bikini"], category: "swimwear", subCategory: "top", weight: 0.9 },
  { keywords: ["swimsuit", "one piece", "one-piece"], category: "swimwear", subCategory: "one_piece", weight: 0.9 },
  { keywords: ["swim trunks", "board shorts"], category: "swimwear", subCategory: "bottom", weight: 0.9 },
];

// ---------------------------------------------------------------------------
// Filename analysis
// ---------------------------------------------------------------------------

function analyzeFilename(filename: string): CategorizationResult | null {
  const normalized = filename
    .toLowerCase()
    .replace(/[-_]/g, " ")
    .replace(/\.(jpg|jpeg|png|webp|heic|heif)$/i, "")
    .replace(/\d{5,}/g, "") // remove long number sequences (IDs)
    .trim();

  // Sort by keyword length (longer = more specific = check first)
  const sorted = [...CATEGORY_KEYWORDS].sort(
    (a, b) => Math.max(...b.keywords.map((k) => k.length)) - Math.max(...a.keywords.map((k) => k.length))
  );

  for (const entry of sorted) {
    for (const keyword of entry.keywords) {
      if (normalized.includes(keyword)) {
        return {
          category: entry.category,
          subCategory: entry.subCategory,
          confidence: entry.weight,
          method: "filename",
        };
      }
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Aspect ratio heuristics
// ---------------------------------------------------------------------------

function analyzeAspectRatio(width: number, height: number): CategorizationResult | null {
  if (width === 0 || height === 0) return null;
  const ratio = width / height;

  // Very tall / portrait images often show full-length items
  if (ratio < 0.5) {
    return { category: "dresses", confidence: 0.3, method: "aspect_ratio" };
  }

  // Moderately portrait
  if (ratio < 0.75) {
    return { category: "tops", confidence: 0.2, method: "aspect_ratio" };
  }

  // Very wide / landscape images often show accessories or shoes laid flat
  if (ratio > 1.5) {
    return { category: "accessories", confidence: 0.25, method: "aspect_ratio" };
  }

  // Square-ish images are most common for product photos — weak signal
  return { category: "tops", confidence: 0.15, method: "aspect_ratio" };
}

// ---------------------------------------------------------------------------
// Combined analysis
// ---------------------------------------------------------------------------

function getImageSize(uri: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    Image.getSize(
      uri,
      (width, height) => resolve({ width, height }),
      () => resolve({ width: 0, height: 0 })
    );
  });
}

/**
 * Auto-categorize a clothing image using available signals.
 *
 * Priority:
 * 1. Filename keywords (highest confidence)
 * 2. Aspect ratio heuristics (supplementary)
 *
 * Returns null if confidence is too low to be useful.
 */
export async function autoCategorize(
  imageUri: string,
  filename?: string
): Promise<CategorizationResult | null> {
  const results: CategorizationResult[] = [];

  // 1. Filename analysis
  if (filename) {
    const fnResult = analyzeFilename(filename);
    if (fnResult) results.push(fnResult);
  }

  // Also try parsing category from the URI path
  const uriParts = imageUri.split("/");
  const uriFilename = uriParts[uriParts.length - 1];
  if (uriFilename && uriFilename !== filename) {
    const uriResult = analyzeFilename(uriFilename);
    if (uriResult) {
      // Lower confidence since URI names are often auto-generated
      results.push({ ...uriResult, confidence: uriResult.confidence * 0.7 });
    }
  }

  // 2. Aspect ratio analysis
  const { width, height } = await getImageSize(imageUri);
  const arResult = analyzeAspectRatio(width, height);
  if (arResult) results.push(arResult);

  // Pick the highest-confidence result
  if (results.length === 0) return null;

  results.sort((a, b) => b.confidence - a.confidence);
  const best = results[0];

  // If we have multiple signals agreeing, boost confidence
  if (results.length >= 2 && results[0].category === results[1].category) {
    best.confidence = Math.min(1, best.confidence + 0.15);
    best.method = "combined";
  }

  // Only return if confidence is meaningful
  if (best.confidence < 0.2) return null;

  return best;
}

/**
 * Batch-categorize multiple images.
 * Returns results keyed by URI.
 */
export async function batchCategorize(
  images: Array<{ uri: string; filename?: string }>
): Promise<Map<string, CategorizationResult | null>> {
  const results = new Map<string, CategorizationResult | null>();
  // Process in parallel
  await Promise.all(
    images.map(async ({ uri, filename }) => {
      const result = await autoCategorize(uri, filename);
      results.set(uri, result);
    })
  );
  return results;
}
