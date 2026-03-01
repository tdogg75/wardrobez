import * as FileSystem from "expo-file-system";
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
  cost?: number;
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
  "lounge shirt": { category: "tops", subCategory: "lounge_shirt" },
  "sport shirt": { category: "tops", subCategory: "sport" },
  cardigan: { category: "tops", subCategory: "cardigan" },
  blazer: { category: "blazers", subCategory: "casual_blazer" },
  "sport coat": { category: "blazers", subCategory: "casual_blazer" },
  "dress pants": { category: "bottoms", subCategory: "trousers" },
  slacks: { category: "bottoms", subCategory: "trousers" },
  trousers: { category: "bottoms", subCategory: "trousers" },
  jeans: { category: "bottoms", subCategory: "jeans" },
  leggings: { category: "bottoms", subCategory: "leggings" },
  chinos: { category: "bottoms", subCategory: "casual" },
  sweatpants: { category: "bottoms", subCategory: "sweatpants" },
  shorts: { category: "shorts", subCategory: "casual_shorts" },
  "athletic shorts": { category: "shorts", subCategory: "athletic_shorts" },
  skirt: { category: "skirts", subCategory: "midi_skirt" },
  "mini skirt": { category: "skirts", subCategory: "mini_skirt" },
  "midi skirt": { category: "skirts", subCategory: "midi_skirt" },
  "maxi skirt": { category: "skirts", subCategory: "maxi_skirt" },
  skort: { category: "skirts", subCategory: "skort" },
  "work dress": { category: "dresses", subCategory: "work_dress" },
  "office dress": { category: "dresses", subCategory: "work_dress" },
  "sheath dress": { category: "dresses", subCategory: "work_dress" },
  "casual dress": { category: "dresses", subCategory: "casual_dress" },
  sundress: { category: "dresses", subCategory: "sundress" },
  "sun dress": { category: "dresses", subCategory: "sundress" },
  "cover-up": { category: "dresses", subCategory: "cover_up" },
  "cover up": { category: "dresses", subCategory: "cover_up" },
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
  "winter boots": { category: "shoes", subCategory: "winter_boots" },
  "snow boots": { category: "shoes", subCategory: "winter_boots" },
  "running shoes": { category: "shoes", subCategory: "running_shoes" },
  sneakers: { category: "shoes", subCategory: "running_shoes" },
  trainers: { category: "shoes", subCategory: "running_shoes" },
  sandals: { category: "shoes", subCategory: "sandals" },
  "flip flops": { category: "shoes", subCategory: "casual_sandals" },
  slides: { category: "shoes", subCategory: "casual_sandals" },
  birkenstock: { category: "shoes", subCategory: "birks" },
  birks: { category: "shoes", subCategory: "birks" },
  "soccer shoes": { category: "shoes", subCategory: "soccer_shoes" },
  cleats: { category: "shoes", subCategory: "soccer_shoes" },
  flats: { category: "shoes", subCategory: "flats" },
  heels: { category: "shoes", subCategory: "heels" },
  pumps: { category: "shoes", subCategory: "heels" },
  boots: { category: "shoes", subCategory: "ankle_boots" },
  loafers: { category: "shoes", subCategory: "loafers" },
  belt: { category: "accessories", subCategory: "belts" },
  hat: { category: "accessories", subCategory: "hats" },
  sunglasses: { category: "accessories", subCategory: "sunglasses" },
  purse: { category: "purse", subCategory: "handbag" },
  handbag: { category: "purse", subCategory: "handbag" },
  backpack: { category: "purse", subCategory: "backpack" },
  tote: { category: "purse", subCategory: "tote" },
  clutch: { category: "purse", subCategory: "clutch" },
  crossbody: { category: "purse", subCategory: "crossbody" },
  watch: { category: "jewelry", subCategory: "watches" },
  earring: { category: "jewelry", subCategory: "earrings" },
  earrings: { category: "jewelry", subCategory: "earrings" },
  necklace: { category: "jewelry", subCategory: "necklaces" },
  bracelet: { category: "jewelry", subCategory: "bracelets" },
  ring: { category: "jewelry", subCategory: "rings" },
  bikini: { category: "swimwear", subCategory: "top" },
  "bikini top": { category: "swimwear", subCategory: "top" },
  "bikini bottom": { category: "swimwear", subCategory: "bottom" },
  "one piece": { category: "swimwear", subCategory: "one_piece" },
  "one-piece": { category: "swimwear", subCategory: "one_piece" },
  swimsuit: { category: "swimwear", subCategory: "one_piece" },
  "swim trunks": { category: "swimwear", subCategory: "bottom" },
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
  "club monaco": "clubmonaco.com",
  theory: "theory.com",
  "massimo dutti": "massimodutti.com",
  cos: "cos.com",
  "& other stories": "stories.com",
  roots: "roots.com",
  simons: "simons.ca",
  holtrenfrew: "holtrenfrew.com",
  "hudson's bay": "thebay.com",
  aldo: "aldoshoes.com",
  "steve madden": "stevemadden.com",
  amazon: "amazon.com",
  shein: "shein.com",
  "fashion nova": "fashionnova.com",
  abercrombie: "abercrombie.com",
  "american eagle": "ae.com",
};

