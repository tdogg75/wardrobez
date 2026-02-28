import * as AuthSession from "expo-auth-session";
import * as WebBrowser from "expo-web-browser";
import * as FileSystem from "expo-file-system";

WebBrowser.maybeCompleteAuthSession();

const SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"];

const discovery = {
  authorizationEndpoint: "https://accounts.google.com/o/oauth2/v2/auth",
  tokenEndpoint: "https://oauth2.googleapis.com/token",
  revocationEndpoint: "https://oauth2.googleapis.com/revoke",
};

/* ---------- Types ---------- */

export interface GmailLineItem {
  name: string;
  price?: string;
  imageUrl?: string;
  localImageUri?: string;
  productUrl?: string;
}

export interface GmailPurchaseItem {
  id: string;           // Gmail message ID
  from: string;         // From header
  vendor: string;
  subject: string;      // Raw subject
  date: string;
  snippet: string;      // 2-3 line summary
  price: string;        // total price string
  thumbnailUrl?: string;
  localImageUri?: string;
  /** Detected individual line items in the order */
  lineItems: GmailLineItem[];
  /** URLs found in the email body that could be product links */
  productUrls: string[];
  /** Whether this email was previously imported */
  previouslyImported?: boolean;
}

/* ---------- Client ID persistence ---------- */

const CLIENT_ID_PATH = `${FileSystem.documentDirectory}wardrobez-data/google-client-id.txt`;

export async function getSavedClientId(): Promise<string | null> {
  try {
    const info = await FileSystem.getInfoAsync(CLIENT_ID_PATH);
    if (!info.exists) return null;
    const id = await FileSystem.readAsStringAsync(CLIENT_ID_PATH);
    return id.trim() || null;
  } catch {
    return null;
  }
}

