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

export interface GmailPurchaseItem {
  id: string;
  vendor: string;
  itemName: string;
  price: string;
  date: string;
  thumbnailUrl?: string;
  snippet: string;
  /** Local file URI after downloading thumbnail */
  localImageUri?: string;
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

/* ---------- Auth helpers ---------- */

let cachedToken: string | null = null;

export function getRedirectUri(): string {
  return AuthSession.makeRedirectUri({ scheme: "wardrobez" });
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
    for (const part of payload.parts) {
      if (part.mimeType === "text/plain" && part.body?.data) {
        return decodeBase64Url(part.body.data);
      }
    }
    for (const part of payload.parts) {
      if (part.mimeType === "text/html" && part.body?.data) {
        return decodeBase64Url(part.body.data);
      }
    }
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

function isClothingPurchase(subject: string, body: string, from: string): boolean {
  const text = `${subject} ${body} ${from}`.toLowerCase();

  // Must look like an order/purchase email
  const hasOrderKeyword = ORDER_KEYWORDS.some((kw) => text.includes(kw));
  if (!hasOrderKeyword) return false;

  // Must relate to fashion/clothing
  const hasFashionVendor = FASHION_VENDORS.some((v) => text.includes(v));
  const hasClothingKeyword = CLOTHING_KEYWORDS.some((kw) => text.includes(kw));

  return hasFashionVendor || hasClothingKeyword;
}

function extractPrice(text: string): string {
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

function extractItemName(subject: string, body: string): string {
  // Try to pull an item name from the subject line
  // Strip common prefixes
  let name = subject
    .replace(
      /^(re:|fwd?:|order confirmation|your order|shipping confirmation|order receipt|thank you for your purchase)[:\s-]*/i,
      ""
    )
    .trim();

  // If subject is too generic, try to find a clothing keyword in the body
  if (name.length < 5 || /^(order|receipt|confirmation|invoice)/i.test(name)) {
    const bodyLower = body.toLowerCase();
    for (const kw of CLOTHING_KEYWORDS) {
      const idx = bodyLower.indexOf(kw);
      if (idx >= 0) {
        // Grab surrounding context (up to 60 chars)
        const start = Math.max(0, idx - 20);
        const end = Math.min(bodyLower.length, idx + kw.length + 40);
        const snippet = body
          .slice(start, end)
          .replace(/[<>]/g, "")
          .replace(/\s+/g, " ")
          .trim();
        if (snippet.length > 3) {
          name = snippet.slice(0, 60);
          break;
        }
      }
    }
  }

  return name.slice(0, 80) || "Unknown Item";
}

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
    const itemName = extractItemName(subject, body);
    const price = extractPrice(body) || extractPrice(subject);
    const thumbnailUrl = extractThumbnail(body);
    const date = new Date(parseInt(detail.internalDate)).toLocaleDateString();

    purchases.push({
      id: detail.id,
      vendor,
      itemName,
      price,
      date,
      thumbnailUrl,
      snippet: detail.snippet?.slice(0, 120) ?? "",
    });
  }

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
  }

  return purchases;
}
