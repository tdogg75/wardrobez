import type { ClothingCategory, FabricType } from "@/models/types";
import { PRESET_COLORS } from "@/constants/colors";

interface ProductSearchResult {
  category?: ClothingCategory;
  subCategory?: string;
  fabricType?: FabricType;
  colorIndex?: number;
}

const SUBCATEGORY_KEYWORDS: Record<
  string,
  { category: ClothingCategory; subCategory?: string }
> = {
  "tank top": { category: "tops", subCategory: "tank_top" },
  tank: { category: "tops", subCategory: "tank_top" },
  "t-shirt": { category: "tops", subCategory: "tshirt" },
  tshirt: { category: "tops", subCategory: "tshirt" },
  tee: { category: "tops", subCategory: "tshirt" },
  "long sleeve": { category: "tops", subCategory: "long_sleeve" },
  blouse: { category: "tops", subCategory: "blouse" },
  sweater: { category: "tops", subCategory: "sweater" },
  sweatshirt: { category: "tops", subCategory: "sweatshirt" },
  hoodie: { category: "tops", subCategory: "hoodie" },
  blazer: { category: "tops", subCategory: "blazer" },
  "workout shirt": { category: "tops", subCategory: "workout_shirt" },
  polo: { category: "tops", subCategory: "tshirt" },
  cardigan: { category: "tops", subCategory: "sweater" },
  "dress pants": { category: "bottoms", subCategory: "dress_pants" },
  slacks: { category: "bottoms", subCategory: "dress_pants" },
  trousers: { category: "bottoms", subCategory: "dress_pants" },
  jeans: { category: "bottoms", subCategory: "jeans" },
  denim: { category: "bottoms", subCategory: "jeans" },
  leggings: { category: "bottoms", subCategory: "leggings" },
  chinos: { category: "bottoms", subCategory: "casual_pants" },
  joggers: { category: "bottoms", subCategory: "casual_pants" },
  shorts: { category: "bottoms", subCategory: "other" },
  skirt: { category: "bottoms", subCategory: "other" },
  parka: { category: "outerwear", subCategory: "parka" },
  "spring jacket": { category: "outerwear", subCategory: "spring_jacket" },
  "light jacket": { category: "outerwear", subCategory: "spring_jacket" },
  raincoat: { category: "outerwear", subCategory: "raincoat" },
  "rain jacket": { category: "outerwear", subCategory: "raincoat" },
  "work jacket": { category: "outerwear", subCategory: "work_jacket" },
  "ski jacket": { category: "outerwear", subCategory: "ski_jacket" },
  coat: { category: "outerwear", subCategory: "work_jacket" },
  jacket: { category: "outerwear", subCategory: "spring_jacket" },
  "dress boots": { category: "shoes", subCategory: "dress_boots" },
  "winter boots": { category: "shoes", subCategory: "winter_boots" },
  "snow boots": { category: "shoes", subCategory: "winter_boots" },
  "running shoes": { category: "shoes", subCategory: "running_shoes" },
  sneakers: { category: "shoes", subCategory: "running_shoes" },
  trainers: { category: "shoes", subCategory: "running_shoes" },
  sandals: { category: "shoes", subCategory: "sandals" },
  "soccer shoes": { category: "shoes", subCategory: "soccer_shoes" },
  cleats: { category: "shoes", subCategory: "soccer_shoes" },
  flats: { category: "shoes", subCategory: "flats" },
  heels: { category: "shoes", subCategory: "heels" },
  pumps: { category: "shoes", subCategory: "heels" },
  boots: { category: "shoes", subCategory: "dress_boots" },
  loafers: { category: "shoes", subCategory: "flats" },
  belt: { category: "accessories", subCategory: "belts" },
  watch: { category: "accessories", subCategory: "watches" },
  earring: { category: "accessories", subCategory: "earrings" },
  earrings: { category: "accessories", subCategory: "earrings" },
  necklace: { category: "accessories", subCategory: "necklaces" },
  bracelet: { category: "accessories", subCategory: "bracelets" },
  ring: { category: "accessories", subCategory: "rings" },
  bikini: { category: "swimwear" },
  swimsuit: { category: "swimwear" },
  "swim trunks": { category: "swimwear" },
};

const FABRIC_KEYWORDS: Record<string, FabricType> = {
  cotton: "cotton",
  linen: "linen",
  silk: "silk",
  silky: "silk",
  satin: "satin",
  polyester: "polyester",
  wool: "wool",
  merino: "wool",
  denim: "denim",
  leather: "leather",
  "faux leather": "leather",
  nylon: "nylon",
  cashmere: "cashmere",
  fleece: "fleece",
  "gore-tex": "nylon",
  canvas: "cotton",
  tweed: "wool",
  corduroy: "cotton",
  jersey: "cotton",
  chiffon: "polyester",
  velvet: "silk",
  suede: "leather",
};

const COLOR_KEYWORDS: Record<string, string> = {
  black: "#000000",
  white: "#FFFFFF",
  gray: "#808080",
  grey: "#808080",
  beige: "#F5F5DC",
  tan: "#D2B48C",
  brown: "#8B4513",
  navy: "#000080",
  red: "#DC143C",
  coral: "#FF6347",
  pink: "#FF69B4",
  purple: "#800080",
  blue: "#4169E1",
  "light blue": "#87CEEB",
  teal: "#008080",
  green: "#228B22",
  "light green": "#90EE90",
  gold: "#FFD700",
  yellow: "#FFFF00",
  orange: "#FFA500",
  lavender: "#E6E6FA",
  burgundy: "#800020",
  olive: "#556B2F",
  cream: "#F5F5DC",
  charcoal: "#808080",
  khaki: "#D2B48C",
  maroon: "#800020",
  mint: "#90EE90",
  turquoise: "#008080",
  indigo: "#000080",
};

/**
 * Infers clothing item attributes from a product name and optional brand.
 * Uses keyword matching — no network required.
 */
export async function searchProduct(
  name: string,
  brand?: string
): Promise<ProductSearchResult | null> {
  const text = `${name} ${brand ?? ""}`.toLowerCase().trim();
  const result: ProductSearchResult = {};
  let matchCount = 0;

  // Check subcategory keywords (longest match first for specificity)
  const sortedKeys = Object.keys(SUBCATEGORY_KEYWORDS).sort(
    (a, b) => b.length - a.length
  );
  for (const keyword of sortedKeys) {
    if (text.includes(keyword)) {
      const match = SUBCATEGORY_KEYWORDS[keyword];
      result.category = match.category;
      result.subCategory = match.subCategory;
      matchCount++;
      break;
    }
  }

  // Check fabric keywords (longest match first)
  const sortedFabricKeys = Object.keys(FABRIC_KEYWORDS).sort(
    (a, b) => b.length - a.length
  );
  for (const keyword of sortedFabricKeys) {
    if (text.includes(keyword)) {
      result.fabricType = FABRIC_KEYWORDS[keyword];
      matchCount++;
      break;
    }
  }

  // Check color keywords (longest match first)
  const sortedColorKeys = Object.keys(COLOR_KEYWORDS).sort(
    (a, b) => b.length - a.length
  );
  for (const keyword of sortedColorKeys) {
    if (text.includes(keyword)) {
      const hex = COLOR_KEYWORDS[keyword];
      const idx = PRESET_COLORS.findIndex((c) => c.hex === hex);
      if (idx >= 0) {
        result.colorIndex = idx;
        matchCount++;
      }
      break;
    }
  }

  if (matchCount === 0) return null;
  return result;
}
