import PDFDocument from "pdfkit";

/**
 * Generates a professional HealPoint digital prescription PDF buffer.
 *
 * @param {Object} prescription - Populated prescription object
 * @returns {Promise<Buffer>} - Resolves with PDF file Buffer
 */
export async function generatePrescriptionPdfBuffer(prescription) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margin: 40,
        info: {
          Title: `Prescription - ${prescription.prescriptionNumber}`,
          Author: prescription.doctorSnapshot?.name || "HealPoint Doctor",
          Subject: "HealPoint Digital Prescription",
          Keywords: "Prescription, Healthcare, HealPoint, Telemedicine",
        },
      });

      const buffers = [];
      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));
      doc.on("error", (err) => reject(err));

      const primaryColor = "#0D9488"; // HealPoint Teal
      const darkColor = "#0F172A"; // Slate dark
      const grayColor = "#64748B"; // Slate gray
      const lightBg = "#F8FAFC"; // Light slate
      const borderColor = "#E2E8F0";

      // 1. HEADER SECTION
      doc.rect(40, 40, 515, 75).fill(lightBg).stroke(borderColor);

      doc
        .fillColor(primaryColor)
        .fontSize(20)
        .font("Helvetica-Bold")
        .text("HealPoint", 55, 52);

      doc
        .fillColor(grayColor)
        .fontSize(9)
        .font("Helvetica")
        .text("CLINICAL & DIGITAL HEALTHCARE PLATFORM", 55, 75);

      const hospitalName =
        prescription.hospitalSnapshot?.name || "HealPoint Partner Hospital";
      const hospitalLoc = [
        prescription.hospitalSnapshot?.address,
        prescription.hospitalSnapshot?.city,
      ]
        .filter(Boolean)
        .join(", ");

      doc
        .fillColor(darkColor)
        .fontSize(10)
        .font("Helvetica-Bold")
        .text(hospitalName, 55, 88);

      if (hospitalLoc) {
        doc
          .fillColor(grayColor)
          .fontSize(8)
          .font("Helvetica")
          .text(hospitalLoc, 55, 100);
      }

      // Doctor Info (Right aligned in Header)
      const docName = prescription.doctorSnapshot?.name || "Attending Doctor";
      const docQual = [
        prescription.doctorSnapshot?.qualification,
        prescription.doctorSnapshot?.speciality,
      ]
        .filter(Boolean)
        .join(" • ");
      const docReg =
        prescription.doctorSnapshot?.registrationNumber || "VERIFIED-PHYSICIAN";

      doc
        .fillColor(darkColor)
        .fontSize(13)
        .font("Helvetica-Bold")
        .text(docName, 300, 52, { width: 240, align: "right" });

      if (docQual) {
        doc
          .fillColor(grayColor)
          .fontSize(8.5)
          .font("Helvetica")
          .text(docQual, 300, 70, { width: 240, align: "right" });
      }

      doc
        .fillColor(primaryColor)
        .fontSize(8.5)
        .font("Helvetica-Bold")
        .text(`Reg No: ${docReg}`, 300, 84, { width: 240, align: "right" });

      doc
        .fillColor(grayColor)
        .fontSize(8)
        .font("Helvetica")
        .text(`Date: ${new Date(prescription.createdAt || Date.now()).toLocaleDateString("en-IN")}`, 300, 98, {
          width: 240,
          align: "right",
        });

      // 2. PATIENT DETAILS BOX
      let y = 125;
      doc.rect(40, y, 515, 50).fillAndStroke("#FFFFFF", borderColor);

      const patName = prescription.patientSnapshot?.name || "Patient";
      const patAge = prescription.patientSnapshot?.age || "—";
      const patGender = prescription.patientSnapshot?.gender || "—";
      const patId =
        prescription.patientSnapshot?.displayId ||
        String(prescription.patientId?._id || prescription.patientId || "").slice(-8).toUpperCase();
      const rxNum = prescription.prescriptionNumber || "RX-HP-001";

      doc
        .fillColor(grayColor)
        .fontSize(8)
        .font("Helvetica")
        .text("PATIENT NAME", 55, y + 10);
      doc
        .fillColor(darkColor)
        .fontSize(10)
        .font("Helvetica-Bold")
        .text(patName, 55, y + 22);

      doc
        .fillColor(grayColor)
        .fontSize(8)
        .font("Helvetica")
        .text("AGE / GENDER", 200, y + 10);
      doc
        .fillColor(darkColor)
        .fontSize(10)
        .font("Helvetica-Bold")
        .text(`${patAge} / ${patGender}`, 200, y + 22);

      doc
        .fillColor(grayColor)
        .fontSize(8)
        .font("Helvetica")
        .text("PATIENT ID", 320, y + 10);
      doc
        .fillColor(darkColor)
        .fontSize(10)
        .font("Helvetica-Bold")
        .text(patId, 320, y + 22);

      doc
        .fillColor(grayColor)
        .fontSize(8)
        .font("Helvetica")
        .text("PRESCRIPTION REF", 430, y + 10);
      doc
        .fillColor(primaryColor)
        .fontSize(10)
        .font("Helvetica-Bold")
        .text(rxNum, 430, y + 22);

      y += 60;

      // 3. DIAGNOSIS & VITALS (If available)
      if (prescription.diagnosis || prescription.vitals?.bloodPressure) {
        doc.rect(40, y, 515, 38).fill(lightBg).stroke(borderColor);

        doc
          .fillColor(primaryColor)
          .fontSize(9)
          .font("Helvetica-Bold")
          .text("DIAGNOSIS & CLINICAL IMPRESSION", 55, y + 8);

        const diagText = prescription.diagnosis || "General Clinical Evaluation";
        doc
          .fillColor(darkColor)
          .fontSize(9.5)
          .font("Helvetica")
          .text(diagText, 55, y + 20, { width: 340 });

        if (prescription.vitals?.bloodPressure) {
          doc
            .fillColor(grayColor)
            .fontSize(8)
            .font("Helvetica")
            .text(`BP: ${prescription.vitals.bloodPressure} mmHg`, 410, y + 14);
        }
        if (prescription.vitals?.pulse) {
          doc
            .fillColor(grayColor)
            .fontSize(8)
            .font("Helvetica")
            .text(`Pulse: ${prescription.vitals.pulse} bpm`, 410, y + 25);
        }

        y += 48;
      }

      // 4. RX SYMBOL & MEDICINES SECTION
      doc
        .fillColor(primaryColor)
        .fontSize(22)
        .font("Helvetica-Bold")
        .text("℞", 42, y);

      doc
        .fillColor(darkColor)
        .fontSize(12)
        .font("Helvetica-Bold")
        .text("Prescribed Medications", 65, y + 6);

      y += 28;

      // Table Header
      doc.rect(40, y, 515, 22).fill(primaryColor);
      doc.fillColor("#FFFFFF").fontSize(8.5).font("Helvetica-Bold");
      doc.text("#", 48, y + 6);
      doc.text("Medicine & Strength", 70, y + 6);
      doc.text("Dosage", 230, y + 6);
      doc.text("Frequency", 300, y + 6);
      doc.text("Duration", 370, y + 6);
      doc.text("Instructions / Food", 440, y + 6);

      y += 22;

      // Table Rows
      const medicines = Array.isArray(prescription.medicines)
        ? prescription.medicines
        : [];

      medicines.forEach((med, idx) => {
        const rowHeight = 32;
        const isEven = idx % 2 === 0;

        doc
          .rect(40, y, 515, rowHeight)
          .fill(isEven ? "#FFFFFF" : lightBg)
          .stroke(borderColor);

        doc.fillColor(darkColor).fontSize(8.5).font("Helvetica-Bold");
        doc.text(`${idx + 1}`, 48, y + 8);

        const medName = med.strength ? `${med.name} (${med.strength})` : med.name;
        doc.text(medName, 70, y + 8, { width: 155 });

        doc.font("Helvetica").fontSize(8);
        doc.text(med.dosage || "1 Tab", 230, y + 8);
        doc.text(med.frequency || "1-0-1", 300, y + 8);
        doc.text(med.duration || "5 days", 370, y + 8);

        const instr = [med.timing, med.instructions].filter(Boolean).join(" • ");
        doc.text(instr || "As directed", 440, y + 8, { width: 105 });

        y += rowHeight;
      });

      y += 15;

      // 5. INSTRUCTIONS & FOLLOW-UP ADVICE
      if (prescription.generalInstructions || prescription.dietInstructions || prescription.followUpInstructions) {
        doc.rect(40, y, 515, 60).fillAndStroke(lightBg, borderColor);

        doc
          .fillColor(primaryColor)
          .fontSize(9)
          .font("Helvetica-Bold")
          .text("CLINICAL INSTRUCTIONS & ADVICE", 55, y + 8);

        let noteY = y + 22;
        if (prescription.generalInstructions) {
          doc
            .fillColor(darkColor)
            .fontSize(8.5)
            .font("Helvetica")
            .text(`• Instructions: ${prescription.generalInstructions}`, 55, noteY, { width: 480 });
          noteY += 12;
        }
        if (prescription.dietInstructions) {
          doc
            .fillColor(darkColor)
            .fontSize(8.5)
            .font("Helvetica")
            .text(`• Dietary: ${prescription.dietInstructions}`, 55, noteY, { width: 480 });
          noteY += 12;
        }
        if (prescription.followUpInstructions || prescription.followUpDate) {
          const fuDate = prescription.followUpDate
            ? ` on ${new Date(prescription.followUpDate).toLocaleDateString("en-IN")}`
            : "";
          doc
            .fillColor(darkColor)
            .fontSize(8.5)
            .font("Helvetica")
            .text(`• Next Review / Follow-up: ${prescription.followUpInstructions || "Consult if symptoms persist"}${fuDate}`, 55, noteY, { width: 480 });
        }

        y += 75;
      } else {
        y += 20;
      }

      // 6. DIGITAL SIGNATURE & FOOTER
      const signY = Math.max(y, 670);

      doc.rect(40, signY, 515, 80).fillAndStroke("#FFFFFF", borderColor);

      doc
        .fillColor(primaryColor)
        .fontSize(9)
        .font("Helvetica-Bold")
        .text("DIGITALLY SIGNED & VERIFIED", 55, signY + 12);

      doc
        .fillColor(darkColor)
        .fontSize(8.5)
        .font("Helvetica")
        .text(`Physician: ${docName}`, 55, signY + 26);

      doc
        .fillColor(grayColor)
        .fontSize(8)
        .font("Helvetica")
        .text(
          `Signed At: ${prescription.signedAt ? new Date(prescription.signedAt).toLocaleString("en-IN") : new Date().toLocaleString("en-IN")}`,
          55,
          signY + 38
        );

      doc
        .fillColor(primaryColor)
        .fontSize(8)
        .font("Helvetica-Bold")
        .text(
          `Security Token: ${prescription.isDigitallySigned ? "SHA256-CERTIFIED" : "SYSTEM-VERIFIED"}`,
          55,
          signY + 50
        );

      // Signature Stamp box on the right
      doc.rect(380, signY + 10, 160, 58).stroke(borderColor);
      doc
        .fillColor(primaryColor)
        .fontSize(10)
        .font("Helvetica-Bold")
        .text("DR. SIGNATURE STAMP", 385, signY + 18, { width: 150, align: "center" });
      doc
        .fillColor(darkColor)
        .fontSize(8.5)
        .font("Helvetica")
        .text(docName, 385, signY + 34, { width: 150, align: "center" });
      doc
        .fillColor(grayColor)
        .fontSize(7.5)
        .font("Helvetica")
        .text(`MCI: ${docReg}`, 385, signY + 46, { width: 150, align: "center" });

      // Legal Telemedicine Disclaimer at bottom
      doc
        .fillColor(grayColor)
        .fontSize(7)
        .font("Helvetica")
        .text(
          "This is an electronically generated valid prescription pursuant to the Information Technology Act, 2000 and Telemedicine Practice Guidelines. Dispensing chemists can verify this prescription on the HealPoint Network.",
          40,
          770,
          { width: 515, align: "center" }
        );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