export async function saveClientId(clientId: string): Promise<void> {
  const dir = `${FileSystem.documentDirectory}wardrobez-data/`;
  const dirInfo = await FileSystem.getInfoAsync(dir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
  await FileSystem.writeAsStringAsync(CLIENT_ID_PATH, clientId.trim());
}

/* ---------- Imported email IDs persistence ---------- */

const IMPORTED_IDS_PATH = `${FileSystem.documentDirectory}wardrobez-data/imported-gmail-ids.json`;

export async function getImportedEmailIds(): Promise<Set<string>> {
  try {
    const info = await FileSystem.getInfoAsync(IMPORTED_IDS_PATH);
    if (!info.exists) return new Set();
    const raw = await FileSystem.readAsStringAsync(IMPORTED_IDS_PATH);
    return new Set(JSON.parse(raw));
  } catch { return new Set(); }
}

export async function markEmailImported(id: string): Promise<void> {
  const ids = await getImportedEmailIds();
  ids.add(id);
  const dir = `${FileSystem.documentDirectory}wardrobez-data/`;
  const dirInfo = await FileSystem.getInfoAsync(dir);
  if (!dirInfo.exists) await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  await FileSystem.writeAsStringAsync(IMPORTED_IDS_PATH, JSON.stringify([...ids]));
}

/* ---------- Auth helpers ---------- */

let cachedToken: string | null = null;

export function getRedirectUri(): string {
  return AuthSession.makeRedirectUri({ scheme: "wardrobez" });
}

/**
 * Returns true when the redirect URI uses `exp://` (Expo Go),
 * which Google OAuth rejects because it isn't HTTPS.
 * Google OAuth only works in standalone / development builds
 * where the `wardrobez://` custom scheme is properly registered.
 */
export function isOAuthRedirectSupported(): boolean {
  const uri = getRedirectUri();
  return !uri.startsWith("exp://");
}

export async function signInWithGoogle(clientId: string): Promise<string | null> {
  if (!clientId) return null;

  const redirectUri = getRedirectUri();

  const request = new AuthSession.AuthRequest({
    clientId,
    redirectUri,
    scopes: SCOPES,
    responseType: AuthSession.ResponseType.Token,
    usePKCE: false,
  });

  const result = await request.promptAsync(discovery);

  if (result.type === "success" && result.authentication?.accessToken) {
    cachedToken = result.authentication.accessToken;
    return cachedToken;
  }
  return null;
}

export function getCachedToken(): string | null {
  return cachedToken;
}

export function clearToken(): void {
  cachedToken = null;
}

export function setManualToken(token: string): void {
  cachedToken = token;
}

/* ---------- Gmail API helpers ---------- */

interface GmailMessage {
  id: string;
  threadId: string;
}

interface GmailMessageDetail {
  id: string;
  snippet: string;
  payload: {
    headers: { name: string; value: string }[];
    body?: { data?: string };
    parts?: Array<{
      mimeType: string;
      body?: { data?: string };
      parts?: Array<{
        mimeType: string;
        body?: { data?: string };
      }>;
    }>;
  };
  internalDate: string;
}

async function gmailFetch<T>(
  endpoint: string,
  token: string
): Promise<T | null> {
  try {
    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/${endpoint}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

function decodeBase64Url(data: string): string {
  const base64 = data.replace(/-/g, "+").replace(/_/g, "/");
  try {
    return decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
  } catch {
    return atob(base64);
  }
}

function getHeader(
  headers: { name: string; value: string }[],
  name: string
): string {
  const h = headers.find(
    (h) => h.name.toLowerCase() === name.toLowerCase()
  );
  return h?.value ?? "";
}

function getBodyText(payload: GmailMessageDetail["payload"]): string {
  if (payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }
  if (payload.parts) {
    // Try text/html first (richer for product extraction), then text/plain
    for (const part of payload.parts) {
      if (part.mimeType === "text/html" && part.body?.data) {
        return decodeBase64Url(part.body.data);
      }
      // Check nested parts (multipart/alternative within multipart/mixed)
      if (part.parts) {
        for (const sub of part.parts) {
          if (sub.mimeType === "text/html" && sub.body?.data) {
            return decodeBase64Url(sub.body.data);
          }
        }
      }
    }
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        return decodeBase64Url(part.body.data);
      }
      if (part.parts) {
        for (const sub of part.parts) {
          if (sub.mimeType === "text/plain" && sub.body?.data) {
            return decodeBase64Url(sub.body.data);
          }
        }
      }
    }
  }
  return "";
}

function getPlainText(payload: GmailMessageDetail["payload"]): string {
  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        return decodeBase64Url(part.body.data);
      }
      if (part.parts) {
        for (const sub of part.parts) {
          if (sub.mimeType === "text/plain" && sub.body?.data) {
            return decodeBase64Url(sub.body.data);
          }
        }
      }
    }
  }
  if (payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }
  return "";
}

/* ---------- Purchase detection ---------- */

// Common clothing/fashion retailers & keywords
const FASHION_VENDORS = [
  "zara",
  "h&m",
  "uniqlo",
  "nike",
  "adidas",
  "asos",
  "nordstrom",
  "gap",
  "old navy",
  "banana republic",
  "j.crew",
  "lululemon",
  "anthropologie",
  "urban outfitters",
  "free people",
  "mango",
  "shein",
  "forever 21",
  "express",
  "topshop",
  "cos",
  "artizia",
  "aritzia",
  "sephora",
  "revolve",
  "amazon",
  "etsy",
  "ebay",
  "poshmark",
  "depop",
  "gucci",
  "prada",
  "louis vuitton",
  "coach",
  "michael kors",
  "kate spade",
  "tiffany",
  "pandora",
  "swarovski",
  "foot locker",
  "finish line",
  "dsw",
  "zappos",
  "steve madden",
  "stuart weitzman",
  "vans",
  "converse",
  "new balance",
  "reebok",
  "puma",
  "under armour",
  "levi",
  "wrangler",
  "ralph lauren",
  "tommy hilfiger",
  "calvin klein",
  "armani",
  "versace",
  "burberry",
  "abercrombie",
  "hollister",
  "american eagle",
  "patagonia",
  "the north face",
  "columbia",
  "canada goose",
  "moncler",
];

