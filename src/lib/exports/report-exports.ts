import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import { loadLogoDataUrl } from "@/lib/pdf/invoice-pdf";
import { sanitizeSpreadsheetCell } from "@/lib/security";

export function downloadCsv(
  filename: string,
  headers: string[],
  rows: Array<Array<string | number>>
) {
  const escapeCsv = (val: unknown) => {
    const safe = sanitizeSpreadsheetCell(val);
    if (/[",\n\r]/.test(safe)) {
      return `"${safe.replace(/"/g, '""')}"`;
    }
    return safe;
  };

  const lines = [
    headers.map(escapeCsv).join(","),
    ...rows.map((r) => r.map(escapeCsv).join(",")),
  ];

  const blob = new Blob(["\uFEFF" + lines.join("\r\n")], {
    type: "text/csv;charset=utf-8;",
  });
  triggerDownload(filename.endsWith(".csv") ? filename : `${filename}.csv`, blob);
}

export function downloadXlsx(
  filename: string,
  sheetName: string,
  headers: string[],
  rows: Array<Array<string | number>>
) {
  const safeRows = rows.map((row) =>
    row.map((cell) =>
      typeof cell === "number" ? cell : sanitizeSpreadsheetCell(cell)
    )
  );
  const ws = XLSX.utils.aoa_to_sheet([headers, ...safeRows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));
  XLSX.writeFile(wb, filename.endsWith(".xlsx") ? filename : `${filename}.xlsx`);
}

export async function downloadReportPdf(
  filename: string,
  title: string,
  subtitle: string,
  headers: string[],
  rows: Array<Array<string | number>>,
  totalsRow?: Array<string | number>
) {
  const orientation = headers.length > 7 ? "landscape" : "portrait";
  const doc = new jsPDF({ orientation, unit: "mm", format: "a4" });
  const logo = await loadLogoDataUrl();

  const leftX = logo ? 28 : 14;
  if (logo) {
    doc.addImage(logo, "PNG", 14, 10, 11, 11);
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(35, 23, 15);
  doc.text(title, leftX, 15);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(92, 71, 56);
  doc.text(subtitle, leftX, 20);

  const sanitizePdfText = (val: string | number) =>
    String(val).replace(/₹/g, "Rs. ");

  const body = totalsRow ? [...rows, totalsRow] : rows;

  autoTable(doc, {
    startY: 26,
    margin: { left: 14, right: 14 },
    head: [headers],
    body: body.map((r) => r.map(sanitizePdfText)),
    styles: {
      font: "helvetica",
      fontSize: 7.5,
      cellPadding: 2,
      textColor: [35, 23, 15],
    },
    headStyles: {
      fillColor: [120, 53, 15],
      textColor: [255, 253, 249],
    },
  });

  doc.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}

export function downloadXmlFile(filename: string, xmlContent: string) {
  const blob = new Blob([xmlContent], { type: "application/xml;charset=utf-8;" });
  triggerDownload(filename.endsWith(".xml") ? filename : `${filename}.xml`, blob);
}

function triggerDownload(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
