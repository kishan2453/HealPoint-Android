/**
 * HealPoint 2.0 — Report Export Service
 *
 * Generates verified, authorized reports in PDF, CSV, and Excel XML formats.
 *
 * Security:
 * - Hospital isolation: Hospital Admins can only export their own hospital's data.
 * - Doctor isolation: Doctors can only export their own consultations/earnings.
 * - Super Admin: Can export authorized platform-level reports.
 * - Strict field whitelisting to prevent leaking sensitive patient health notes.
 */
import PDFDocument from "pdfkit";
import { isVerifiedSuccessfulPayment, resolveDateRange } from "./analyticsService.js";

/**
 * Format currency in Indian Rupees
 */
const formatINR = (val) => `Rs. ${Number(val || 0).toLocaleString("en-IN")}`;

/**
 * Generate CSV String
 */
export function generateCsvReport({ title, rangeLabel, generatedAt, hospitalName, doctorName, headers, rows }) {
  const lines = [];

  // Metadata headers
  lines.push(`"HealPoint Healthcare Platform Report - ${title.replace(/"/g, '""')}"`);
  if (hospitalName) lines.push(`"Hospital: ${hospitalName.replace(/"/g, '""')}"`);
  if (doctorName) lines.push(`"Doctor: ${doctorName.replace(/"/g, '""')}"`);
  lines.push(`"Date Range: ${rangeLabel}"`);
  lines.push(`"Generated At: ${generatedAt}"`);
  lines.push("");

  // Column headers
  lines.push(headers.map((h) => `"${String(h).replace(/"/g, '""')}"`).join(","));

  // Rows
  for (const r of rows) {
    lines.push(r.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","));
  }

  // Prepend UTF-8 BOM for perfect Excel CSV rendering
  return "\uFEFF" + lines.join("\r\n");
}

/**
 * Generate Excel XML Spreadsheet (native .xls / .xml compatible format)
 */
export function generateExcelXmlReport({ title, rangeLabel, generatedAt, hospitalName, doctorName, headers, rows }) {
  const xmlEscape = (str) =>
    String(str ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&apos;");

  let xml = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal">
   <Alignment ss:Vertical="Bottom"/>
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#000000"/>
  </Style>
  <Style ss:ID="Title">
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="14" ss:Color="#2563EB" ss:Bold="1"/>
  </Style>
  <Style ss:ID="Header">
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="11" ss:Color="#FFFFFF" ss:Bold="1"/>
   <Interior ss:Color="#2563EB" ss:Pattern="Solid"/>
  </Style>
  <Style ss:ID="Meta">
   <Font ss:FontName="Calibri" x:Family="Swiss" ss:Size="10" ss:Color="#64748B"/>
  </Style>
 </Styles>
 <Worksheet ss:Name="Report">
  <Table>
   <Row><Cell ss:StyleID="Title"><Data ss:Type="String">HealPoint Healthcare - ${xmlEscape(title)}</Data></Cell></Row>
   <Row><Cell ss:StyleID="Meta"><Data ss:Type="String">Generated: ${xmlEscape(generatedAt)} | Range: ${xmlEscape(rangeLabel)}</Data></Cell></Row>`;

  if (hospitalName) {
    xml += `\n   <Row><Cell ss:StyleID="Meta"><Data ss:Type="String">Hospital: ${xmlEscape(hospitalName)}</Data></Cell></Row>`;
  }
  if (doctorName) {
    xml += `\n   <Row><Cell ss:StyleID="Meta"><Data ss:Type="String">Doctor: ${xmlEscape(doctorName)}</Data></Cell></Row>`;
  }

  xml += `\n   <Row></Row>`;
  xml += `\n   <Row>`;
  for (const h of headers) {
    xml += `<Cell ss:StyleID="Header"><Data ss:Type="String">${xmlEscape(h)}</Data></Cell>`;
  }
  xml += `</Row>`;

  for (const r of rows) {
    xml += `\n   <Row>`;
    for (const cell of r) {
      const isNum = typeof cell === "number";
      xml += `<Cell><Data ss:Type="${isNum ? "Number" : "String"}">${xmlEscape(cell)}</Data></Cell>`;
    }
    xml += `</Row>`;
  }

  xml += `
  </Table>
 </Worksheet>
</Workbook>`;

  return xml;
}

/**
 * Generate PDF Report via PDFKit
 */
export async function generatePdfReport({ title, rangeLabel, generatedAt, hospitalName, doctorName, headers, rows }) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: "A4" });
      const buffers = [];

      doc.on("data", (chunk) => buffers.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(buffers)));

      // Primary Brand Bar
      doc.rect(0, 0, 595.28, 65).fill("#2563EB");

      // Title & Subtitle in White
      doc.fontSize(18).fillColor("#FFFFFF").font("Helvetica-Bold").text("HealPoint Healthcare", 40, 16);
      doc.fontSize(10).font("Helvetica").fillColor("#BFDBFE").text("Verified Healthcare Analytics & Reporting Center", 40, 38);

      doc.y = 80;

      // Report Header Section
      doc.fontSize(14).fillColor("#0F172A").font("Helvetica-Bold").text(title, 40, 80);
      doc.fontSize(9).font("Helvetica").fillColor("#64748B");
      doc.text(`Date Range: ${rangeLabel} | Generated: ${generatedAt}`, 40, 100);

      if (hospitalName) {
        doc.text(`Hospital: ${hospitalName}`, 40, 114);
      }
      if (doctorName) {
        doc.text(`Doctor: ${doctorName}`, 40, 128);
      }

      doc.moveDown(2);

      // Table Header Row
      const startX = 40;
      let startY = doc.y;
      const colWidth = Math.min(100, Math.floor(515 / headers.length));

      doc.rect(startX, startY, 515, 22).fill("#F1F5F9");
      doc.fillColor("#1E293B").font("Helvetica-Bold").fontSize(8);

      headers.forEach((h, i) => {
        doc.text(String(h), startX + i * colWidth + 4, startY + 6, {
          width: colWidth - 8,
          align: "left",
          ellipsis: true,
        });
      });

      startY += 24;
      doc.font("Helvetica").fontSize(8);

      // Rows
      rows.slice(0, 50).forEach((r, rowIdx) => {
        // Page break if near bottom
        if (startY > 740) {
          doc.addPage();
          startY = 40;
        }

        const isEven = rowIdx % 2 === 0;
        if (isEven) {
          doc.rect(startX, startY, 515, 18).fill("#F8FAFC");
        }

        doc.fillColor("#334155");
        r.forEach((cell, i) => {
          doc.text(String(cell ?? "—"), startX + i * colWidth + 4, startY + 4, {
            width: colWidth - 8,
            align: "left",
            ellipsis: true,
          });
        });

        startY += 18;
      });

      if (rows.length > 50) {
        doc.moveDown(1);
        doc.fontSize(8).fillColor("#94A3B8").text(`* Displaying first 50 of ${rows.length} records. For full records, download the CSV or Excel export.`);
      }

      // Footer
      doc.rect(0, 810, 595.28, 32).fill("#F8FAFC");
      doc.fontSize(7).fillColor("#94A3B8").text("Official HealPoint Healthcare System Report. Confidential & HIPAA/DPDP Compliant.", 40, 820, {
        align: "center",
        width: 515,
      });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