const CLOTHING_KEYWORDS = [
  "shirt",
  "pants",
  "jeans",
  "dress",
  "skirt",
  "jacket",
  "coat",
  "sweater",
  "hoodie",
  "blouse",
  "cardigan",
  "blazer",
  "suit",
  "shorts",
  "leggings",
  "sneakers",
  "shoes",
  "boots",
  "sandals",
  "heels",
  "flats",
  "loafers",
  "ring",
  "necklace",
  "bracelet",
  "earring",
  "watch",
  "belt",
  "hat",
  "scarf",
  "gloves",
  "swimsuit",
  "bikini",
  "t-shirt",
  "tee",
  "polo",
  "tank top",
  "vest",
  "parka",
  "windbreaker",
  "socks",
  "underwear",
  "bra",
  "joggers",
  "sweatpants",
  "tracksuit",
  "romper",
  "jumpsuit",
  "handbag",
  "purse",
  "backpack",
  "tote",
  "clutch",
  "sunglasses",
  "jewelry",
  "jewellery",
  "accessory",
  "accessories",
  "clothing",
  "apparel",
  "fashion",
  "wear",
  "outfit",
  "denim",
  "leather",
  "silk",
  "linen",
  "cashmere",
  "wool",
];

const ORDER_KEYWORDS = [
  "order confirmation",
  "order confirmed",
  "your order",
  "purchase confirmation",
  "thank you for your order",
  "order receipt",
  "your receipt",
  "shipping confirmation",
  "has shipped",
  "delivery confirmation",
  "order #",
  "order number",
  "invoice",
  "payment received",
  "thank you for your purchase",
  "bought",
];

const HOUSEHOLD_EXCLUSION_KEYWORDS = [
  "furniture",
  "sofa",
  "couch",
  "table",
  "desk",
  "lamp",
  "rug",
  "mattress",
  "bed frame",
  "bookshelf",
  "kitchen",
  "appliance",
  "candle",
  "detergent",
  "cleaning",
  "supplement",
  "vitamin",
  "grocery",
  "food",
];

function isClothingPurchase(subject: string, body: string, from: string): boolean {
  const text = `${subject} ${body} ${from}`.toLowerCase();

  // Must look like an order/purchase email
  const hasOrderKeyword = ORDER_KEYWORDS.some((kw) => text.includes(kw));
  if (!hasOrderKeyword) return false;

  // Check for fashion vendor or clothing keywords
  const hasFashionVendor = FASHION_VENDORS.some((v) => text.includes(v));
  const hasClothingKeyword = CLOTHING_KEYWORDS.some((kw) => text.includes(kw));
  const hasHouseholdKeyword = HOUSEHOLD_EXCLUSION_KEYWORDS.some((kw) => text.includes(kw));

  // If it has clothing signals, include it (even if it also has household keywords - mixed orders)
  if (hasFashionVendor || hasClothingKeyword) return true;

  // If it only has household keywords and no clothing keywords at all, exclude it
  if (hasHouseholdKeyword) return false;

  return false;
}

function extractPrice(text: string): string {
  // Try to find a "total" price first
  const totalPatterns = [
    /(?:order\s+)?total[:\s]*(?:CA?\$|US\$|USD|GBP|EUR|£|€|\$)\s*(\d{1,6}(?:[.,]\d{2})?)/i,
    /(?:order\s+)?total[:\s]*(\d{1,6}(?:[.,]\d{2})?)\s*(?:USD|CAD|GBP|EUR)/i,
  ];
  for (const pattern of totalPatterns) {
    const match = text.match(pattern);
    if (match) return match[0].trim();
  }

  // Match common price patterns: $49.99, USD 49.99, 49.99 USD, CA$29.99, etc.
  const pricePatterns = [
    /(?:CA?\$|US\$|USD|GBP|EUR|£|€)\s*(\d{1,6}(?:[.,]\d{2})?)/i,
    /(\d{1,6}(?:[.,]\d{2})?)\s*(?:USD|CAD|GBP|EUR)/i,
    /\$\s*(\d{1,6}(?:[.,]\d{2})?)/,
    /total[:\s]*\$?\s*(\d{1,6}(?:[.,]\d{2})?)/i,
    /amount[:\s]*\$?\s*(\d{1,6}(?:[.,]\d{2})?)/i,
  ];
  for (const pattern of pricePatterns) {
    const match = text.match(pattern);
    if (match) {
      const raw = match[0].trim();
      return raw;
    }
  }
  return "";
}

