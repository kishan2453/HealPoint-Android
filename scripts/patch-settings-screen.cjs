const fs = require("fs");
const path = require("path");

const settingsPath = path.join(__dirname, "../app/settings/index.tsx");
let content = fs.readFileSync(settingsPath, "utf8");

// 1. Add useLanguage import if missing
if (!content.includes('import { useLanguage } from "@/hooks/use-language";')) {
  content = content.replace(
    'import { useAuth } from "@/hooks/use-auth";',
    'import { useAuth } from "@/hooks/use-auth";\nimport { useLanguage, type FontScale } from "@/hooks/use-language";'
  );
}

// 2. Extract useLanguage hooks in SettingsScreen
if (!content.includes("const { language, setLanguage, highContrast, setHighContrast, fontScale, setFontScale, t, supportedLanguages } = useLanguage();")) {
  content = content.replace(
    "  const { user, signOut, changeAccountEmail } = useAuth();",
    `  const { user, signOut, changeAccountEmail } = useAuth();
  const {
    language,
    setLanguage,
    highContrast,
    setHighContrast,
    fontScale,
    setFontScale,
    t,
    supportedLanguages,
  } = useLanguage();`
  );
}

// 3. Add Language and Accessibility cards right above the notification preferences section
const targetSection = `{/* Notification Preferences with Real Persisted Toggles */}`;

const languageAndA11ySections = `{/* Language Selection Card */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("settings.language", "Language Preference")}</Text>
          <Card padded={false} style={styles.menuCard}>
            {supportedLanguages.map((lang, index) => {
              const isSelected = language === lang.code;
              return (
                <Pressable
                  key={lang.code}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: isSelected }}
                  accessibilityLabel={\`\${lang.name} (\${lang.nativeName})\`}
                  accessibilityHint="Double tap to set this as your application language"
                  onPress={() => setLanguage(lang.code)}
                  style={({ pressed }) => [
                    styles.menuRow,
                    index < supportedLanguages.length - 1 && styles.menuRowBorder,
                    isSelected && { backgroundColor: "rgba(14, 159, 142, 0.06)" },
                    pressed && styles.pressed,
                  ]}
                >
                  <View style={[styles.menuIcon, { backgroundColor: isSelected ? "rgba(14, 159, 142, 0.15)" : "#F1F5F9" }]}>
                    <Text style={{ fontSize: 18 }}>{lang.flag}</Text>
                  </View>
                  <View style={styles.menuTexts}>
                    <Text style={[styles.menuLabel, isSelected && { color: Palette.primary, fontWeight: "700" }]}>
                      {lang.nativeName} ({lang.name})
                    </Text>
                    <Text style={styles.menuDescription}>
                      {lang.code === "en" ? "Standard medical English" : lang.code === "hi" ? "हिन्दी स्थानीयकरण" : "ગુજરાતી સ્થાનિકીકરણ"}
                    </Text>
                  </View>
                  <View style={[styles.radioCircle, isSelected && styles.radioCircleActive]}>
                    {isSelected && <View style={styles.radioInner} />}
                  </View>
                </Pressable>
              );
            })}
          </Card>
        </View>

        {/* Accessibility & Display Preferences */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("settings.accessibility", "Accessibility & Display")}</Text>
          <Card padded={false} style={styles.menuCard}>
            {/* High Contrast Toggle */}
            <View style={[styles.menuRow, styles.menuRowBorder]}>
              <View style={[styles.menuIcon, { backgroundColor: "rgba(15, 23, 42, 0.08)" }]}>
                <Ionicons name="contrast-outline" size={20} color={Palette.text} />
              </View>
              <View style={styles.menuTexts}>
                <Text style={styles.menuLabel}>{t("settings.highContrast", "High Contrast Mode")}</Text>
                <Text style={styles.menuDescription}>
                  {t("settings.highContrastDesc", "Enhances readability and visual borders")}
                </Text>
              </View>
              <Switch
                value={highContrast}
                onValueChange={(val) => setHighContrast(val)}
                trackColor={{ false: Palette.border, true: Palette.primary }}
                thumbColor={Platform.OS === "android" ? Palette.white : undefined}
                accessibilityRole="switch"
                accessibilityLabel="High contrast mode"
              />
            </View>

            {/* Font Scale Options */}
            <View style={styles.menuRow}>
              <View style={[styles.menuIcon, { backgroundColor: "rgba(37, 99, 235, 0.10)" }]}>
                <Ionicons name="text-outline" size={20} color="#2563EB" />
              </View>
              <View style={styles.menuTexts}>
                <Text style={styles.menuLabel}>{t("settings.fontSize", "Text Size")}</Text>
                <View style={styles.fontScaleRow}>
                  {(["normal", "large", "extra-large"] as FontScale[]).map((scale) => {
                    const active = fontScale === scale;
                    const label =
                      scale === "normal"
                        ? t("settings.fontSizeNormal", "Normal")
                        : scale === "large"
                        ? t("settings.fontSizeLarge", "Large")
                        : t("settings.fontSizeXLarge", "Extra Large");
                    return (
                      <Pressable
                        key={scale}
                        accessibilityRole="button"
                        accessibilityLabel={\`Font size \${label}\`}
                        onPress={() => setFontScale(scale)}
                        style={({ pressed }) => [
                          styles.fontScalePill,
                          active && styles.fontScalePillActive,
                          pressed && styles.pressed,
                        ]}
                      >
                        <Text style={[styles.fontScalePillText, active && styles.fontScalePillTextActive]}>
                          {label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            </View>
          </Card>
        </View>

        ${targetSection}`;

if (!content.includes("Language Selection Card")) {
  content = content.replace(targetSection, languageAndA11ySections);
}

// 4. Add additional styles for radio and font scale pills
if (!content.includes("radioCircle:")) {
  const stylesTarget = "  menuRow: {";
  const extraStyles = `  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
  },
  radioCircleActive: {
    borderColor: Palette.primary,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: Palette.primary,
  },
  fontScaleRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 6,
  },
  fontScalePill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    backgroundColor: "#F8FAFC",
  },
  fontScalePillActive: {
    borderColor: Palette.primary,
    backgroundColor: "rgba(14, 159, 142, 0.12)",
  },
  fontScalePillText: {
    ...Typography.caption,
    color: Palette.textMuted,
    fontWeight: "600",
  },
  fontScalePillTextActive: {
    color: Palette.primary,
    fontWeight: "700",
  },
  menuRow: {`;
  content = content.replace(stylesTarget, extraStyles);
}

fs.writeFileSync(settingsPath, content, "utf8");
console.log("Updated app/settings/index.tsx with Language, Accessibility, and Font Scaling");
