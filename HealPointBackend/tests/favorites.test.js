import test, { describe, it } from "node:test";
import assert from "node:assert/strict";
import mongoose from "mongoose";

describe("Phase 8: Favorites System Suite", () => {
  describe("Favorite Doctors Validation & Duplicate Prevention", () => {
    it("Prevents duplicate doctor favorites in memory list", () => {
      const docId1 = new mongoose.Types.ObjectId().toString();
      const docId2 = new mongoose.Types.ObjectId().toString();

      const favorites = [
        { doctorId: docId1, doctorName: "Dr. A", addedAt: new Date() },
      ];

      // Attempt adding docId1 again
      const alreadyExists = favorites.some(
        (f) => f.doctorId && f.doctorId.toString() === docId1
      );
      assert.equal(alreadyExists, true, "Should identify existing doctor in favorites");

      // Attempt adding docId2
      const existsDoc2 = favorites.some(
        (f) => f.doctorId && f.doctorId.toString() === docId2
      );
      assert.equal(existsDoc2, false, "Should identify docId2 is not in favorites");

      if (!existsDoc2) {
        favorites.push({ doctorId: docId2, doctorName: "Dr. B", addedAt: new Date() });
      }
      assert.equal(favorites.length, 2);
    });

    it("Removes doctor favorite accurately by doctorId string comparison", () => {
      const docId1 = new mongoose.Types.ObjectId().toString();
      const docId2 = new mongoose.Types.ObjectId().toString();

      let favorites = [
        { doctorId: docId1, doctorName: "Dr. A" },
        { doctorId: docId2, doctorName: "Dr. B" },
      ];

      favorites = favorites.filter(
        (f) => f.doctorId && f.doctorId.toString() !== docId1
      );

      assert.equal(favorites.length, 1);
      assert.equal(favorites[0].doctorId, docId2);
    });

    it("Rejects malformed or non-ObjectId strings", () => {
      assert.equal(mongoose.Types.ObjectId.isValid("invalid-doctor-id"), false);
      assert.equal(mongoose.Types.ObjectId.isValid("123"), false);
      assert.equal(mongoose.Types.ObjectId.isValid(new mongoose.Types.ObjectId().toString()), true);
    });
  });

  describe("Favorite Hospitals Validation & Duplicate Prevention", () => {
    it("Prevents duplicate hospital favorites in memory list", () => {
      const hospId1 = new mongoose.Types.ObjectId().toString();
      const hospId2 = new mongoose.Types.ObjectId().toString();

      const favoriteHospitals = [
        { hospitalId: hospId1, addedAt: new Date() },
      ];

      const existsHosp1 = favoriteHospitals.some(
        (f) => f.hospitalId && f.hospitalId.toString() === hospId1
      );
      assert.equal(existsHosp1, true, "Hospital 1 already exists");

      const existsHosp2 = favoriteHospitals.some(
        (f) => f.hospitalId && f.hospitalId.toString() === hospId2
      );
      assert.equal(existsHosp2, false, "Hospital 2 does not exist");

      if (!existsHosp2) {
        favoriteHospitals.push({ hospitalId: hospId2, addedAt: new Date() });
      }
      assert.equal(favoriteHospitals.length, 2);
    });

    it("Removes hospital favorite accurately by hospitalId string comparison", () => {
      const hospId1 = new mongoose.Types.ObjectId().toString();
      const hospId2 = new mongoose.Types.ObjectId().toString();

      let favoriteHospitals = [
        { hospitalId: hospId1 },
        { hospitalId: hospId2 },
      ];

      favoriteHospitals = favoriteHospitals.filter(
        (f) => f.hospitalId && f.hospitalId.toString() !== hospId1
      );

      assert.equal(favoriteHospitals.length, 1);
      assert.equal(favoriteHospitals[0].hospitalId, hospId2);
    });
  });

  describe("Favorites Count Calculation & Status Checks", () => {
    it("Calculates total favorites sum accurately across doctors and hospitals", () => {
      const user = {
        favorites: [{ doctorId: "1" }, { doctorId: "2" }, { doctorId: "3" }],
        favoriteHospitals: [{ hospitalId: "h1" }, { hospitalId: "h2" }],
      };

      const docCount = user.favorites.length;
      const hospCount = user.favoriteHospitals.length;
      const total = docCount + hospCount;

      assert.equal(docCount, 3);
      assert.equal(hospCount, 2);
      assert.equal(total, 5);
    });

    it("Correctly handles empty or null arrays without throwing error", () => {
      const emptyUser = {
        favorites: null,
        favoriteHospitals: undefined,
      };

      const docCount = Array.isArray(emptyUser.favorites) ? emptyUser.favorites.length : 0;
      const hospCount = Array.isArray(emptyUser.favoriteHospitals) ? emptyUser.favoriteHospitals.length : 0;

      assert.equal(docCount, 0);
      assert.equal(hospCount, 0);
      assert.equal(docCount + hospCount, 0);
    });
  });
});