function extractVendor(from: string, subject: string): string {
  // Try to get vendor name from the "From" header
  // Format: "Vendor Name <email@vendor.com>" or just "email@vendor.com"
  const nameMatch = from.match(/^"?([^"<]+)"?\s*</);
  if (nameMatch) {
    return nameMatch[1].trim();
  }
  // Fall back to domain
  const domainMatch = from.match(/@([^.>]+)\./);
  if (domainMatch) {
    const domain = domainMatch[1];
    return domain.charAt(0).toUpperCase() + domain.slice(1);
  }
  // Last resort: use subject
  return subject.split(/[-–|]/)[0].trim().slice(0, 40);
}

/* ---------- Line item extraction ---------- */

function extractLineItems(subject: string, body: string, vendor: string): GmailLineItem[] {
  const items: GmailLineItem[] = [];

  // Strategy 1: Look for <tr> rows containing product info (common in order emails)
  // Match table rows that contain both a product name and a price
  const trRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let trMatch: RegExpExecArray | null;
  while ((trMatch = trRegex.exec(body)) !== null) {
    const rowHtml = trMatch[1];
    const rowText = rowHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

    // Check if this row has a price
    const priceMatch = rowText.match(/\$\s*\d+(?:\.\d{2})?/);
    if (!priceMatch) continue;

    // Check if it looks like a product row (has some text that isn't just a price or label)
    const cleanedText = rowText
      .replace(/\$\s*\d+(?:\.\d{2})?/g, "")
      .replace(/(?:qty|quantity|price|total|subtotal|tax|shipping)[:\s]*/gi, "")
      .replace(/\d+\s*x\s*/gi, "")
      .trim();

    if (cleanedText.length < 3 || cleanedText.length > 200) continue;
    // Skip header/footer rows
    if (/^(item|product|description|name|order summary)/i.test(cleanedText)) continue;
    if (/^(subtotal|total|tax|shipping|discount|promo)/i.test(cleanedText)) continue;

    // Extract image from the row
    const imgMatch = rowHtml.match(/<img[^>]+src=["']?(https?:\/\/[^"'\s>]+)["']?/i);
    let imageUrl: string | undefined;
    if (imgMatch) {
      const url = imgMatch[1];
      if (!url.includes("track") && !url.includes("pixel") && !url.includes("beacon") && !url.includes("1x1")) {
        imageUrl = url;
      }
    }

    // Extract product URL from the row
    const linkMatch = rowHtml.match(/<a[^>]+href=["']?(https?:\/\/[^"'\s>]+)["']?[^>]*>/i);
    let productUrl: string | undefined;
    if (linkMatch) {
      const url = linkMatch[1];
      if (isProductLink(url)) {
        productUrl = url;
      }
    }

    items.push({
      name: cleanedText.slice(0, 80),
      price: priceMatch[0],
      imageUrl,
      productUrl,
    });
  }

  // Strategy 2: Look for <li> tags with product info
  if (items.length === 0) {
    const liRegex = /<li[^>]*>([\s\S]*?)<\/li>/gi;
    let liMatch: RegExpExecArray | null;
    while ((liMatch = liRegex.exec(body)) !== null) {
      const liHtml = liMatch[1];
      const liText = liHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();

      const priceMatch = liText.match(/\$\s*\d+(?:\.\d{2})?/);
      if (!priceMatch) continue;

      const cleanedText = liText
        .replace(/\$\s*\d+(?:\.\d{2})?/g, "")
        .replace(/(?:qty|quantity|price)[:\s]*/gi, "")
        .trim();

      if (cleanedText.length < 3 || cleanedText.length > 200) continue;
      if (/^(subtotal|total|tax|shipping)/i.test(cleanedText)) continue;

      const imgMatch = liHtml.match(/<img[^>]+src=["']?(https?:\/\/[^"'\s>]+)["']?/i);
      let imageUrl: string | undefined;
      if (imgMatch) {
        const url = imgMatch[1];
        if (!url.includes("track") && !url.includes("pixel") && !url.includes("beacon") && !url.includes("1x1")) {
          imageUrl = url;
        }
      }

      const linkMatch = liHtml.match(/<a[^>]+href=["']?(https?:\/\/[^"'\s>]+)["']?[^>]*>/i);
      let productUrl: string | undefined;
      if (linkMatch && isProductLink(linkMatch[1])) {
        productUrl = linkMatch[1];
      }

      items.push({
        name: cleanedText.slice(0, 80),
        price: priceMatch[0],
        imageUrl,
        productUrl,
      });
    }
  }

  // Strategy 3: Look for patterns like "Item Name ... $XX.XX" in plain text lines
  if (items.length === 0) {
    const plainBody = body.replace(/<[^>]+>/g, "\n").replace(/&nbsp;/gi, " ");
    const lines = plainBody.split("\n").map((l) => l.trim()).filter(Boolean);
    for (const line of lines) {
      const priceMatch = line.match(/\$\s*\d+(?:\.\d{2})?/);
      if (!priceMatch) continue;

      const nameText = line
        .replace(/\$\s*\d+(?:\.\d{2})?/g, "")
        .replace(/(?:qty|quantity|price)[:\s]*/gi, "")
        .replace(/\d+\s*x\s*/gi, "")
        .trim();

      if (nameText.length < 3 || nameText.length > 120) continue;
      if (/^(subtotal|total|tax|shipping|discount|promo|order|delivery|handling)/i.test(nameText)) continue;

      // Check that the name contains at least one clothing keyword for relevance
      const nameLower = nameText.toLowerCase();
      const hasClothing = CLOTHING_KEYWORDS.some((kw) => nameLower.includes(kw));
      if (!hasClothing && items.length > 0) continue;

      items.push({
        name: nameText.slice(0, 80),
        price: priceMatch[0],
      });
    }
  }

  // Fallback: create a single line item from the subject
  if (items.length === 0) {
    let name = subject
      .replace(
        /^(re:|fwd?:|order confirmation|your order|shipping confirmation|order receipt|thank you for your purchase)[:\s-]*/i,
        ""
      )
      .trim();

    // If subject is too generic, try to find a clothing keyword in the body
    if (name.length < 5 || /^(order|receipt|confirmation|invoice)/i.test(name)) {
      const bodyLower = body.replace(/<[^>]+>/g, " ").toLowerCase();
      for (const kw of CLOTHING_KEYWORDS) {
        const idx = bodyLower.indexOf(kw);
        if (idx >= 0) {
          const start = Math.max(0, idx - 20);
          const end = Math.min(bodyLower.length, idx + kw.length + 40);
          const snippet = body
            .replace(/<[^>]+>/g, " ")
            .slice(start, end)
            .replace(/\s+/g, " ")
            .trim();
          if (snippet.length > 3) {
            name = snippet.slice(0, 60);
            break;
          }
        }
      }
    }

    items.push({
      name: name.slice(0, 80) || "Unknown Item",
    });
  }

  return items;
}

