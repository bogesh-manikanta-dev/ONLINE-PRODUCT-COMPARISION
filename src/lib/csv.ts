import { csvProductRowSchema } from '../../shared/validators.ts';

export interface ParsedCsvRow {
  rowNumber: number;
  raw: Record<string, string>;
}

export interface CsvValidationResult {
  validRows: Array<{
    rowNumber: number;
    data: {
      name: string;
      brand: string;
      categorySlug: string;
      subcategory: string;
      modelNumber: string;
      basePrice: number;
      currency: string;
      availabilityStatus: 'IN_STOCK' | 'LIMITED' | 'OUT_OF_STOCK' | 'DISCONTINUED';
      description: string;
      specs: Record<string, string>;
    };
  }>;
  errors: Array<{ rowNumber: number; message: string }>;
}

export const SAMPLE_CSV_TEMPLATE = `name,brand,categorySlug,subcategory,modelNumber,basePrice,currency,availabilityStatus,description,specsJson
"Samsung Galaxy Book4 Pro 14","Samsung","laptops","Ultrabooks","NP940XGK-KG1IN",131990,"INR","IN_STOCK","Ultra-slim 14-inch AMOLED creator laptop with Intel Core Ultra 7 processor and 16GB RAM.","{""processor"":""Intel Core Ultra 7 155H"",""ram"":""16 GB"",""storage"":""512 GB"",""display"":""14-inch 3K Dynamic AMOLED 2X"",""battery"":""16 hours"",""weight"":""1.23 kg""}"
"Sony WH-CH720N Wireless ANC","Sony","headphones","Over-Ear ANC","WHCH720N-B",9990,"INR","IN_STOCK","Lightweight noise-canceling wireless headphones with Integrated Processor V1 and 35-hour battery.","{""battery"":""35 hours"",""anc"":""Yes"",""weight"":""192 g"",""bluetooth"":""5.2""}"
`;

export function parseCsvText(csvContent: string): { headers: string[]; rows: ParsedCsvRow[] } {
  const lines: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < csvContent.length; i++) {
    const ch = csvContent[i];
    const next = csvContent[i + 1];

    if (ch === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && next === '\n') i++;
      if (current.trim().length > 0) lines.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim().length > 0) lines.push(current);

  if (lines.length === 0) return { headers: [], rows: [] };

  const splitLine = (line: string): string[] => {
    const cells: string[] = [];
    let cell = '';
    let quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      const next = line[i + 1];
      if (ch === '"') {
        if (quoted && next === '"') {
          cell += '"';
          i++;
        } else {
          quoted = !quoted;
        }
      } else if (ch === ',' && !quoted) {
        cells.push(cell.trim());
        cell = '';
      } else {
        cell += ch;
      }
    }
    cells.push(cell.trim());
    return cells;
  };

  const headers = splitLine(lines[0]);
  const rows: ParsedCsvRow[] = [];

  for (let idx = 1; idx < lines.length; idx++) {
    const cols = splitLine(lines[idx]);
    const raw: Record<string, string> = {};
    headers.forEach((h, hIdx) => {
      raw[h] = cols[hIdx] ?? '';
    });
    rows.push({ rowNumber: idx + 1, raw });
  }

  return { headers, rows };
}

export const REQUIRED_CSV_COLUMNS = [
  'name',
  'brand',
  'categorySlug',
  'modelNumber',
  'basePrice',
  'description',
];

export function validateProductCsv(csvContent: string): CsvValidationResult {
  const { headers, rows } = parseCsvText(csvContent);
  const errors: Array<{ rowNumber: number; message: string }> = [];
  const validRows: CsvValidationResult['validRows'] = [];

  if (headers.length === 0 || rows.length === 0) {
    errors.push({ rowNumber: 1, message: 'CSV file is empty or missing data rows.' });
    return { validRows, errors };
  }

  const missingCols = REQUIRED_CSV_COLUMNS.filter((col) => !headers.includes(col));
  if (missingCols.length > 0) {
    errors.push({
      rowNumber: 1,
      message: `Missing required CSV column(s): ${missingCols.join(', ')}`,
    });
    return { validRows, errors };
  }

  for (const row of rows) {
    const parsed = csvProductRowSchema.safeParse(row.raw);
    if (!parsed.success) {
      const issueMsg = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
      errors.push({ rowNumber: row.rowNumber, message: issueMsg });
      continue;
    }

    let specs: Record<string, string> = {};
    if (parsed.data.specsJson && parsed.data.specsJson.trim() !== '') {
      try {
        const obj = JSON.parse(parsed.data.specsJson);
        if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
          errors.push({ rowNumber: row.rowNumber, message: 'specsJson must be a JSON object' });
          continue;
        }
        for (const [k, v] of Object.entries(obj)) {
          specs[k] = String(v);
        }
      } catch {
        errors.push({ rowNumber: row.rowNumber, message: 'Invalid JSON in specsJson column' });
        continue;
      }
    }

    validRows.push({
      rowNumber: row.rowNumber,
      data: {
        name: parsed.data.name,
        brand: parsed.data.brand,
        categorySlug: parsed.data.categorySlug,
        subcategory: parsed.data.subcategory,
        modelNumber: parsed.data.modelNumber,
        basePrice: parsed.data.basePrice,
        currency: parsed.data.currency.toUpperCase(),
        availabilityStatus: parsed.data.availabilityStatus,
        description: parsed.data.description,
        specs,
      },
    });
  }

  return { validRows, errors };
}
