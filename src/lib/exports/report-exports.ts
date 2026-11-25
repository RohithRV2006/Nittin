import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
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

export function downloadReportPdf(
  filename: string,
  title: string,
  subtitle: string,
  headers: string[],
  rows: Array<Array<string | number>>,
  totalsRow?: Array<string | number>
) {
  const orientation = headers.length > 7 ? "landscape" : "portrait";
  const doc = new jsPDF({ orientation, unit: "mm", format: "a4" });

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text(title, 14, 16);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(subtitle, 14, 22);

  const body = totalsRow ? [...rows, totalsRow] : rows;

  autoTable(doc, {
    startY: 27,
    head: [headers],
    body: body.map((r) => r.map((c) => String(c))),
    styles: { fontSize: 7.5, cellPadding: 2 },
    headStyles: { fillColor: [4, 120, 87] },
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
