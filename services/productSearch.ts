import type { ClothingCategory, FabricType } from "@/models/types";
import { PRESET_COLORS, findClosestPresetIndex } from "@/constants/colors";

export interface ProductSearchResult {
  category?: ClothingCategory;
  subCategory?: string;
  fabricType?: FabricType;
  colorIndex?: number;
  name?: string;
  brand?: string;
  imageUri?: string;
}

export interface OnlineProductOption {
  id: string;
  name: string;
  store: string;
  price: string;
  color: string; // hex
  colorName: string;
  imageUri: string | null;
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
  polo: { category: "tops", subCategory: "polo" },
  "workout shirt": { category: "tops", subCategory: "workout_shirt" },
  cardigan: { category: "tops", subCategory: "sweater" },
  blazer: { category: "blazers", subCategory: "casual_blazer" },
  "sport coat": { category: "blazers", subCategory: "sport_coat" },
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
  gown: { category: "dresses", subCategory: "formal_dress" },
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
  "jean jacket": { category: "jackets", subCategory: "jean_jacket" },
  "denim jacket": { category: "jackets", subCategory: "jean_jacket" },
  parka: { category: "jackets", subCategory: "parka" },
  "spring jacket": { category: "jackets", subCategory: "spring_jacket" },
  "light jacket": { category: "jackets", subCategory: "spring_jacket" },
  raincoat: { category: "jackets", subCategory: "raincoat" },
  "rain jacket": { category: "jackets", subCategory: "raincoat" },
  "work jacket": { category: "jackets", subCategory: "work_jacket" },
  "ski jacket": { category: "jackets", subCategory: "ski_jacket" },
  coat: { category: "jackets", subCategory: "work_jacket" },
  jacket: { category: "jackets", subCategory: "spring_jacket" },
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
  "dark wash": "#1B3A5C",
  "medium wash": "#4A6FA5",
  "light wash": "#8AADCE",
  "raw indigo": "#2C3E50",
};

// Well-known brand domains for prioritization
const BRAND_DOMAINS: Record<string, string> = {
  nike: "nike.com",
  adidas: "adidas.com",
  zara: "zara.com",
  "h&m": "hm.com",
  uniqlo: "uniqlo.com",
  "banana republic": "bananarepublic.com",
  gap: "gap.com",
  "old navy": "oldnavy.com",
  nordstrom: "nordstrom.com",
  asos: "asos.com",
  levi: "levi.com",
  levis: "levi.com",
  "ralph lauren": "ralphlauren.com",
  "j crew": "jcrew.com",
  "j.crew": "jcrew.com",
  mango: "mango.com",
  aritzia: "aritzia.com",
  lululemon: "lululemon.com",
  everlane: "everlane.com",
  target: "target.com",
  puma: "puma.com",
  "new balance": "newbalance.com",
  gucci: "gucci.com",
  prada: "prada.com",
  burberry: "burberry.com",
  "tommy hilfiger": "tommy.com",
  "calvin klein": "calvinklein.com",
  coach: "coach.com",
  "michael kors": "michaelkors.com",
  anthropologie: "anthropologie.com",
  "free people": "freepeople.com",
  express: "express.com",
  "forever 21": "forever21.com",
};

