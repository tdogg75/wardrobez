import type { ClothingCategory, FabricType } from "@/models/types";
import { PRESET_COLORS } from "@/constants/colors";

export interface ProductSearchResult {
  category?: ClothingCategory;
  subCategory?: string;
  fabricType?: FabricType;
  colorIndex?: number;
}

export interface OnlineProductOption {
  id: string;
  name: string;
  store: string;
  price: string;
  color: string; // hex
  colorName: string;
  imageUri: string | null; // URL or null for placeholder
  category?: ClothingCategory;
  subCategory?: string;
  fabricType?: FabricType;
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
  leggings: { category: "bottoms", subCategory: "leggings" },
  chinos: { category: "bottoms", subCategory: "casual_pants" },
  joggers: { category: "bottoms", subCategory: "casual_pants" },
  shorts: { category: "bottoms", subCategory: "shorts" },
  skirt: { category: "bottoms", subCategory: "skirt" },
  "formal dress": { category: "dresses", subCategory: "formal_dress" },
  "evening dress": { category: "dresses", subCategory: "formal_dress" },
  "gown": { category: "dresses", subCategory: "formal_dress" },
  "work dress": { category: "dresses", subCategory: "work_dress" },
  "office dress": { category: "dresses", subCategory: "work_dress" },
  "sheath dress": { category: "dresses", subCategory: "work_dress" },
  "casual dress": { category: "dresses", subCategory: "casual_dress" },
  sundress: { category: "dresses", subCategory: "sundress" },
  "sun dress": { category: "dresses", subCategory: "sundress" },
  "cover-up": { category: "dresses", subCategory: "cover_up" },
  "cover up": { category: "dresses", subCategory: "cover_up" },
  "beach dress": { category: "dresses", subCategory: "cover_up" },
  dress: { category: "dresses", subCategory: "casual_dress" },
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

// Simulated store names and price ranges for realistic product results
const STORES = [
  { name: "Nordstrom", priceRange: [45, 200] },
  { name: "Zara", priceRange: [25, 120] },
  { name: "H&M", priceRange: [15, 70] },
  { name: "ASOS", priceRange: [20, 100] },
  { name: "Macy's", priceRange: [30, 150] },
  { name: "Uniqlo", priceRange: [15, 80] },
  { name: "Target", priceRange: [12, 50] },
  { name: "Banana Republic", priceRange: [40, 160] },
];

// Color variations for generating realistic product options
const COLOR_VARIATIONS: Record<string, { hex: string; name: string }[]> = {
  "#000000": [
    { hex: "#000000", name: "Black" },
    { hex: "#1A1A2E", name: "Jet Black" },
    { hex: "#2C2C2C", name: "Charcoal Black" },
  ],
  "#FFFFFF": [
    { hex: "#FFFFFF", name: "White" },
    { hex: "#FFFFF0", name: "Ivory" },
    { hex: "#FAF0E6", name: "Linen White" },
  ],
  "#4169E1": [
    { hex: "#4169E1", name: "Royal Blue" },
    { hex: "#1E90FF", name: "Dodger Blue" },
    { hex: "#4682B4", name: "Steel Blue" },
  ],
  "#DC143C": [
    { hex: "#DC143C", name: "Crimson" },
    { hex: "#B22222", name: "Firebrick" },
    { hex: "#FF4500", name: "Red-Orange" },
  ],
  default: [
    { hex: "#000000", name: "Black" },
    { hex: "#808080", name: "Gray" },
    { hex: "#FFFFFF", name: "White" },
  ],
};

function inferAttributes(text: string): ProductSearchResult {
  const result: ProductSearchResult = {};

  const sortedKeys = Object.keys(SUBCATEGORY_KEYWORDS).sort(
    (a, b) => b.length - a.length
  );
  for (const keyword of sortedKeys) {
    if (text.includes(keyword)) {
      const match = SUBCATEGORY_KEYWORDS[keyword];
      result.category = match.category;
      result.subCategory = match.subCategory;
      break;
    }
  }

  const sortedFabricKeys = Object.keys(FABRIC_KEYWORDS).sort(
    (a, b) => b.length - a.length
  );
  for (const keyword of sortedFabricKeys) {
    if (text.includes(keyword)) {
      result.fabricType = FABRIC_KEYWORDS[keyword];
      break;
    }
  }

  const sortedColorKeys = Object.keys(COLOR_KEYWORDS).sort(
    (a, b) => b.length - a.length
  );
  for (const keyword of sortedColorKeys) {
    if (text.includes(keyword)) {
      const hex = COLOR_KEYWORDS[keyword];
      const idx = PRESET_COLORS.findIndex((c) => c.hex === hex);
      if (idx >= 0) {
        result.colorIndex = idx;
      }
      break;
    }
  }

  return result;
}

/**
 * Infers clothing item attributes from a product name and optional brand.
 * Uses keyword matching — no network required.
 */
export async function searchProduct(
  name: string,
  brand?: string
): Promise<ProductSearchResult | null> {
  const text = `${name} ${brand ?? ""}`.toLowerCase().trim();
  const result = inferAttributes(text);

  const matchCount =
    (result.category ? 1 : 0) +
    (result.fabricType ? 1 : 0) +
    (result.colorIndex !== undefined ? 1 : 0);

  if (matchCount === 0) return null;
  return result;
}

/**
 * Simulates an online product search returning multiple options with details.
 * In production, this would call a real product API (Google Shopping, etc.).
 */
export async function searchProductsOnline(
  name: string,
  brand?: string
): Promise<OnlineProductOption[]> {
  const text = `${name} ${brand ?? ""}`.toLowerCase().trim();
  const attrs = inferAttributes(text);

  // Determine base color
  let baseColor = "#808080";
  let baseColorName = "Gray";
  if (attrs.colorIndex !== undefined) {
    baseColor = PRESET_COLORS[attrs.colorIndex].hex;
    baseColorName = PRESET_COLORS[attrs.colorIndex].name;
  }

  // Get color variations
  const variations =
    COLOR_VARIATIONS[baseColor] || COLOR_VARIATIONS["default"];

  // Generate 3-5 simulated product options from different "stores"
  const shuffledStores = [...STORES].sort(() => Math.random() - 0.5);
  const numResults = Math.min(4, Math.max(3, shuffledStores.length));
  const options: OnlineProductOption[] = [];

  // Capitalize first letter of each word
  const titleCase = (s: string) =>
    s.replace(/\b\w/g, (c) => c.toUpperCase());

  const baseName = titleCase(name.trim());

  for (let i = 0; i < numResults; i++) {
    const store = shuffledStores[i];
    const colorVar = variations[i % variations.length];
    const price =
      store.priceRange[0] +
      Math.floor(
        Math.random() * (store.priceRange[1] - store.priceRange[0])
      );

    // Create name variations
    let productName = baseName;
    if (i === 1 && brand) productName = `${titleCase(brand)} ${baseName}`;
    if (i === 2) productName = `${colorVar.name} ${baseName}`;
    if (i === 3) productName = `${baseName} - ${colorVar.name}`;

    options.push({
      id: `search_${Date.now()}_${i}`,
      name: productName,
      store: store.name,
      price: `$${price}.99`,
      color: colorVar.hex,
      colorName: colorVar.name,
      imageUri: null, // No real image - UI will show color placeholder
      category: attrs.category,
      subCategory: attrs.subCategory,
      fabricType: attrs.fabricType,
    });
  }

  // Simulate network delay
  await new Promise((r) => setTimeout(r, 800));

  return options;
}
