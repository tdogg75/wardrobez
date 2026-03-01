// Color constants for the suggestion engine and UI theming

export interface ColorInfo {
  hex: string;
  name: string;
  hue: number; // 0-360
  saturation: number; // 0-100
  lightness: number; // 0-100
  isNeutral: boolean;
}

export const PRESET_COLORS: ColorInfo[] = [
  { hex: "#000000", name: "Black", hue: 0, saturation: 0, lightness: 0, isNeutral: true },
  { hex: "#FFFFFF", name: "White", hue: 0, saturation: 0, lightness: 100, isNeutral: true },
  { hex: "#808080", name: "Gray", hue: 0, saturation: 0, lightness: 50, isNeutral: true },
  { hex: "#F5F5DC", name: "Beige", hue: 60, saturation: 56, lightness: 91, isNeutral: true },
  { hex: "#D2B48C", name: "Tan", hue: 34, saturation: 44, lightness: 69, isNeutral: true },
  { hex: "#8B4513", name: "Brown", hue: 25, saturation: 76, lightness: 31, isNeutral: true },
  { hex: "#000080", name: "Navy", hue: 240, saturation: 100, lightness: 25, isNeutral: true },
  { hex: "#DC143C", name: "Red", hue: 348, saturation: 83, lightness: 47, isNeutral: false },
  { hex: "#FF6347", name: "Coral", hue: 9, saturation: 100, lightness: 64, isNeutral: false },
  { hex: "#FF69B4", name: "Pink", hue: 330, saturation: 100, lightness: 71, isNeutral: false },
  { hex: "#800080", name: "Purple", hue: 300, saturation: 100, lightness: 25, isNeutral: false },
  { hex: "#4169E1", name: "Blue", hue: 225, saturation: 73, lightness: 57, isNeutral: false },
  { hex: "#87CEEB", name: "Light Blue", hue: 197, saturation: 71, lightness: 73, isNeutral: false },
  { hex: "#008080", name: "Teal", hue: 180, saturation: 100, lightness: 25, isNeutral: false },
  { hex: "#228B22", name: "Green", hue: 120, saturation: 61, lightness: 34, isNeutral: false },
  { hex: "#90EE90", name: "Light Green", hue: 120, saturation: 73, lightness: 75, isNeutral: false },
  { hex: "#FFD700", name: "Gold", hue: 51, saturation: 100, lightness: 50, isNeutral: false },
  { hex: "#FFFF00", name: "Yellow", hue: 60, saturation: 100, lightness: 50, isNeutral: false },
  { hex: "#FFA500", name: "Orange", hue: 39, saturation: 100, lightness: 50, isNeutral: false },
  { hex: "#E6E6FA", name: "Lavender", hue: 240, saturation: 67, lightness: 94, isNeutral: false },
  { hex: "#800020", name: "Burgundy", hue: 345, saturation: 100, lightness: 25, isNeutral: false },
  { hex: "#556B2F", name: "Olive", hue: 82, saturation: 39, lightness: 30, isNeutral: false },
  // Typical jeans / denim washes
  { hex: "#1B3A5C", name: "Dark Wash", hue: 212, saturation: 53, lightness: 23, isNeutral: true },
  { hex: "#4A6FA5", name: "Medium Wash", hue: 215, saturation: 39, lightness: 47, isNeutral: false },
  { hex: "#8AADCE", name: "Light Wash", hue: 210, saturation: 40, lightness: 67, isNeutral: false },
  { hex: "#2C3E50", name: "Raw Indigo", hue: 210, saturation: 29, lightness: 24, isNeutral: true },
];

export function hexToHSL(hex: string): { h: number; s: number; l: number } {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) {
    return { h: 0, s: 0, l: Math.round(l * 100) };
  }

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;

  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

