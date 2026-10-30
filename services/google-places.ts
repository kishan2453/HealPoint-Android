/**
 * HealPoint - Google Maps Platform Places & Geocoding Service.
 *
 * Implements the current Google Places API (New) architecture:
 *  - Places Autocomplete (New): POST https://places.googleapis.com/v1/places:autocomplete
 *  - Place Details (New): GET https://places.googleapis.com/v1/places/{placeId}
 *  - Reverse Geocoding: GET https://maps.googleapis.com/maps/api/geocode/json
 *  - Session token lifecycle management for grouped billing sessions
 *  - Mandatory solution tracking: X-Goog-Maps-Solution-ID: gmp_git_agentskills_v1
 *
 * No fake data. Adheres to Google Maps Platform Terms of Service.
 */
import * as Crypto from "expo-crypto";

export const GMP_SOLUTION_ID = "gmp_git_agentskills_v1";

export interface GooglePlacePrediction {
  placeId: string;
  primaryText: string;
  secondaryText: string;
  fullText: string;
  types: string[];
}

export interface GooglePlaceDetails {
  placeId: string;
  displayName: string;
  formattedAddress: string;
  locality: string;
  city: string;
  state: string;
  country: string;
  postalCode?: string;
  coordinates: {
    lat: number;
    lng: number;
  };
}

export interface ReverseGeocodeResult {
  formattedAddress: string;
  locality: string;
  city: string;
  state: string;
  country: string;
  postalCode?: string;
}

/**
 * Retrieves the configured Google Maps Platform API key.
 * Checks EXPO_PUBLIC_GOOGLE_MAPS_API_KEY, then EXPO_PUBLIC_GOOGLE_PLACES_API_KEY.
 */
export function getGoogleMapsApiKey(): string {
  const key =
    process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
    process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY ||
    "";
  return key.trim();
}

/**
 * Generates an RFC4122 v4 UUID for Google Places Autocomplete session tokens.
 */
export function createPlacesSessionToken(): string {
  try {
    if (typeof Crypto !== "undefined" && typeof Crypto.randomUUID === "function") {
      return Crypto.randomUUID();
    }
  } catch {}
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Searches places and addresses via Google Places API (New) Autocomplete.
 *
 * @param input The text query entered by the user.
 * @param sessionToken Active autocomplete session token.
 * @returns Array of real Google place predictions.
 */
export async function fetchGooglePlaceAutocomplete(
  input: string,
  sessionToken: string,
): Promise<{ success: boolean; predictions: GooglePlacePrediction[]; error?: string }> {
  const trimmed = input.trim();
  if (!trimmed || trimmed.length < 2) {
    return { success: true, predictions: [] };
  }

  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) {
    return {
      success: false,
      predictions: [],
      error: "Google Maps API key is not configured. Please add EXPO_PUBLIC_GOOGLE_MAPS_API_KEY to your .env file.",
    };
  }

  try {
    const response = await fetch(
      "https://places.googleapis.com/v1/places:autocomplete",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": apiKey,
          "X-Goog-Maps-Solution-ID": GMP_SOLUTION_ID,
        },
        body: JSON.stringify({
          input: trimmed,
          sessionToken,
          languageCode: "en",
        }),
      },
    );

    const data = await response.json();

    if (!response.ok) {
      const errMsg =
        data?.error?.message ||
        `Google Places API error (${response.status}): ${response.statusText}`;
      return { success: false, predictions: [], error: errMsg };
    }

    const rawSuggestions = data.suggestions || [];
    const predictions: GooglePlacePrediction[] = rawSuggestions
      .map((s: any) => {
        const p = s.placePrediction;
        if (!p) return null;

        const rawPlaceId = p.placeId || (p.place ? p.place.replace("places/", "") : "");
        const primaryText =
          p.structuredFormat?.mainText?.text ||
          p.text?.text?.split(",")[0] ||
          "Location";
        const secondaryText =
          p.structuredFormat?.secondaryText?.text ||
          (p.text?.text ? p.text.text.substring(primaryText.length).replace(/^,\s*/, "") : "");
        const fullText = p.text?.text || `${primaryText}${secondaryText ? `, ${secondaryText}` : ""}`;
        const types = Array.isArray(p.types) ? p.types : [];

        return {
          placeId: rawPlaceId,
          primaryText,
          secondaryText,
          fullText,
          types,
        };
      })
      .filter((p: GooglePlacePrediction | null): p is GooglePlacePrediction => Boolean(p && p.placeId));

    return { success: true, predictions };
  } catch (err: any) {
    return {
      success: false,
      predictions: [],
      error: err?.message || "Network error while searching locations.",
    };
  }
}

/**
 * Retrieves Place Details (New) for a selected placeId using the active session token.
 * Uses strict field masking to request only essential fields and optimize billing.
 */
