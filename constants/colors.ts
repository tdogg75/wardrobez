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

export function getColorDistance(hex1: string, hex2: string): number {
  const c1 = hexToHSL(hex1);
  const c2 = hexToHSL(hex2);

  const hueDiff = Math.min(Math.abs(c1.h - c2.h), 360 - Math.abs(c1.h - c2.h));
  const satDiff = Math.abs(c1.s - c2.s);
  const lightDiff = Math.abs(c1.l - c2.l);

  return Math.sqrt(hueDiff * hueDiff + satDiff * satDiff + lightDiff * lightDiff);
}