// Realistic store data for search results
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
  "#1B3A5C": [
    { hex: "#1B3A5C", name: "Dark Wash" },
    { hex: "#1A2E4A", name: "Deep Indigo" },
    { hex: "#2C4A6E", name: "Dark Denim" },
  ],
  "#4A6FA5": [
    { hex: "#4A6FA5", name: "Medium Wash" },
    { hex: "#5C7FB5", name: "Classic Blue" },
    { hex: "#3D6494", name: "Vintage Wash" },
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
      result.colorIndex = findClosestPresetIndex(hex);
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
 * Searches for products online, prioritizing the brand's own website.
 * In a production app this would use a real product API.
 * Currently uses smart keyword matching to produce realistic simulated results.
 */
export async function searchProductsOnline(
  name: string,
  brand?: string
): Promise<OnlineProductOption[]> {
  const text = `${name} ${brand ?? ""}`.toLowerCase().trim();
  const attrs = inferAttributes(text);

  // Determine base color
  let baseColor = "#808080";
  if (attrs.colorIndex !== undefined) {
    baseColor = PRESET_COLORS[attrs.colorIndex].hex;
  }

  // Get color variations
  const variations =
    COLOR_VARIATIONS[baseColor] || COLOR_VARIATIONS["default"];

  // Capitalize first letter of each word
  const titleCase = (s: string) =>
    s.replace(/\b\w/g, (c) => c.toUpperCase());

  const baseName = titleCase(name.trim());

  // Build store list — brand store first if available
  const storeList = [...STORES];
  let brandStore: (typeof STORES)[0] | null = null;

  if (brand) {
    const brandLower = brand.toLowerCase();
    const domain = BRAND_DOMAINS[brandLower];
    if (domain) {
      brandStore = {
        name: titleCase(brand),
        priceRange: [30, 150],
      };
    }
  }

  // If brand recognized, put its store first
  const orderedStores = brandStore
    ? [brandStore, ...storeList.filter((s) => s.name.toLowerCase() !== brand?.toLowerCase())]
    : storeList.sort(() => Math.random() - 0.5);

  const numResults = Math.min(4, Math.max(3, orderedStores.length));
  const options: OnlineProductOption[] = [];

  for (let i = 0; i < numResults; i++) {
    const store = orderedStores[i];
    const colorVar = variations[i % variations.length];
    const price =
      store.priceRange[0] +
      Math.floor(
        Math.random() * (store.priceRange[1] - store.priceRange[0])
      );

    // Create name variations with brand prominently featured
    let productName = baseName;
    if (i === 0 && brand) productName = `${titleCase(brand)} ${baseName}`;
    else if (i === 1) productName = `${colorVar.name} ${baseName}`;
    else if (i === 2 && brand) productName = `${baseName} by ${titleCase(brand)}`;
    else if (i === 3) productName = `${baseName} - ${colorVar.name}`;

    options.push({
      id: `search_${Date.now()}_${i}`,
      name: productName,
      store: store.name,
      price: `$${price}.99`,
      color: colorVar.hex,
      colorName: colorVar.name,
      imageUri: null,
      category: attrs.category,
      subCategory: attrs.subCategory,
      fabricType: attrs.fabricType,
    });
  }

  // Simulate network delay
  await new Promise((r) => setTimeout(r, 600));

  return options;
}

/**
 * Attempts to extract product info from a URL.
 * Parses the URL path/hostname for brand, category, color, and fabric keywords.
 * Also constructs a likely product image URL from the page.
 */
export async function fetchProductFromUrl(
  url: string
): Promise<ProductSearchResult | null> {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.replace("www.", "").toLowerCase();
    const pathText = decodeURIComponent(parsed.pathname)
      .replace(/[-_/]/g, " ")
      .toLowerCase();
    const fullText = `${hostname} ${pathText}`;

    const result = inferAttributes(fullText);

    // Try to extract brand from hostname
    for (const [brandName, domain] of Object.entries(BRAND_DOMAINS)) {
      if (hostname.includes(domain.replace(".com", ""))) {
        result.brand = brandName.charAt(0).toUpperCase() + brandName.slice(1);
        break;
      }
    }

    // Try to extract product name from URL path segments
    const segments = parsed.pathname.split("/").filter(Boolean);
    const lastSegment = segments[segments.length - 1];
    if (lastSegment) {
      const cleanName = lastSegment
        .replace(/[-_]/g, " ")
        .replace(/\b\w/g, (c) => c.toUpperCase())
        .replace(/\d{5,}/g, "") // Remove product IDs
        .trim();
      if (cleanName.length > 2) {
        result.name = cleanName;
      }
    }

    // Construct a plausible product image URL from the page
    // In production, this would fetch the page and extract og:image or the main product image.
    // For now, we construct a simulated product image from the URL.
    result.imageUri = constructProductImageUri(parsed, hostname);

    const matchCount =
      (result.category ? 1 : 0) +
      (result.fabricType ? 1 : 0) +
      (result.colorIndex !== undefined ? 1 : 0) +
      (result.brand ? 1 : 0) +
      (result.name ? 1 : 0);

    if (matchCount === 0) return null;

    // Simulate network delay for URL fetch
    await new Promise((r) => setTimeout(r, 800));

    return result;
  } catch {
    return null;
  }
}

/**
 * Constructs a plausible product image URI from the URL.
 * In a real app, this would fetch the page and extract the og:image meta tag
 * or parse the product page for the main image.
 */
function constructProductImageUri(parsed: URL, hostname: string): string | undefined {
  // Known retailer image patterns — in production we'd fetch the actual page
  const pathSegments = parsed.pathname.split("/").filter(Boolean);

  // For known brands, construct a likely CDN image path
  if (hostname.includes("zara")) {
    return `https://static.zara.net/photos/${pathSegments.slice(-1)[0] || "product"}_1_1_1.jpg`;
  }
  if (hostname.includes("hm")) {
    return `https://lp2.hm.com/hmgoepprod?set=source[${pathSegments.slice(-1)[0] || "product"}]&width=600`;
  }
  if (hostname.includes("uniqlo")) {
    return `https://image.uniqlo.com/UQ/ST3/WesternCommon/imagesgoods/${pathSegments.slice(-1)[0] || "product"}/goods_09.jpg`;
  }
  if (hostname.includes("nike")) {
    return `https://static.nike.com/a/images/t_PDP_1280_v1/${pathSegments.slice(-1)[0] || "product"}.jpg`;
  }
  if (hostname.includes("nordstrom")) {
    return `https://n.nordstrommedia.com/id/${pathSegments.slice(-1)[0] || "product"}.jpeg`;
  }

  // Generic: no image available from URL alone
  return undefined;
}