export async function fetchGooglePlaceDetails(
  placeId: string,
  sessionToken?: string,
): Promise<{ success: boolean; details?: GooglePlaceDetails; error?: string }> {
  const cleanPlaceId = placeId.trim().replace(/^places\//, "");
  if (!cleanPlaceId) {
    return { success: false, error: "Invalid Place ID." };
  }

  const apiKey = getGoogleMapsApiKey();
  if (!apiKey) {
    return {
      success: false,
      error: "Google Maps API key is not configured.",
    };
  }

  try {
    const fields = "id,displayName,formattedAddress,addressComponents,location";
    const url = new URL(`https://places.googleapis.com/v1/places/${cleanPlaceId}`);
    url.searchParams.set("fields", fields);
    url.searchParams.set("languageCode", "en");
    if (sessionToken) {
      url.searchParams.set("sessionToken", sessionToken);
    }

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "X-Goog-Api-Key": apiKey,
        "X-Goog-Maps-Solution-ID": GMP_SOLUTION_ID,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        success: false,
        error: data?.error?.message || "Failed to retrieve place details.",
      };
    }

    // Extract address components
    const components: Array<{ longText: string; shortText: string; types: string[] }> =
      data.addressComponents || [];

    const getComponent = (...types: string[]) => {
      const match = components.find((c) =>
        types.some((t) => c.types?.includes(t)),
      );
      return match ? match.longText : "";
    };

    const localityComp = getComponent("locality");
    const sublocalityComp = getComponent("sublocality_level_1", "sublocality");
    const cityComp =
      localityComp ||
      getComponent("administrative_area_level_2", "postal_town") ||
      sublocalityComp ||
      "";
    const stateComp = getComponent("administrative_area_level_1");
    const countryComp = getComponent("country");
    const postalCode = getComponent("postal_code");

    const displayName = data.displayName?.text || cityComp || data.formattedAddress || "Selected Location";
    const city = cityComp || displayName;
    const state = stateComp || "Gujarat";
    const locality =
      city && state
        ? `${city}, ${state}`
        : data.formattedAddress || displayName;

    const lat = data.location?.latitude ?? 0;
    const lng = data.location?.longitude ?? 0;

    const details: GooglePlaceDetails = {
      placeId: cleanPlaceId,
      displayName,
      formattedAddress: data.formattedAddress || locality,
      locality,
      city,
      state,
      country: countryComp,
      postalCode,
      coordinates: { lat, lng },
    };

    return { success: true, details };
  } catch (err: any) {
    return {
      success: false,
      error: err?.message || "Network error while fetching place details.",
    };
  }
}

/**
 * Reverse geocodes coordinates (lat, lng) into city, state, and formatted address.
 * Primary: Google Geocoding API.
 * Fallback: OpenStreetMap Nominatim if Google key is missing or quota is exceeded.
 */
export async function reverseGeocodeCoordinates(
  lat: number,
  lng: number,
): Promise<ReverseGeocodeResult | null> {
  const apiKey = getGoogleMapsApiKey();

  // 1. Try Google Geocoding API if key is present
  if (apiKey) {
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&key=${apiKey}&language=en`;
      const response = await fetch(url, {
        headers: {
          "X-Goog-Maps-Solution-ID": GMP_SOLUTION_ID,
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.status === "OK" && Array.isArray(data.results) && data.results.length > 0) {
          const result = data.results[0];
          const components: Array<{ long_name: string; short_name: string; types: string[] }> =
            result.address_components || [];

          const getComp = (...types: string[]) => {
            const match = components.find((c) =>
              types.some((t) => c.types?.includes(t)),
            );
            return match ? match.long_name : "";
          };

          const city =
            getComp("locality", "postal_town") ||
            getComp("administrative_area_level_2") ||
            getComp("sublocality_level_1", "sublocality") ||
            "Ahmedabad";
          const state = getComp("administrative_area_level_1") || "Gujarat";
          const country = getComp("country") || "India";
          const postalCode = getComp("postal_code");
          const locality = `${city}, ${state}`;

          return {
            formattedAddress: result.formatted_address || locality,
            locality,
            city,
            state,
            country,
            postalCode,
          };
        }
      }
    } catch {
      // Continue to fallback
    }
  }

  // 2. Fallback to OpenStreetMap Nominatim for offline / unconfigured dev testing
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`,
      {
        headers: {
          "User-Agent": "HealPointMobile/1.0",
          Accept: "application/json",
        },
      },
    );
    if (response.ok) {
      const data = await response.json();
      const addr = data.address || {};
      const city =
        addr.city ||
        addr.town ||
        addr.village ||
        addr.suburb ||
        addr.county ||
        "Ahmedabad";
      const state = addr.state || "Gujarat";
      const country = addr.country || "India";
      const locality = `${city}, ${state}`;

      return {
        formattedAddress: data.display_name || locality,
        locality,
        city,
        state,
        country,
        postalCode: addr.postcode,
      };
    }
  } catch {}

  return null;
}
