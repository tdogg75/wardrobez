/**
 * AI Clothing Recognition Service (#81)
 *
 * Uses the Claude API vision endpoint to auto-detect clothing category,
 * color, pattern, and fabric from a photo, pre-filling the add-item form.
 *
 * API key is loaded from expo-constants (set in app.json extra.claudeApiKey)
 * or from expo-secure-store if stored there by the user.
 */

import Constants from "expo-constants";
import * as SecureStore from "expo-secure-store";
import * as FileSystem from "expo-file-system";
import type { ClothingCategory, FabricType, Pattern } from "@/models/types";

const CLAUDE_API_URL = "https://api.anthropic.com/v1/messages";
const CLAUDE_MODEL = "claude-opus-4-6";
const SECURE_KEY_API_KEY = "wardrobez:claude_api_key";

export interface ClothingRecognitionResult {
  category?: ClothingCategory;
  color?: string;
  colorName?: string;
  pattern?: Pattern;
  fabricType?: FabricType;
  name?: string;
  confidence: "high" | "medium" | "low";
  error?: string;
}

/**
 * Get the Claude API key from secure store or app config.
 */
async function getApiKey(): Promise<string | null> {
  try {
    const stored = await SecureStore.getItemAsync(SECURE_KEY_API_KEY);
    if (stored) return stored;
  } catch {
    // Secure store not available
  }
  return (Constants.expoConfig?.extra?.claudeApiKey as string | undefined) ?? null;
}

/**
 * Store the Claude API key securely for future use.
 */
export async function saveApiKey(key: string): Promise<void> {
  await SecureStore.setItemAsync(SECURE_KEY_API_KEY, key.trim());
}

/**
 * Check if an API key is configured.
 */
export async function hasApiKey(): Promise<boolean> {
  const key = await getApiKey();
  return !!key;
}

/**
 * Analyse a clothing photo using Claude's vision API.
 *
 * @param imageUri  Local file URI or remote URL of the image
 * @returns Structured recognition result with clothing metadata
 */
export async function recognizeClothing(
  imageUri: string
): Promise<ClothingRecognitionResult> {
  const apiKey = await getApiKey();
  if (!apiKey) {
    return {
      confidence: "low",
      error: "No Claude API key configured. Set it in Settings → AI Recognition.",
    };
  }

  try {
    // Convert local URI to base64
    let imageBase64: string;
    let mediaType: string = "image/jpeg";

    if (imageUri.startsWith("file://") || imageUri.startsWith("/")) {
      const base64 = await FileSystem.readAsStringAsync(imageUri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      imageBase64 = base64;
      if (imageUri.toLowerCase().endsWith(".png")) mediaType = "image/png";
      else if (imageUri.toLowerCase().endsWith(".webp")) mediaType = "image/webp";
    } else {
      // Remote URL — fetch and convert
      const response = await fetch(imageUri);
      const blob = await response.blob();
      mediaType = blob.type || "image/jpeg";
      const reader = new FileReader();
      imageBase64 = await new Promise((resolve, reject) => {
        reader.onloadend = () => {
          const result = reader.result as string;
          resolve(result.split(",")[1]);
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }

    const prompt = `Analyse this clothing item photo and return a JSON object with these fields:
{
  "name": "a descriptive name for the item (e.g. 'Navy Blue Oxford Shirt')",
  "category": one of: "tops", "bottoms", "dresses", "shoes", "jackets", "blazers", "jumpsuits", "skirts", "shorts", "swimwear", "accessories", "purse", "jewelry",
  "colorName": "human-readable color name (e.g. 'Navy Blue')",
  "color": "hex color code of the dominant color (e.g. '#1E3A5F')",
  "pattern": one of: "solid", "striped", "checked", "floral", "geometric", "abstract", "animal_print", "paisley", "houndstooth", "color_block" (or null if unknown),
  "fabricType": one of: "cotton", "linen", "silk", "wool", "synthetic", "denim", "leather", "velvet", "knit", "other" (or null if unknown),
  "confidence": "high", "medium", or "low"
}

Return ONLY valid JSON, no markdown or explanation.`;

    const body = {
      model: CLAUDE_MODEL,
      max_tokens: 512,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType,
                data: imageBase64,
              },
            },
            {
              type: "text",
              text: prompt,
            },
          ],
        },
      ],
    };

    const res = await fetch(CLAUDE_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.warn("[aiRecognition] Claude API error:", res.status, errText);
      return { confidence: "low", error: `API error: ${res.status}` };
    }

    const data = await res.json();
    const content = data?.content?.[0]?.text ?? "";

    // Parse JSON from response
    let parsed: Record<string, unknown>;
    try {
      // Handle potential markdown code blocks
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      parsed = JSON.parse(jsonMatch ? jsonMatch[0] : content);
    } catch {
      console.warn("[aiRecognition] Failed to parse Claude response:", content);
      return { confidence: "low", error: "Could not parse AI response" };
    }

    return {
      name: typeof parsed.name === "string" ? parsed.name : undefined,
      category: parsed.category as ClothingCategory | undefined,
      colorName: typeof parsed.colorName === "string" ? parsed.colorName : undefined,
      color: typeof parsed.color === "string" ? parsed.color : undefined,
      pattern: parsed.pattern as Pattern | undefined,
      fabricType: parsed.fabricType as FabricType | undefined,
      confidence: (parsed.confidence as "high" | "medium" | "low") ?? "medium",
    };
  } catch (err) {
    console.error("[aiRecognition] Error:", err);
    return { confidence: "low", error: String(err) };
  }
}