/* ---------- Product URL extraction ---------- */

/** Tracking / unsubscribe link patterns to exclude */
const NON_PRODUCT_URL_PATTERNS = [
  /unsubscribe/i,
  /optout/i,
  /opt-out/i,
  /manage.preferences/i,
  /email.preferences/i,
  /click\.(.*?)\.(com|net|org)/i,
  /track/i,
  /pixel/i,
  /beacon/i,
  /open\./i,
  /view.in.browser/i,
  /view.email/i,
  /mailto:/i,
  /tel:/i,
  /sms:/i,
  /privacy/i,
  /terms/i,
  /policy/i,
  /help/i,
  /support/i,
  /contact/i,
  /feedback/i,
  /survey/i,
  /social/i,
  /facebook\.com/i,
  /twitter\.com/i,
  /instagram\.com/i,
  /youtube\.com/i,
  /tiktok\.com/i,
  /pinterest\.com/i,
  /linkedin\.com/i,
];

function isProductLink(url: string): boolean {
  if (!url.startsWith("http")) return false;
  return !NON_PRODUCT_URL_PATTERNS.some((pat) => pat.test(url));
}

export function extractProductUrls(body: string): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();

  // Find all <a href="..."> tags
  const linkRegex = /<a[^>]+href=["']?(https?:\/\/[^"'\s>]+)["']?/gi;
  let match: RegExpExecArray | null;
  while ((match = linkRegex.exec(body)) !== null) {
    const url = match[1];
    if (seen.has(url)) continue;
    seen.add(url);

    if (isProductLink(url)) {
      urls.push(url);
    }
  }

  return urls;
}

