import ExcelJS from "exceljs";

export type ExportFormat = "xlsx" | "csv";

interface ExportColumn {
  key: string;
  label: string;
}

export async function exportToFile<T>(
  data: T[],
  columns: ExportColumn[],
  format: ExportFormat,
  filename: string
) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Datos");

  // Header row
  sheet.columns = columns.map((col) => ({
    header: col.label,
    key: col.key,
    width: 20,
  }));

  // Style header
  const headerRow = sheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE2E8F0" },
  };

  // Data rows
  data.forEach((item) => {
    const row: Record<string, unknown> = {};
    columns.forEach((col) => {
      const val = (item as any)[col.key];
      row[col.key] = Array.isArray(val) ? val.join(", ") : val ?? "";
    });
    sheet.addRow(row);
  });

  let buffer: ArrayBuffer;
  let mimeType: string;
  let ext: string;

  if (format === "csv") {
    const csvBuffer = await workbook.csv.writeBuffer();
    buffer = csvBuffer as ArrayBuffer;
    mimeType = "text/csv;charset=utf-8;";
    ext = "csv";
  } else {
    buffer = await workbook.xlsx.writeBuffer() as ArrayBuffer;
    mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
    ext = "xlsx";
  }

  const blob = new Blob([buffer], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${filename}.${ext}`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