export function hslToHex(h: number, s: number, l: number): string {
  const sN = s / 100;
  const lN = l / 100;
  const c = (1 - Math.abs(2 * lN - 1)) * sN;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = lN - c / 2;

  let r = 0, g = 0, b = 0;
  if (h < 60) { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }

  const toHex = (n: number) => Math.round((n + m) * 255).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

export function getColorDistance(hex1: string, hex2: string): number {
  const c1 = hexToHSL(hex1);
  const c2 = hexToHSL(hex2);

  const hueDiff = Math.min(Math.abs(c1.h - c2.h), 360 - Math.abs(c1.h - c2.h));
  const satDiff = Math.abs(c1.s - c2.s);
  const lightDiff = Math.abs(c1.l - c2.l);

  return Math.sqrt(hueDiff * hueDiff + satDiff * satDiff + lightDiff * lightDiff);
}

export function findClosestPresetIndex(hex: string): number {
  let bestIdx = 0;
  let bestDist = Infinity;
  for (let i = 0; i < PRESET_COLORS.length; i++) {
    const d = getColorDistance(hex, PRESET_COLORS[i].hex);
    if (d < bestDist) {
      bestDist = d;
      bestIdx = i;
    }
  }
  return bestIdx;
}

// ---------------------------------------------------------------------------
// Comprehensive fashion-relevant named colors for accurate color-name mapping.
// NAMED_COLORS is used exclusively by getColorName() – the PRESET_COLORS array
// above is left untouched because it drives the color-picker UI.
// ---------------------------------------------------------------------------

interface NamedColor {
  hex: string;
  name: string;
  h: number; // hue 0-360
  s: number; // saturation 0-100
  l: number; // lightness 0-100
}

export const NAMED_COLORS: NamedColor[] = [
  // ── Neutrals ──────────────────────────────────────────────────────────────
  { hex: "#000000", name: "Black",       h: 0,   s: 0,   l: 0   },
  { hex: "#FFFFFF", name: "White",       h: 0,   s: 0,   l: 100 },
  { hex: "#FFFFF0", name: "Ivory",       h: 60,  s: 100, l: 97  },
  { hex: "#FFFDD0", name: "Cream",       h: 54,  s: 100, l: 91  },
  { hex: "#F0EAD6", name: "Eggshell",    h: 42,  s: 46,  l: 89  },
  { hex: "#FFFAFA", name: "Snow",        h: 0,   s: 100, l: 99  },
  { hex: "#FAF9F6", name: "Off-White",   h: 40,  s: 33,  l: 97  },
  { hex: "#36454F", name: "Charcoal",    h: 206, s: 19,  l: 26  },
  { hex: "#708090", name: "Slate",       h: 210, s: 13,  l: 50  },
  { hex: "#C0C0C0", name: "Silver",      h: 0,   s: 0,   l: 75  },
  { hex: "#B2BEB5", name: "Ash",         h: 144, s: 8,   l: 72  },
  { hex: "#8A9A5B", name: "Pewter",      h: 86,  s: 26,  l: 48  },
  { hex: "#2C3539", name: "Gunmetal",    h: 197, s: 14,  l: 20  },
  { hex: "#928E85", name: "Stone",       h: 39,  s: 6,   l: 55  },
  { hex: "#483C32", name: "Taupe",       h: 27,  s: 19,  l: 24  },
  { hex: "#C9B99A", name: "Mushroom",    h: 39,  s: 31,  l: 70  },
  { hex: "#C3B091", name: "Khaki",       h: 37,  s: 33,  l: 67  },
  { hex: "#C2B280", name: "Sand",        h: 46,  s: 30,  l: 63  },
  { hex: "#C19A6B", name: "Camel",       h: 33,  s: 38,  l: 59  },
  { hex: "#D2B48C", name: "Tan",         h: 34,  s: 44,  l: 69  },
  { hex: "#F5F5DC", name: "Beige",       h: 60,  s: 56,  l: 91  },
  { hex: "#E8DCCA", name: "Oatmeal",     h: 36,  s: 37,  l: 85  },
  { hex: "#3C1414", name: "Espresso",    h: 0,   s: 50,  l: 16  },
  { hex: "#7B3F00", name: "Chocolate",   h: 31,  s: 100, l: 24  },
  { hex: "#967969", name: "Mocha",       h: 20,  s: 18,  l: 50  },
  { hex: "#6F4E37", name: "Coffee",      h: 25,  s: 31,  l: 33  },
  { hex: "#9A463D", name: "Cognac",      h: 5,   s: 43,  l: 42  },
  { hex: "#954535", name: "Chestnut",    h: 10,  s: 47,  l: 40  },
  { hex: "#5B3A29", name: "Walnut",      h: 21,  s: 35,  l: 26  },
  { hex: "#A0522D", name: "Sienna",      h: 19,  s: 56,  l: 40  },
  { hex: "#635147", name: "Umber",       h: 21,  s: 16,  l: 33  },

  // ── Reds ──────────────────────────────────────────────────────────────────
  { hex: "#FF2400", name: "Scarlet",     h: 9,   s: 100, l: 50  },
  { hex: "#DC143C", name: "Crimson",     h: 348, s: 83,  l: 47  },
  { hex: "#E0115F", name: "Ruby",        h: 337, s: 87,  l: 47  },
  { hex: "#DE3163", name: "Cherry",      h: 342, s: 72,  l: 53  },
  { hex: "#733635", name: "Garnet",      h: 1,   s: 36,  l: 33  },
  { hex: "#800020", name: "Burgundy",    h: 345, s: 100, l: 25  },
  { hex: "#800000", name: "Maroon",      h: 0,   s: 100, l: 25  },
  { hex: "#722F37", name: "Wine",        h: 352, s: 39,  l: 32  },
  { hex: "#4A0000", name: "Oxblood",     h: 0,   s: 100, l: 15  },
  { hex: "#CB4154", name: "Brick Red",   h: 352, s: 53,  l: 53  },
  { hex: "#B7410E", name: "Rust",        h: 18,  s: 84,  l: 39  },
  { hex: "#E2725B", name: "Terracotta",  h: 11,  s: 67,  l: 62  },
  { hex: "#FF6347", name: "Tomato",      h: 9,   s: 100, l: 64  },
  { hex: "#E34234", name: "Vermillion",  h: 5,   s: 76,  l: 55  },
  { hex: "#C41E3A", name: "Cardinal",    h: 348, s: 74,  l: 44  },

  // ── Pinks ─────────────────────────────────────────────────────────────────
  { hex: "#DE5D83", name: "Blush",       h: 343, s: 65,  l: 62  },
  { hex: "#FF007F", name: "Rose",        h: 330, s: 100, l: 50  },
  { hex: "#C4767A", name: "Dusty Rose",  h: 357, s: 38,  l: 62  },
  { hex: "#FF7F50", name: "Coral",       h: 16,  s: 100, l: 66  },
  { hex: "#FA8072", name: "Salmon",      h: 6,   s: 93,  l: 71  },
  { hex: "#FF00FF", name: "Fuchsia",     h: 300, s: 100, l: 50  },
  { hex: "#FF69B4", name: "Hot Pink",    h: 330, s: 100, l: 71  },
  { hex: "#FF0090", name: "Magenta",     h: 326, s: 100, l: 50  },
  { hex: "#E0B0FF", name: "Mauve",       h: 280, s: 100, l: 84  },
  { hex: "#FFDAB9", name: "Peach",       h: 28,  s: 100, l: 86  },
  { hex: "#FC8EAC", name: "Flamingo",    h: 343, s: 96,  l: 77  },

  // ── Blues ──────────────────────────────────────────────────────────────────
  { hex: "#000080", name: "Navy",            h: 240, s: 100, l: 25  },
  { hex: "#191970", name: "Midnight Blue",   h: 240, s: 64,  l: 27  },
  { hex: "#4169E1", name: "Royal Blue",      h: 225, s: 73,  l: 57  },
  { hex: "#0047AB", name: "Cobalt",          h: 215, s: 100, l: 34  },
  { hex: "#0F52BA", name: "Sapphire",        h: 219, s: 85,  l: 39  },
  { hex: "#007BA7", name: "Cerulean",        h: 196, s: 100, l: 33  },
  { hex: "#87CEEB", name: "Sky Blue",        h: 197, s: 71,  l: 73  },
  { hex: "#B0E0E6", name: "Powder Blue",     h: 187, s: 52,  l: 80  },
  { hex: "#89CFF0", name: "Baby Blue",       h: 207, s: 79,  l: 75  },
  { hex: "#4682B4", name: "Steel Blue",      h: 207, s: 44,  l: 49  },
  { hex: "#5B7FA5", name: "Denim Blue",      h: 212, s: 30,  l: 50  },
  { hex: "#CCCCFF", name: "Periwinkle",      h: 240, s: 100, l: 90  },
  { hex: "#6495ED", name: "Cornflower",      h: 219, s: 79,  l: 66  },
  { hex: "#4B0082", name: "Indigo",          h: 275, s: 100, l: 25  },
  { hex: "#007FFF", name: "Azure",           h: 210, s: 100, l: 50  },
  { hex: "#6A5ACD", name: "Slate Blue",      h: 248, s: 53,  l: 58  },
  { hex: "#008080", name: "Teal",            h: 180, s: 100, l: 25  },
  { hex: "#1B3D4F", name: "Petrol",          h: 200, s: 49,  l: 21  },

  // ── Greens ────────────────────────────────────────────────────────────────
  { hex: "#228B22", name: "Forest",          h: 120, s: 61,  l: 34  },
  { hex: "#355E3B", name: "Hunter Green",    h: 140, s: 26,  l: 29  },
  { hex: "#50C878", name: "Emerald",         h: 140, s: 52,  l: 55  },
  { hex: "#00A86B", name: "Jade",            h: 160, s: 100, l: 33  },
  { hex: "#B2AC88", name: "Sage",            h: 69,  s: 18,  l: 62  },
  { hex: "#808000", name: "Olive",           h: 60,  s: 100, l: 25  },
  { hex: "#4B5320", name: "Army Green",      h: 72,  s: 46,  l: 23  },
  { hex: "#8A9A5B", name: "Moss",            h: 86,  s: 26,  l: 48  },
  { hex: "#93E9BE", name: "Seafoam",         h: 152, s: 66,  l: 75  },
  { hex: "#98FF98", name: "Mint",            h: 120, s: 100, l: 80  },
  { hex: "#32CD32", name: "Lime",            h: 120, s: 61,  l: 50  },
  { hex: "#7FFF00", name: "Chartreuse",      h: 90,  s: 100, l: 50  },
  { hex: "#93C572", name: "Pistachio",       h: 96,  s: 42,  l: 61  },
  { hex: "#01796F", name: "Pine",            h: 175, s: 99,  l: 24  },
  { hex: "#4F7942", name: "Fern",            h: 108, s: 30,  l: 37  },

  // ── Yellows & Oranges ─────────────────────────────────────────────────────
  { hex: "#FFD700", name: "Gold",            h: 51,  s: 100, l: 50  },
  { hex: "#FFDB58", name: "Mustard",         h: 48,  s: 100, l: 67  },
  { hex: "#F4C430", name: "Saffron",         h: 45,  s: 90,  l: 57  },
  { hex: "#FFBF00", name: "Amber",           h: 45,  s: 100, l: 50  },
  { hex: "#EB9605", name: "Honey",           h: 38,  s: 95,  l: 47  },
  { hex: "#FFF44F", name: "Lemon",           h: 57,  s: 100, l: 65  },
  { hex: "#FFFACD", name: "Butter",          h: 54,  s: 100, l: 90  },
  { hex: "#FFEF00", name: "Canary",          h: 56,  s: 100, l: 50  },
  { hex: "#EAA221", name: "Marigold",        h: 38,  s: 83,  l: 53  },
  { hex: "#FF9966", name: "Tangerine",       h: 20,  s: 100, l: 70  },
  { hex: "#FBCEB1", name: "Apricot",         h: 28,  s: 93,  l: 84  },
  { hex: "#FF7518", name: "Pumpkin",         h: 24,  s: 100, l: 55  },
  { hex: "#B06500", name: "Ginger",          h: 34,  s: 100, l: 35  },
  { hex: "#B87333", name: "Copper",          h: 28,  s: 56,  l: 46  },
  { hex: "#CD7F32", name: "Bronze",          h: 34,  s: 60,  l: 50  },
  { hex: "#D2691E", name: "Cinnamon",        h: 25,  s: 75,  l: 47  },

  // ── Purples ───────────────────────────────────────────────────────────────
  { hex: "#8E4585", name: "Plum",            h: 307, s: 33,  l: 40  },
  { hex: "#614051", name: "Eggplant",        h: 326, s: 21,  l: 32  },
  { hex: "#693B58", name: "Aubergine",       h: 318, s: 29,  l: 32  },
  { hex: "#6F2DA8", name: "Grape",           h: 274, s: 58,  l: 42  },
  { hex: "#7F00FF", name: "Violet",          h: 270, s: 100, l: 50  },
  { hex: "#9966CC", name: "Amethyst",        h: 270, s: 50,  l: 60  },
  { hex: "#DA70D6", name: "Orchid",          h: 302, s: 59,  l: 65  },
  { hex: "#C8A2C8", name: "Lilac",           h: 300, s: 28,  l: 77  },
  { hex: "#E6E6FA", name: "Lavender",        h: 240, s: 67,  l: 94  },
  { hex: "#C9A0DC", name: "Wisteria",        h: 280, s: 46,  l: 75  },
  { hex: "#C54B8C", name: "Mulberry",        h: 327, s: 50,  l: 54  },
  { hex: "#7851A9", name: "Royal Purple",    h: 264, s: 36,  l: 49  },

  // ── Denim washes (fashion-specific) ───────────────────────────────────────
  { hex: "#1B3A5C", name: "Dark Wash",       h: 212, s: 53,  l: 23  },
  { hex: "#4A6FA5", name: "Medium Wash",     h: 215, s: 39,  l: 47  },
  { hex: "#8AADCE", name: "Light Wash",      h: 210, s: 40,  l: 67  },
  { hex: "#2C3E50", name: "Raw Indigo",      h: 210, s: 29,  l: 24  },

  // ── Additional fashion grays ──────────────────────────────────────────────
  { hex: "#A9A9A9", name: "Dark Gray",       h: 0,   s: 0,   l: 66  },
  { hex: "#D3D3D3", name: "Light Gray",      h: 0,   s: 0,   l: 83  },
  { hex: "#808080", name: "Gray",            h: 0,   s: 0,   l: 50  },
  { hex: "#F5F0EB", name: "Champagne",       h: 30,  s: 36,  l: 94  },
];

/**
 * Return a simple, overall tone name for display (e.g. "Black", "White",
 * "Cream", "Grey", "Blue", "Green", "Red", "Pink", "Purple", "Orange",
 * "Yellow", "Brown", "Navy", "Beige", "Teal").
 *
 * The actual hex is always saved for colour-wheel matching; this function
 * is purely for the user-facing label.
 */
export function getColorName(hex: string): string {
  const { h, s, l } = hexToHSL(hex);

  // ── Achromatic / very low saturation ──────────────────────────────
  if (s < 8) {
    if (l <= 10) return "Black";
    if (l <= 35) return "Grey";
    if (l <= 65) return "Grey";
    if (l <= 88) return "Grey";
    return "White";
  }

  // ── Low saturation – neutral / muted tones ────────────────────────
  if (s < 20) {
    if (l <= 15) return "Black";
    if (l <= 40) return "Grey";
    if (l <= 70) return "Grey";
    if (l <= 90) return "Cream";
    return "White";
  }

  // ── Chromatic colours: classify by hue ────────────────────────────
  // Very light = pastel-ish, very dark = deep
  if (l <= 12) return "Black";
  if (l >= 92) return "White";

  // Cream / beige zone (warm, light, low-mid saturation)
  if (s < 50 && l > 75 && h >= 20 && h <= 65) return "Cream";
  if (s < 40 && l > 55 && l <= 75 && h >= 20 && h <= 50) return "Beige";

  // Brown zone
  if (h >= 10 && h <= 45 && l < 45 && s >= 20) return "Brown";

  // By hue ranges
  if (h <= 10 || h > 345) {
    // Red family
    if (l > 70) return "Pink";
    if (l < 30) return "Burgundy";
    return "Red";
  }
  if (h > 10 && h <= 25) {
    if (l > 70) return "Peach";
    if (l < 35) return "Brown";
    return "Orange";
  }
  if (h > 25 && h <= 45) {
    if (l > 70) return "Cream";
    if (l < 35) return "Brown";
    return "Orange";
  }
  if (h > 45 && h <= 65) {
    if (l > 80) return "Cream";
    return "Yellow";
  }
  if (h > 65 && h <= 160) {
    if (s < 30 && l > 50) return "Sage";
    if (h >= 80 && h <= 100 && s >= 30 && l < 35) return "Olive";
    return "Green";
  }
  if (h > 160 && h <= 195) {
    return "Teal";
  }
  if (h > 195 && h <= 250) {
    if (l < 30) return "Navy";
    return "Blue";
  }
  if (h > 250 && h <= 290) {
    if (l > 75) return "Lavender";
    return "Purple";
  }
  if (h > 290 && h <= 330) {
    if (l > 70) return "Pink";
    return "Pink";
  }
  if (h > 330 && h <= 345) {
    if (l > 70) return "Pink";
    if (l < 30) return "Burgundy";
    return "Red";
  }

  return "Grey";
}

/**
 * Return the closest detailed fashion color name for an arbitrary hex value.
 * Used internally for colour matching engine — not for display labels.
 */
export function getDetailedColorName(hex: string): string {
  const { h, s, l } = hexToHSL(hex);

  let bestName = NAMED_COLORS[0].name;
  let bestDist = Infinity;

  for (const nc of NAMED_COLORS) {
    const hueDiff = Math.min(Math.abs(h - nc.h), 360 - Math.abs(h - nc.h));
    const satDiff = Math.abs(s - nc.s);
    const lightDiff = Math.abs(l - nc.l);

    let dist: number;
    if (s < 10) {
      dist = Math.sqrt(
        0.1 * hueDiff * hueDiff +
        1.0 * satDiff * satDiff +
        6.0 * lightDiff * lightDiff
      );
    } else if (s < 25) {
      dist = Math.sqrt(
        0.6 * hueDiff * hueDiff +
        1.2 * satDiff * satDiff +
        4.0 * lightDiff * lightDiff
      );
    } else {
      dist = Math.sqrt(
        4.0 * hueDiff * hueDiff +
        1.5 * satDiff * satDiff +
        2.0 * lightDiff * lightDiff
      );
    }

    if (dist < bestDist) {
      bestDist = dist;
      bestName = nc.name;
    }
  }

  return bestName;
}