/* ---------- Thumbnail extraction ---------- */

function extractThumbnail(body: string): string | undefined {
  // Look for image URLs in the email body (HTML img tags)
  const imgMatch = body.match(
    /<img[^>]+src=["']?(https?:\/\/[^"'\s>]+)["']?/i
  );
  if (imgMatch) {
    const url = imgMatch[1];
    // Filter out tracking pixels (typically 1x1 or very small)
    if (
      !url.includes("track") &&
      !url.includes("pixel") &&
      !url.includes("beacon") &&
      !url.includes("open.") &&
      !url.includes("1x1")
    ) {
      return url;
    }
  }
  // Look for any https image URL
  const urlMatch = body.match(
    /https?:\/\/[^\s"'<>]+\.(?:jpg|jpeg|png|webp)/i
  );
  if (urlMatch) {
    const url = urlMatch[0];
    if (
      !url.includes("track") &&
      !url.includes("pixel") &&
      !url.includes("beacon")
    ) {
      return url;
    }
  }
  return undefined;
}

/* ---------- Snippet generation ---------- */

function generateSnippet(subject: string, vendor: string, lineItems: GmailLineItem[], gmailSnippet: string): string {
  const parts: string[] = [];

  if (lineItems.length > 1) {
    parts.push(`${lineItems.length} items from ${vendor}`);
    // List first 2-3 item names
    const itemNames = lineItems.slice(0, 3).map((li) => li.name).join(", ");
    parts.push(itemNames);
    if (lineItems.length > 3) {
      parts.push(`and ${lineItems.length - 3} more`);
    }
  } else if (lineItems.length === 1 && lineItems[0].name !== "Unknown Item") {
    parts.push(`${lineItems[0].name} from ${vendor}`);
  } else {
    // Fall back to Gmail's snippet
    parts.push(gmailSnippet.slice(0, 150));
  }

  return parts.join(". ").slice(0, 200);
}

/* ---------- Main scanning function ---------- */

export async function scanGmailForPurchases(
  token: string,
  onProgress?: (loaded: number, total: number) => void
): Promise<GmailPurchaseItem[]> {
  const purchases: GmailPurchaseItem[] = [];

  // Search for order confirmation emails from the last 2 years
  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
  const afterDate = twoYearsAgo.toISOString().split("T")[0].replace(/-/g, "/");

  // Use Gmail search operators to narrow down
  const query = encodeURIComponent(
    `after:${afterDate} (order OR receipt OR confirmation OR shipped OR invoice OR purchased) (clothing OR shirt OR pants OR shoes OR dress OR jacket OR jewelry OR accessories OR fashion OR sneakers OR boots OR sweater OR hoodie OR jeans)`
  );

  // Fetch message IDs
  const listResult = await gmailFetch<{
    messages?: GmailMessage[];
    resultSizeEstimate?: number;
  }>(`messages?q=${query}&maxResults=100`, token);

  if (!listResult?.messages || listResult.messages.length === 0) {
    return [];
  }

  const messageIds = listResult.messages;
  const total = messageIds.length;
  let loaded = 0;

  // Load previously imported IDs
  const importedIds = await getImportedEmailIds();

  // Fetch each message detail
  for (const msg of messageIds) {
    const detail = await gmailFetch<GmailMessageDetail>(
      `messages/${msg.id}?format=full`,
      token
    );

    loaded++;
    onProgress?.(loaded, total);

    if (!detail) continue;

    const subject = getHeader(detail.payload.headers, "Subject");
    const from = getHeader(detail.payload.headers, "From");
    const body = getBodyText(detail.payload);

    if (!isClothingPurchase(subject, body, from)) continue;

    const vendor = extractVendor(from, subject);
    const price = extractPrice(body) || extractPrice(subject);
    const thumbnailUrl = extractThumbnail(body);
    const date = new Date(parseInt(detail.internalDate)).toLocaleDateString();
    const lineItems = extractLineItems(subject, body, vendor);
    const productUrls = extractProductUrls(body);
    const snippet = generateSnippet(subject, vendor, lineItems, detail.snippet ?? "");

    purchases.push({
      id: detail.id,
      from,
      vendor,
      subject,
      date,
      snippet,
      price,
      thumbnailUrl,
      lineItems,
      productUrls,
      previouslyImported: importedIds.has(detail.id),
    });
  }

  // Sort newest to oldest by internalDate
  // Since we stored messages in fetch order, we need to re-sort by the date
  // We can use the date string, but it's better to keep internalDate for sorting
  // Since we already have the purchases, we sort by parsing the ID order from Gmail
  // Actually, Gmail messages are returned in order, but let's ensure descending by date
  // We'll re-fetch internalDate isn't stored on the purchase, so we use the message order
  // Gmail already returns newest first by default in search results, but let's be explicit
  // We need to store internalDate temporarily for sorting
  // Actually let's capture it during the loop

  // Since Gmail returns messages in reverse chronological order by default,
  // the purchases array is already roughly sorted newest first.
  // But filtered items may shift things, so let's use a stable sort based on
  // the original message order (which IS newest first from Gmail search).
  // The purchases array preserves this order, so no re-sort needed if Gmail ordering holds.
  // However, to be safe, let's store and sort by internalDate.

  // We'll do a second pass approach: store internalDate on a map
  // Actually, it's simpler to refactor. Let's store it inline and sort after.

  // Download thumbnails locally
  const imgDir = `${FileSystem.cacheDirectory}gmail-thumbs/`;
  const dirInfo = await FileSystem.getInfoAsync(imgDir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(imgDir, { intermediates: true });
  }

  for (const purchase of purchases) {
    if (purchase.thumbnailUrl) {
      try {
        const ext = purchase.thumbnailUrl.match(/\.(jpg|jpeg|png|webp)/i)?.[1] ?? "jpg";
        const localPath = `${imgDir}${purchase.id}.${ext}`;
        const result = await FileSystem.downloadAsync(
          purchase.thumbnailUrl,
          localPath
        );
        if (result.status === 200) {
          purchase.localImageUri = result.uri;
        }
      } catch {
        // Thumbnail download failed — not critical
      }
    }

    // Download line item images
    for (const item of purchase.lineItems) {
      if (item.imageUrl) {
        try {
          const ext = item.imageUrl.match(/\.(jpg|jpeg|png|webp)/i)?.[1] ?? "jpg";
          const localPath = `${imgDir}${purchase.id}_${Math.random().toString(36).slice(2, 7)}.${ext}`;
          const result = await FileSystem.downloadAsync(
            item.imageUrl,
            localPath
          );
          if (result.status === 200) {
            item.localImageUri = result.uri;
          }
        } catch {
          // Line item image download failed — not critical
        }
      }
    }
  }

  return purchases;
}
