const fs = require('fs');
let code = fs.readFileSync('components/emergency/EmergencyContactsModal.tsx', 'utf8');

const regex = /<Text style=\{styles\.sectionSubtitle\}>\r?\n\s*Contacts notified when you press Emergency SOS:\r?\n\s*<\/Text>/;
const replacement = `<View style={{ backgroundColor: "#FEF3C7", padding: 8, borderRadius: 8, marginBottom: 12, flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Ionicons name="information-circle" size={16} color="#92400E" />
              <Text style={{ fontSize: 11, color: "#92400E", flex: 1, fontWeight: "600" }}>
                DEMO MODE: Contacts are simulated placeholders. No external SMS, WhatsApp, or calls are sent.
              </Text>
            </View>

            <Text style={styles.sectionSubtitle}>
              Contacts simulated when you trigger Demo SOS:
            </Text>`;

if (regex.test(code)) {
  code = code.replace(regex, replacement);
  fs.writeFileSync('components/emergency/EmergencyContactsModal.tsx', code, 'utf8');
  console.log('EmergencyContactsModal.tsx updated with regex');
} else {
  console.log('Regex match failed on EmergencyContactsModal.tsx');
}
