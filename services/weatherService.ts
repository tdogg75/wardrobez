/**
 * Weather service using Open-Meteo (free, no API key) and IP-based geolocation.
 * No extra dependencies required — uses only fetch.
 */

export interface WeatherData {
  temp: number; // Celsius
  feelsLike: number;
  description: string;
  icon: string; // Ionicons name
  isRainy: boolean;
  isSnowy: boolean;
  isWindy: boolean;
  city: string;
}

const WEATHER_ICONS: Record<string, string> = {
  clear: "sunny-outline",
  clouds: "cloudy-outline",
  rain: "rainy-outline",
  drizzle: "rainy-outline",
  thunderstorm: "thunderstorm-outline",
  snow: "snow-outline",
  fog: "cloud-outline",
};

/**
 * Fetch current weather using Open-Meteo (free, no API key needed).
 * Uses IP-based geolocation to avoid needing expo-location.
 */
export async function getCurrentWeather(): Promise<WeatherData | null> {
  try {
    // Get approximate location via IP
    const geoRes = await fetch("https://ipapi.co/json/", {
      headers: { Accept: "application/json" },
    });
    if (!geoRes.ok) return null;
    const geo = await geoRes.json();
    const { latitude, longitude, city } = geo;
    if (!latitude || !longitude) return null;

    // Fetch weather from Open-Meteo
    const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,apparent_temperature,weather_code,wind_speed_10m&timezone=auto`;
    const res = await fetch(weatherUrl);
    if (!res.ok) return null;
    const data = await res.json();

    const current = data.current;
    if (!current) return null;

    const temp = current.temperature_2m;
    const feelsLike = current.apparent_temperature;
    const weatherCode = current.weather_code;
    const windSpeed = current.wind_speed_10m;

    const { description, main } = mapWeatherCode(weatherCode);
    const icon = WEATHER_ICONS[main] ?? "partly-sunny-outline";

    return {
      temp: Math.round(temp),
      feelsLike: Math.round(feelsLike),
      description,
      icon,
      isRainy: [51, 53, 55, 56, 57, 61, 63, 65, 66, 67, 80, 81, 82, 95, 96, 99].includes(weatherCode),
      isSnowy: [71, 73, 75, 77, 85, 86].includes(weatherCode),
      isWindy: windSpeed > 30,
      city: city ?? "",
    };
  } catch {
    return null;
  }
}

function mapWeatherCode(code: number): { description: string; main: string } {
  if (code === 0) return { description: "Clear sky", main: "clear" };
  if (code <= 3) return { description: "Partly cloudy", main: "clouds" };
  if (code <= 49) return { description: "Foggy", main: "fog" };
  if (code <= 57) return { description: "Drizzle", main: "drizzle" };
  if (code <= 67) return { description: "Rain", main: "rain" };
  if (code <= 77) return { description: "Snow", main: "snow" };
  if (code <= 82) return { description: "Rain showers", main: "rain" };
  if (code <= 86) return { description: "Snow showers", main: "snow" };
  if (code <= 99) return { description: "Thunderstorm", main: "thunderstorm" };
  return { description: "Unknown", main: "clouds" };
}

/** Map weather temperature to a season for outfit suggestions. */
export function weatherToSeason(weather: WeatherData): "spring" | "summer" | "fall" | "winter" {
  if (weather.temp >= 25) return "summer";
  if (weather.temp >= 15) return "spring";
  if (weather.temp >= 5) return "fall";
  return "winter";
}

/** Get weather-based tips for outfit suggestions. */
export function getWeatherTips(weather: WeatherData): string[] {
  const tips: string[] = [];
  if (weather.isRainy) tips.push("Bring a raincoat or waterproof jacket");
  if (weather.isSnowy) tips.push("Wear warm, waterproof boots");
  if (weather.isWindy) tips.push("Consider a windbreaker or heavier layer");
  if (weather.temp >= 30) tips.push("Light fabrics recommended — cotton, linen");
  if (weather.temp <= 0) tips.push("Layer up with wool or fleece");
  if (weather.feelsLike < weather.temp - 5) tips.push("Feels colder than actual — dress warmer");
  return tips;
}
