import type { ClothingCategory, FabricType } from "@/models/types";
import { SUBCATEGORIES, FABRIC_TYPE_LABELS } from "@/models/types";

export interface BarcodeProductResult {
  name?: string;
  brand?: string;
  category?: ClothingCategory;
  subCategory?: string;
  fabricType?: FabricType;
  careInstructions?: string[];
  cost?: number;
}

/**
 * Look up a UPC/EAN barcode via the Open Food Facts / Open Beauty Facts API
 * or the UPC Item DB API (free tier). Falls back to keyword parsing.
 */
export async function lookupBarcode(code: string): Promise<BarcodeProductResult | null> {
  // Try UPC item DB (free, no key required for basic lookups)
  try {
    const res = await fetch(`https://api.upcitemdb.com/prod/trial/lookup?upc=${code}`, {
      headers: { Accept: "application/json" },
    });
    if (res.ok) {
      const data = await res.json();
      if (data.items?.length > 0) {
        const item = data.items[0];
        return parseProductData(item.title, item.brand, item.description, item.category);
      }
    }
  } catch {
    // fall through
  }

  // Try Open Food Facts (works for some products)
  try {
    const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${code}.json`);
    if (res.ok) {
      const data = await res.json();
      if (data.status === 1 && data.product) {
        const p = data.product;
        return parseProductData(
          p.product_name,
          p.brands,
          p.categories ?? "",
          p.categories ?? ""
        );
      }
    }
  } catch {
    // fall through
  }

  return null;
}

// Category keyword detection
const CATEGORY_KEYWORDS: Record<ClothingCategory, string[]> = {
  tops: ["shirt", "blouse", "top", "tee", "t-shirt", "tank", "sweater", "sweatshirt", "hoodie", "polo", "henley", "tunic", "camisole"],
  bottoms: ["pants", "jeans", "trousers", "leggings", "chinos", "joggers", "sweatpants", "slacks"],
  shorts: ["shorts", "bermuda"],
  skirts: ["skirt", "midi", "maxi skirt", "mini skirt"],
  dresses: ["dress", "gown", "romper"],
  jumpsuits: ["jumpsuit", "overalls", "onesie"],
  blazers: ["blazer", "sport coat"],
  jackets: ["jacket", "coat", "parka", "windbreaker", "raincoat", "vest", "anorak"],
  shoes: ["shoes", "sneakers", "boots", "sandals", "heels", "flats", "loafers", "mules", "pumps", "oxfords", "birkenstocks"],
  accessories: ["belt", "scarf", "hat", "sunglasses", "gloves", "tie", "socks", "stockings"],
  purse: ["purse", "handbag", "backpack", "tote", "clutch", "crossbody", "wallet", "bag"],
  swimwear: ["swimsuit", "bikini", "swim", "trunks", "bathing suit"],
  jewelry: ["necklace", "bracelet", "earring", "ring", "watch", "anklet"],
};

// Fabric keyword detection
const FABRIC_KEYWORDS: Partial<Record<FabricType, string[]>> = {
  cotton: ["cotton"],
  linen: ["linen"],
  silk: ["silk"],
  polyester: ["polyester"],
  wool: ["wool", "merino"],
  denim: ["denim"],
  leather: ["leather"],
  nylon: ["nylon"],
  cashmere: ["cashmere"],
  satin: ["satin"],
  fleece: ["fleece"],
};

function parseProductData(
  title: string = "",
  brand: string = "",
  description: string = "",
  categoryStr: string = ""
): BarcodeProductResult {
  const result: BarcodeProductResult = {};
  const text = `${title} ${description} ${categoryStr}`.toLowerCase();

  if (title) result.name = title;
  if (brand) result.brand = brand;

  // Detect category
  for (const [cat, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some((kw) => text.includes(kw))) {
      result.category = cat as ClothingCategory;

      // Try to detect subcategory
      const subs = SUBCATEGORIES[cat as ClothingCategory] ?? [];
      for (const sub of subs) {
        const subLabel = sub.label.toLowerCase();
        if (text.includes(subLabel) || text.includes(sub.value.replace(/_/g, " "))) {
          result.subCategory = sub.value;
          break;
        }
      }
      break;
    }
  }

  // Detect fabric type
  for (const [fabric, keywords] of Object.entries(FABRIC_KEYWORDS)) {
    if (keywords?.some((kw) => text.includes(kw))) {
      result.fabricType = fabric as FabricType;
      break;
    }
  }

  return result;
}