// ── HTML helpers ──────────────────────────────────────────────────────

function extractMeta(html: string, property: string): string | null {
  // Try og:* and name=* patterns
  const patterns = [
    new RegExp(
      `<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`,
      "i",
    ),
    new RegExp(
      `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${property}["']`,
      "i",
    ),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) return m[1].trim();
  }
  return null;
}

function extractTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return m ? m[1].trim() : null;
}

function extractH1(html: string): string | null {
  const m = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (!m) return null;
  return m[1].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function extractBreadcrumbText(html: string): string {
  // Common breadcrumb containers
  const patterns = [
    /<(?:nav|ol|ul)[^>]+(?:class|aria-label)=["'][^"']*breadcrumb[^"']*["'][^>]*>([\s\S]*?)<\/(?:nav|ol|ul)>/i,
    /<[^>]+itemprop=["']breadcrumb["'][^>]*>([\s\S]*?)<\/[^>]+>/i,
    /<[^>]+(?:class)=["'][^"']*breadcrumb[^"']*["'][^>]*>([\s\S]*?)<\/(?:nav|div|ol|ul)>/i,
  ];
  for (const pattern of patterns) {
    const m = html.match(pattern);
    if (m) {
      return m[0].replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    }
  }
  return "";
}

function extractJsonLdProductType(html: string): string {
  const ldMatches = html.match(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  if (!ldMatches) return "";
  const parts: string[] = [];
  for (const block of ldMatches) {
    const jsonStr = block.replace(/<script[^>]*>|<\/script>/gi, "");
    try {
      const data = JSON.parse(jsonStr);
      const cat = findLdCategory(data);
      if (cat) parts.push(cat);
    } catch { /* skip */ }
  }
  return parts.join(" ");
}

function findLdCategory(data: any): string | null {
  if (!data) return null;
  if (Array.isArray(data)) {
    for (const item of data) {
      const c = findLdCategory(item);
      if (c) return c;
    }
    return null;
  }
  if (typeof data === "object") {
    if (typeof data.category === "string") return data.category;
    if (Array.isArray(data.category)) return data.category.join(" ");
    if (typeof data.productType === "string") return data.productType;
    if (Array.isArray(data.productType)) return data.productType.join(" ");
    if (typeof data.name === "string" && data["@type"] === "Product") return data.name;
    if (data["@graph"]) return findLdCategory(data["@graph"]);
    if (data.offers) return findLdCategory(data.offers);
  }
  return null;
}

function extractPrice(html: string): number | null {
  // Try structured data first (JSON-LD)
  const ldMatch = html.match(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  if (ldMatch) {
    for (const block of ldMatch) {
      const jsonStr = block.replace(
        /<script[^>]*>|<\/script>/gi,
        "",
      );
      try {
        const data = JSON.parse(jsonStr);
        const price = findPriceInLd(data);
        if (price != null) return price;
      } catch { /* skip invalid JSON */ }
    }
  }

  // Try meta tags
  const priceMeta =
    extractMeta(html, "product:price:amount") ??
    extractMeta(html, "og:price:amount");
  if (priceMeta) {
    const p = parseFloat(priceMeta);
    if (!isNaN(p)) return p;
  }

  // Try common price patterns in HTML
  const pricePatterns = [
    /\$\s*(\d+(?:\.\d{2})?)/,
    /(?:price|Price|PRICE)[^$]*\$\s*(\d+(?:\.\d{2})?)/,
    /data-price=["'](\d+(?:\.\d{2})?)/,
  ];
  for (const re of pricePatterns) {
    const m = html.match(re);
    if (m) {
      const p = parseFloat(m[1]);
      if (!isNaN(p) && p > 0 && p < 50000) return p;
    }
  }
  return null;
}

function findPriceInLd(data: any): number | null {
  if (!data) return null;
  if (Array.isArray(data)) {
    for (const item of data) {
      const p = findPriceInLd(item);
      if (p != null) return p;
    }
    return null;
  }
  if (typeof data === "object") {
    if (data.price != null) {
      const p = parseFloat(String(data.price));
      if (!isNaN(p)) return p;
    }
    if (data.offers) return findPriceInLd(data.offers);
    if (data.lowPrice != null) {
      const p = parseFloat(String(data.lowPrice));
      if (!isNaN(p)) return p;
    }
  }
  return null;
}

function extractProductImage(html: string): string | null {
  // og:image is the most reliable
  const ogImage = extractMeta(html, "og:image");
  if (ogImage && (ogImage.startsWith("http") || ogImage.startsWith("//"))) return ogImage;

  // Try twitter:image
  const twitterImage = extractMeta(html, "twitter:image");
  if (twitterImage && (twitterImage.startsWith("http") || twitterImage.startsWith("//"))) return twitterImage;

  // Try JSON-LD image (check all script blocks)
  const ldMatches = html.match(
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  );
  if (ldMatches) {
    for (const block of ldMatches) {
      try {
        const jsonStr = block.replace(/<script[^>]*>|<\/script>/gi, "");
        const data = JSON.parse(jsonStr);
        const img = findImageInLd(data);
        if (img) return img;
      } catch { /* skip */ }
    }
  }

  // Try product:image meta
  const productImage = extractMeta(html, "product:image");
  if (productImage && (productImage.startsWith("http") || productImage.startsWith("//"))) return productImage;

  return null;
}

function findImageInLd(data: any): string | null {
  if (!data) return null;
  if (Array.isArray(data)) {
    for (const item of data) {
      const img = findImageInLd(item);
      if (img) return img;
    }
    return null;
  }
  if (typeof data === "object") {
    if (typeof data.image === "string" && data.image.startsWith("http")) {
      return data.image;
    }
    if (Array.isArray(data.image) && data.image.length > 0) {
      const first = data.image[0];
      if (typeof first === "string" && first.startsWith("http")) return first;
      if (typeof first === "object" && first.url) return first.url;
    }
    if (data.image?.url) return data.image.url;
  }
  return null;
}

function inferAttributes(text: string): ProductSearchResult {
  const result: ProductSearchResult = {};

  // Normalize: replace hyphens with spaces so "t-shirt" matches "t shirt" from URL paths
  const normalized = text.replace(/-/g, " ");

  const sortedKeys = Object.keys(SUBCATEGORY_KEYWORDS).sort(
    (a, b) => b.length - a.length,
  );
  for (const keyword of sortedKeys) {
    const normalizedKw = keyword.replace(/-/g, " ");
    if (normalized.includes(normalizedKw) || text.includes(keyword)) {
      const match = SUBCATEGORY_KEYWORDS[keyword];
      result.category = match.category;
      result.subCategory = match.subCategory;
      break;
    }
  }

  const sortedFabricKeys = Object.keys(FABRIC_KEYWORDS).sort(
    (a, b) => b.length - a.length,
  );
  for (const keyword of sortedFabricKeys) {
    const normalizedKw = keyword.replace(/-/g, " ");
    if (normalized.includes(normalizedKw) || text.includes(keyword)) {
      result.fabricType = FABRIC_KEYWORDS[keyword];
      break;
    }
  }

  const sortedColorKeys = Object.keys(COLOR_KEYWORDS).sort(
    (a, b) => b.length - a.length,
  );
  for (const keyword of sortedColorKeys) {
    const normalizedKw = keyword.replace(/-/g, " ");
    if (normalized.includes(normalizedKw) || text.includes(keyword)) {
      const hex = COLOR_KEYWORDS[keyword];
      result.colorIndex = findClosestPresetIndex(hex);
      break;
    }
  }

  return result;
}

function inferBrandFromHostname(hostname: string): string | undefined {
  const clean = hostname.replace("www.", "").toLowerCase();

  for (const [brandName, domain] of Object.entries(BRAND_DOMAINS)) {
    if (clean.includes(domain.replace(".com", "").replace(".ca", ""))) {
      return brandName
        .split(/[\s&]+/)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(brandName.includes("&") ? " & " : " ");
    }
  }

  // Fallback: use hostname as brand
  const hostParts = clean
    .replace(".com", "")
    .replace(".ca", "")
    .replace(".co.uk", "")
    .split(".");
  const last = hostParts[hostParts.length - 1];
  if (last && last.length > 2 && last.length < 20) {
    return last.charAt(0).toUpperCase() + last.slice(1);
  }
  return undefined;
}

function cleanProductName(raw: string, brand?: string): string {
  let name = raw
    .replace(/\s*[-|–]\s*.{0,30}$/, "") // strip trailing " - Store Name"
    .replace(/\s*\|\s*.{0,30}$/, "")
    .replace(/\s{2,}/g, " ")
    .trim();

  // Remove brand prefix if it duplicates
  if (brand) {
    const re = new RegExp(`^${brand}\\s*[-:]?\\s*`, "i");
    name = name.replace(re, "").trim();
  }

  // Limit length
  if (name.length > 80) name = name.slice(0, 80).trim();
  return name;
}

/**
 * Download a remote image and save it locally so it can be used as a
 * clothing item photo.
 */
async function downloadImage(url: string): Promise<string | undefined> {
  try {
    // Handle protocol-relative URLs
    let resolvedUrl = url;
    if (resolvedUrl.startsWith("//")) {
      resolvedUrl = "https:" + resolvedUrl;
    }
    // Skip non-http URLs
    if (!resolvedUrl.startsWith("http")) return undefined;

    const filename = `product_${Date.now()}.jpg`;
    const localUri = `${FileSystem.documentDirectory}${filename}`;
    const result = await FileSystem.downloadAsync(resolvedUrl, localUri, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36",
        Accept: "image/*,*/*;q=0.8",
        Referer: resolvedUrl,
      },
    });
    if (result.status === 200) {
      // Verify the file has actual content (not an error page)
      const info = await FileSystem.getInfoAsync(result.uri);
      if (info.exists && (info as any).size > 500) {
        return result.uri;
      }
    }
    return undefined;
  } catch {
    return undefined;
  }
}

/**
 * Fetches the actual webpage at the given URL, parses the HTML for
 * product metadata (og:title, og:image, JSON-LD, price tags, etc.),
 * and populates as many fields as possible.
 */
export async function fetchProductFromUrl(
  url: string,
): Promise<ProductSearchResult | null> {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.replace("www.", "").toLowerCase();

    const result: ProductSearchResult = {};

    // Infer brand from domain
    result.brand = inferBrandFromHostname(hostname);

    // Fetch the actual webpage
    let html: string | null = null;
    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36",
          Accept: "text/html,application/xhtml+xml",
        },
      });
      if (response.ok) {
        html = await response.text();
      }
    } catch { /* network error — fall back to URL parsing */ }

    if (html) {
      // Extract product name from og:title or <title>
      const ogTitle = extractMeta(html, "og:title");
      const pageTitle = extractTitle(html);
      const rawName = ogTitle ?? pageTitle;
      if (rawName) {
        result.name = cleanProductName(rawName, result.brand);
      }

      // Extract product image
      const imageUrl = extractProductImage(html);
      if (imageUrl) {
        const localUri = await downloadImage(imageUrl);
        if (localUri) result.imageUri = localUri;
      }

      // Extract price
      const price = extractPrice(html);
      if (price != null) result.cost = price;

      // Extract description for keyword matching
      const desc = (
        extractMeta(html, "og:description") ??
        extractMeta(html, "description") ??
        ""
      ).toLowerCase();

      // Additional signals: h1, breadcrumbs, JSON-LD product type
      const h1 = (extractH1(html) ?? "").toLowerCase();
      const breadcrumbs = extractBreadcrumbText(html).toLowerCase();
      const ldProductType = extractJsonLdProductType(html).toLowerCase();

      // Include URL path for better category/type detection
      const pathText = decodeURIComponent(parsed.pathname)
        .replace(/[-_/]/g, " ")
        .toLowerCase();

      const fullText =
        `${hostname} ${pathText} ${result.name ?? ""} ${desc} ${h1} ${breadcrumbs} ${ldProductType}`.toLowerCase();
      const attrs = inferAttributes(fullText);
      if (attrs.category) result.category = attrs.category;
      if (attrs.subCategory) result.subCategory = attrs.subCategory;
      if (attrs.fabricType) result.fabricType = attrs.fabricType;
      if (attrs.colorIndex !== undefined) result.colorIndex = attrs.colorIndex;
    } else {
      // Fallback: parse URL path for keywords
      const pathText = decodeURIComponent(parsed.pathname)
        .replace(/[-_/]/g, " ")
        .toLowerCase();
      const fullText = `${hostname} ${pathText}`;
      const attrs = inferAttributes(fullText);
      Object.assign(result, attrs);

      // Try to build a name from the URL
      const segments = parsed.pathname.split("/").filter(Boolean);
      for (
        let i = segments.length - 1;
        i >= Math.max(0, segments.length - 2);
        i--
      ) {
        const name = segments[i]
          .replace(/[-_]/g, " ")
          .replace(/\d{5,}/g, "")
          .replace(/\.(html?|aspx?|php|jsp)/gi, "")
          .toLowerCase()
          .split(/\s+/)
          .filter((w) => w.length > 1)
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .slice(0, 5)
          .join(" ")
          .trim();
        if (name.length > 2) {
          result.name = name;
          break;
        }
      }
    }

    // Check if we got anything useful
    const matchCount =
      (result.category ? 1 : 0) +
      (result.fabricType ? 1 : 0) +
      (result.colorIndex !== undefined ? 1 : 0) +
      (result.brand ? 1 : 0) +
      (result.name ? 1 : 0) +
      (result.imageUri ? 1 : 0) +
      (result.cost != null ? 1 : 0);

    if (matchCount === 0) return null;
    return result;
  } catch {
    return null;
  }
}

/**
 * Local keyword-based inference (no network). Used for quick lookups.
 */
export async function searchProduct(
  name: string,
  brand?: string,
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
