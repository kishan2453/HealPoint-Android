const fs = require('fs');
let code = fs.readFileSync('app/(drawer)/emergency.tsx', 'utf8');

// 1. Replace callNumber with demo simulation alert
const callRegex = /const callNumber = \(phone: string, label: string\) => \{\r?\n\s*const cleaned = phone\.replace\(\/\[\^0-9\+\]\/g, ""\);\r?\n\s*if \(!cleaned\) \{[\s\S]*?Alert\.alert\(\r?\n\s*"Place Emergency Call"[\s\S]*?\}\r?\n\s*\);\r?\n\s*\};/;

const callReplacement = `const callNumber = (phone: string, label: string) => {
    Alert.alert(
      "SIMULATION ONLY – DEMO MODE",
      \`Calling is disabled in Demo Mode.\\n\\n"\${label}" (\${phone}) is a simulated educational placeholder.\\n\\nNo real-world hospital, ambulance, or emergency service is contacted.\`,
      [{ text: "Understood", style: "default" }]
    );
  };`;

if (callRegex.test(code)) {
  code = code.replace(callRegex, callReplacement);
  console.log('Replaced callNumber with demo alert');
} else {
  console.log('callNumber regex did not match');
}

// 2. Add Top Demo Mode Warning Banner inside ScrollView right before ActiveEmergencyBanner
const bannerTarget = `{/* 1. Live Active Emergency SOS Tracker (Task 8) */}`;
const demoBanner = `{/* Standalone Demo Mode Disclaimer Banner */}
        <View style={styles.demoWarningBanner}>
          <Ionicons name="information-circle" size={20} color="#92400E" />
          <Text style={styles.demoWarningText}>
            DEMO MODE: This is a simulated emergency request. No real hospital, ambulance or emergency service has been contacted.
          </Text>
        </View>

        {/* 1. Live Active Emergency SOS Tracker (Task 8) */}`;

if (code.includes(bannerTarget) && !code.includes('demoWarningBanner')) {
  code = code.replace(bannerTarget, demoBanner);
  console.log('Added demoWarningBanner before active banner');
}

// 3. Update SOS card text
code = code.replace('ONE-TAP SOS BROADCAST', 'ONE-TAP SOS SIMULATION (DEMO)');
code = code.replace(
  'Instantly transmits your medical identity & GPS coordinates to response desks',
  'Simulates an emergency request in the demo environment · No real services contacted'
);
code = code.replace('GPS Location Attached', 'Simulated GPS Attached');

// 4. Add styling for demoWarningBanner
if (!code.includes('demoWarningBanner:')) {
  code = code.replace(
    'scrollContent: {',
    `demoWarningBanner: {
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#F59E0B",
    borderRadius: Radius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  demoWarningText: {
    flex: 1,
    color: "#92400E",
    fontSize: 13,
    fontWeight: "700",
    lineHeight: 18,
  },
  scrollContent: {`
  );
  console.log('Added styles for demoWarningBanner');
}

fs.writeFileSync('app/(drawer)/emergency.tsx', code, 'utf8');
console.log('emergency.tsx updated successfully');
