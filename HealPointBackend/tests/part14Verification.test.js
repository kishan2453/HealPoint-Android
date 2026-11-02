import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

describe("Part 14: Anand HealPoint Branding, UI Fixes, Link Management & SEO Suite", () => {
  describe("Task 1 & 2: Branding & Visible DEMO Label Removal", () => {
    it("Verifies app.json has Anand HealPoint name and preserves package identifier", () => {
      const appJsonPath = path.resolve("../app.json");
      const appJson = JSON.parse(fs.readFileSync(appJsonPath, "utf8"));
      assert.equal(appJson.expo.name, "Anand HealPoint");
      assert.equal(appJson.expo.android.package, "com.healpoint.app");
    });

    it("Verifies DemoModeBanner uses professional educational disclaimer without repeated DEMO pill", () => {
      const bannerPath = path.resolve("../components/DemoModeBanner.tsx");
      const content = fs.readFileSync(bannerPath, "utf8");
      assert.ok(
        content.includes("Educational simulation only. This is not a real healthcare provider or emergency service."),
        "Must render the professional educational simulation disclaimer"
      );
      assert.ok(!content.includes("<Text style={styles.pillText}>DEMO MODE</Text>"), "Must not display DEMO MODE pill");
    });

    it("Verifies web portal announcement banners are updated with Anand HealPoint branding", () => {
      const docAppPath = path.resolve("../HealPointDoctorWeb/src/App.jsx");
      const hospAppPath = path.resolve("../HealPointHospitalAdminWeb/src/App.jsx");
      const superAppPath = path.resolve("../HealPointSuperAdminWeb/src/App.jsx");

      const docContent = fs.readFileSync(docAppPath, "utf8");
      const hospContent = fs.readFileSync(hospAppPath, "utf8");
      const superContent = fs.readFileSync(superAppPath, "utf8");

      assert.ok(docContent.includes("Anand HealPoint Doctor Portal"), "Doctor web must include Anand HealPoint");
      assert.ok(hospContent.includes("Anand HealPoint Hospital Admin"), "Hospital admin must include Anand HealPoint");
      assert.ok(superContent.includes("Anand HealPoint Super Admin"), "Super admin must include Anand HealPoint");
    });
  });

  describe("Task 3: Emergency Help / SOS Screen Truthful Progress & Safety", () => {
    it("Verifies emergency screen has removed 24/7 ACTIVE and verified hospital emergency desk claims", () => {
      const screenPath = path.resolve("../app/(drawer)/emergency.tsx");
      const content = fs.readFileSync(screenPath, "utf8");
      assert.ok(!content.includes("<Text style={styles.liveText}>24/7 ACTIVE</Text>"), "Must remove 24/7 ACTIVE claim");
      assert.ok(content.includes("PRACTICE SIMULATION"), "Must use practice simulation indicator");
      assert.ok(content.includes("Emergency Practice"), "Hero card must use Emergency Practice");
    });

    it("Verifies ActiveEmergencyBanner uses truthful internal simulation steps", () => {
      const bannerPath = path.resolve("../components/emergency/ActiveEmergencyBanner.tsx");
      const content = fs.readFileSync(bannerPath, "utf8");
      assert.ok(content.includes("Practice Request Created"), "Step 1 must be Practice Request Created");
      assert.ok(content.includes("Internal Record Updated"), "Step 2 must be Internal Record Updated");
      assert.ok(content.includes("Practice Request Closed"), "Step 3 must be Practice Request Closed");
      assert.ok(!content.includes("Hospital Alerted"), "Must remove fake Hospital Alerted step");
      assert.ok(!content.includes("Ambulance / En Route"), "Must remove fake Ambulance En Route step");
      assert.ok(!content.includes("Assistance Arrived"), "Must remove fake Assistance Arrived step");
    });
  });

  describe("Task 4: Help & Support Ticket Service & Ownership Filtering", () => {
    it("Verifies support screen subtitle does not make 24x7 healthcare claims", () => {
      const supportPath = path.resolve("../app/(drawer)/support.tsx");
      const content = fs.readFileSync(supportPath, "utf8");
      assert.ok(
        content.includes("Help, support requests and user guides."),
        "Support subtitle must be truthful and accurate"
      );
      assert.ok(
        !content.includes("24×7 Healthcare assistance & guides"),
        "Must remove misleading 24x7 healthcare claim"
      );
    });

    it("Verifies supportController getTickets uses safe ObjectId and multi-attribute matching", () => {
      const controllerPath = path.resolve("./controllers/supportController.js");
      const content = fs.readFileSync(controllerPath, "utf8");
      assert.ok(
        content.includes("mongoose.Types.ObjectId.isValid(patientId)"),
        "Must check isValid before creating ObjectId to prevent crashes"
      );
      assert.ok(
        content.includes("patientEmail"),
        "Must allow fallback matching on patientEmail"
      );
    });
  });

  describe("Task 5: Pre-Consultation Preparation Center Routes & Controllers", () => {
    it("Verifies appointment preparation routes are registered in appointmentRoutes.js", () => {
      const routesPath = path.resolve("./routes/appointmentRoutes.js");
      const content = fs.readFileSync(routesPath, "utf8");
      assert.ok(content.includes("/preparation/:id"), "Must register /preparation/:id");
      assert.ok(content.includes("/preparation/:id/questions"), "Must register /preparation/:id/questions");
      assert.ok(content.includes("/preparation/:id/checklist"), "Must register /preparation/:id/checklist");
    });

    it("Verifies prepare screen handles not found gracefully without getting stuck", () => {
      const prepareScreenPath = path.resolve("../app/appointment/prepare/[id].tsx");
      const content = fs.readFileSync(prepareScreenPath, "utf8");
      assert.ok(
        content.includes("No preparation instructions are currently available"),
        "Must show helpful empty state when no preparation exists"
      );
      assert.ok(
        content.includes("My Appointments"),
        "Must offer navigation back to My Appointments"
      );
    });
  });

  describe("Task 6: Offline Screen & Banner Verification", () => {
    it("Verifies OfflineBanner renders user-approved informative message", () => {
      const bannerPath = path.resolve("../components/OfflineBanner.tsx");
      const content = fs.readFileSync(bannerPath, "utf8");
      assert.ok(
        content.includes("You're offline. Available saved information is shown here. Reconnect to refresh information and synchronize changes."),
        "Must render the exact requested offline guidance"
      );
    });
  });

  describe("Task 9 & 10: Official Links Matrix & Google SEO Verification", () => {
    it("Verifies OFFICIAL_ANAND_HEALPOINT_LINKS.md exists and documents all 6 endpoints", () => {
      const linksPath = path.resolve("../OFFICIAL_ANAND_HEALPOINT_LINKS.md");
      assert.ok(fs.existsSync(linksPath), "OFFICIAL_ANAND_HEALPOINT_LINKS.md must exist");
      const content = fs.readFileSync(linksPath, "utf8");
      assert.ok(content.includes("heal-point-mauve.vercel.app"), "Must document patient web");
      assert.ok(content.includes("heal-point-doctor-web.vercel.app"), "Must document doctor web");
      assert.ok(content.includes("heal-point-hospital-admin.vercel.app"), "Must document hospital admin");
      assert.ok(content.includes("heal-point-super-admin.vercel.app"), "Must document super admin");
      assert.ok(content.includes("heal-point-backend.vercel.app"), "Must document backend");
      assert.ok(content.includes("anandhealpoint.com"), "Must document proposed custom domain");
    });

    it("Verifies sitemap.xml and robots.txt exist with proper indexing directives", () => {
      const sitemapPath = path.resolve("../public/sitemap.xml");
      const robotsPath = path.resolve("../public/robots.txt");
      assert.ok(fs.existsSync(sitemapPath), "public/sitemap.xml must exist");
      assert.ok(fs.existsSync(robotsPath), "public/robots.txt must exist");

      const robots = fs.readFileSync(robotsPath, "utf8");
      assert.ok(robots.includes("Disallow: /admin/"), "Must disallow admin portals from public crawlers");
      assert.ok(robots.includes("Sitemap:"), "Must reference sitemap in robots.txt");
    });
  });
});
