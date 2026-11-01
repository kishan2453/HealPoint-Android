import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  type Language,
  type LanguageOption,
  SUPPORTED_LANGUAGES,
  getLanguage,
  setLanguage as setGlobalLanguage,
  t as translateKey,
} from "@/lib/i18n";
import { getStorageItem, getStorageItemSync, setStorageItem } from "@/lib/storage";
import { api } from "@/services/api";

const STORAGE_LANG_KEY = "healpoint.language";
const STORAGE_CONTRAST_KEY = "healpoint.a11y.highContrast";
const STORAGE_FONTSCALE_KEY = "healpoint.a11y.fontScale";

export type FontScale = "normal" | "large" | "extra-large";

interface LanguageContextValue {
  language: Language;
  setLanguage: (lang: Language) => Promise<void>;
  highContrast: boolean;
  setHighContrast: (contrast: boolean) => Promise<void>;
  fontScale: FontScale;
  setFontScale: (scale: FontScale) => Promise<void>;
  t: (key: string, defaultText?: string) => string;
  supportedLanguages: LanguageOption[];
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  // Synchronous init for web/SSR to avoid flashing
  const initialLang: Language = (() => {
    const sync = getStorageItemSync(STORAGE_LANG_KEY);
    if (sync === "en" || sync === "hi" || sync === "gu") {
      setGlobalLanguage(sync);
      return sync;
    }
    return "en";
  })();

  const [language, setLanguageState] = useState<Language>(initialLang);
  const [highContrast, setHighContrastState] = useState<boolean>(() => {
    const sync = getStorageItemSync(STORAGE_CONTRAST_KEY);
    return sync === "true";
  });
  const [fontScale, setFontScaleState] = useState<FontScale>(() => {
    const sync = getStorageItemSync(STORAGE_FONTSCALE_KEY);
    if (sync === "large" || sync === "extra-large") return sync;
    return "normal";
  });

  // Load preferences from async storage on startup
  useEffect(() => {
    async function loadStoredPreferences() {
      try {
        const [storedLang, storedContrast, storedFontScale] = await Promise.all([
          getStorageItem(STORAGE_LANG_KEY),
          getStorageItem(STORAGE_CONTRAST_KEY),
          getStorageItem(STORAGE_FONTSCALE_KEY),
        ]);

        if (
          storedLang &&
          (storedLang === "en" || storedLang === "hi" || storedLang === "gu")
        ) {
          setLanguageState(storedLang);
          setGlobalLanguage(storedLang);
        }
        if (storedContrast !== null) {
          setHighContrastState(storedContrast === "true");
        }
        if (
          storedFontScale === "normal" ||
          storedFontScale === "large" ||
          storedFontScale === "extra-large"
        ) {
          setFontScaleState(storedFontScale);
        }
      } catch {
        // Fallback gracefully
      }
    }
    loadStoredPreferences();
  }, []);

  const changeLanguage = useCallback(async (newLang: Language) => {
    setLanguageState(newLang);
    setGlobalLanguage(newLang);
    try {
      await setStorageItem(STORAGE_LANG_KEY, newLang);
      // Asynchronously update profile preferences if authenticated
      api
        .patch(
          "/user/preferences",
          { languagePreference: newLang },
          { auth: true },
        )
        .catch(() => {
          // Non-blocking best-effort sync
        });
    } catch {
      // Storage error fallback
    }
  }, []);

  const changeHighContrast = useCallback(async (contrast: boolean) => {
    setHighContrastState(contrast);
    try {
      await setStorageItem(STORAGE_CONTRAST_KEY, String(contrast));
      api
        .patch(
          "/user/preferences",
          { accessibilityPreferences: { highContrast: contrast, fontScale } },
          { auth: true },
        )
        .catch(() => undefined);
    } catch {
      // Non-blocking
    }
  }, [fontScale]);

  const changeFontScale = useCallback(async (scale: FontScale) => {
    setFontScaleState(scale);
    try {
      await setStorageItem(STORAGE_FONTSCALE_KEY, scale);
      api
        .patch(
          "/user/preferences",
          { accessibilityPreferences: { highContrast, fontScale: scale } },
          { auth: true },
        )
        .catch(() => undefined);
    } catch {
      // Non-blocking
    }
  }, [highContrast]);

  const t = useCallback(
    (key: string, defaultText?: string) => {
      return translateKey(key, defaultText, language);
    },
    [language],
  );

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage: changeLanguage,
        highContrast,
        setHighContrast: changeHighContrast,
        fontScale,
        setFontScale: changeFontScale,
        t,
        supportedLanguages: SUPPORTED_LANGUAGES,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) {
    // Graceful fallback outside Provider
    return {
      language: getLanguage(),
      setLanguage: async (l: Language) => setGlobalLanguage(l),
      highContrast: false,
      setHighContrast: async () => {},
      fontScale: "normal" as FontScale,
      setFontScale: async () => {},
      t: (key: string, defaultText?: string) => translateKey(key, defaultText),
      supportedLanguages: SUPPORTED_LANGUAGES,
    };
  }
  return ctx;
}
