import { useMemo, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorker;
import { supabase } from './supabase';

type Kind = 'students' | 'teachers';
type ImportRow = Record<string, string>;

const aliases: Record<string, string[]> = {
  first_name: ['first_name', 'firstname', 'jina la kwanza', 'jina', 'first name'],
  middle_name: ['middle_name', 'middlename', 'jina la kati', 'middle name'],
  last_name: ['last_name', 'lastname', 'jina la mwisho', 'surname', 'last name'],
  full_name: ['full_name', 'name', 'majina kamili', 'jina kamili', 'full name'],
  gender: ['gender', 'jinsia', 'sex'],
  phone: ['phone', 'simu', 'namba ya simu', 'telephone'],
  email: ['email', 'barua pepe'],
  address: ['address', 'anwani'],
  date_of_birth: ['date_of_birth', 'tarehe ya kuzaliwa', 'dob'],
  admission_date: ['admission_date', 'tarehe ya kujiunga'],
  employment_date: ['employment_date', 'tarehe ya ajira']
};

function normalize(value: string) {
  return value.trim().toLowerCase().replace(/[\s-]+/g, ' ');
}

function normalizeGender(value?: string): 'Male' | 'Female' | null {
  const gender = normalize(value || '');
  if (['male', 'm', 'man', 'boy', 'mwanaume', 'mvulana', 'me'].includes(gender)) return 'Male';
  if (['female', 'f', 'woman', 'girl', 'mwanamke', 'msichana', 'ke'].includes(gender)) return 'Female';
  return null;
}

function parseDelimited(text: string): string[][] {
  const firstLine = text.split(/\r?\n/, 1)[0] || '';
  const delimiter = firstLine.includes('\t') ? '\t' : firstLine.includes(';') && !firstLine.includes(',') ? ';' : ',';
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    if (char === '"' && quoted && text[i + 1] === '"') {
      cell += '"';
      i++;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      row.push(cell.trim());
      cell = '';
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && text[i + 1] === '\n') i++;
      row.push(cell.trim());
      if (row.some(value => value !== '')) rows.push(row);
      row = [];
      cell = '';
    } else {
      cell += char;
    }
  }
  row.push(cell.trim());
  if (row.some(value => value !== '')) rows.push(row);
  return rows;
}

function rowsFromText(text: string): ImportRow[] {
  const raw = parseDelimited(text.replace(/^\uFEFF/, ''));
  if (!raw.length) return [];

  const headerNames = raw[0].map(normalize);
  const headerMap = Object.entries(aliases).map(([field, names]) => ({
    field,
    index: headerNames.findIndex(name => names.includes(name))
  })).filter(item => item.index >= 0);

  const hasHeader = headerMap.some(item => ['first_name', 'full_name', 'last_name'].includes(item.field));
  const data = hasHeader ? raw.slice(1) : raw;
  const mapping = hasHeader
    ? headerMap
    : ['first_name', 'middle_name', 'last_name', 'gender', 'phone', 'email', 'address'].map((field, index) => ({ field, index }));

  return data.map(cells => {
    const result: ImportRow = {};
    mapping.forEach(({ field, index }) => {
      result[field] = cells[index] || '';
    });
    if (!result.first_name && result.full_name) {
      const names = result.full_name.trim().split(/\s+/);
      result.first_name = names[0] || '';
      result.last_name = names.length > 1 ? names[names.length - 1] : '';
      result.middle_name = names.length > 2 ? names.slice(1, -1).join(' ') : '';
    }
    return result;
  }).filter(row => row.first_name || row.last_name);
}

async function extractPdfText(file: File): Promise<string> {
  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjsLib.getDocument({ data }).promise;
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const lines = new Map<number, Array<{ x: number; text: string }>>();
    for (const item of content.items) {
      if (!('str' in item) || !item.str.trim()) continue;
      const y = Math.round(item.transform[5] / 3) * 3;
      const line = lines.get(y) || [];
      line.push({ x: item.transform[4], text: item.str.trim() });
      lines.set(y, line);
    }
    const pageLines = [...lines.entries()].sort((a, b) => b[0] - a[0]).map((entry) => entry[1].sort((a, b) => a.x - b.x).map((item) => item.text).join('\t'));
    pages.push(pageLines.join('\n'));
  }
  return pages.join('\n');
}
function makeEmployeeNo() {
  const year = new Date().getFullYear();
  return `AJR-${year}-${crypto.randomUUID().replace(/-/g, '').slice(0, 10).toUpperCase()}`;
}

export default function BulkImportPanel({ kind, schoolId, onComplete }: {
  kind: Kind;
  schoolId: string;
  onComplete: () => Promise<void> | void;
}) {
  const [text, setText] = useState('');
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const validRows = useMemo(
    () => rows.filter(row => row.first_name?.trim() && row.last_name?.trim()),
    [rows]
  );

  function prepare(value: string) {
    setText(value);
    setRows(rowsFromText(value));
    setError('');
    setMessage('');
  }

  async function chooseFile(file?: File) {
    if (!file) return;
    if (!/\.(csv|txt|pdf)$/i.test(file.name)) {
      setError('Pakia CSV, TXT au PDF. Faili la Excel (.xlsx) lifungue Excel kisha Save As → CSV UTF-8.');
      return;
    }
    setFileName(file.name);
    try {
      if (/\.pdf$/i.test(file.name)) {
        const extracted = await extractPdfText(file);
        if (!extracted.trim()) {
          setError('PDF hii haina maandishi yanayoweza kusomwa. Inaweza kuwa scanned; tumia PDF yenye maandishi au OCR.');
          return;
        }
        prepare(extracted);
      } else {
        prepare(await file.text());
      }
    } catch (e) {
      setError(e instanceof Error ? 'Imeshindikana kusoma PDF: ' + e.message : 'Imeshindikana kusoma faili.');
    }
  }

  async function importRows() {
    if (!schoolId) {
      setError('Chagua shule kwanza.');
      return;
    }
    if (!validRows.length) {
      setError('Hakuna majina sahihi ya kuingiza. Jaza jina la kwanza na la mwisho.');
      return;
    }

    const payload = validRows.map(row => {
      const common = {
        school_id: schoolId,
        first_name: row.first_name.trim(),
        middle_name: row.middle_name?.trim() || null,
        last_name: row.last_name.trim(),
        phone: row.phone?.trim() || null,
        address: row.address?.trim() || null,
        status: 'Active'
      };

      return kind === 'students'
        ? {
            ...common,
            gender: normalizeGender(row.gender),
            date_of_birth: row.date_of_birth?.trim() || null,
            admission_date: row.admission_date?.trim() || null
          }
        : {
            ...common,
            employee_no: makeEmployeeNo(),
            email: row.email?.trim() || null,
            employment_date: row.employment_date?.trim() || null,
            photo_url: null
          };
    });

    setBusy(true);
    setError('');
    setMessage('');
    let inserted = 0;
    let failed = 0;
    const failures: string[] = [];

    try {
      for (let start = 0; start < payload.length; start += 50) {
        const batch = payload.slice(start, start + 50);
        const { error: insertError } = await supabase
          .from(kind)
          .insert(batch);
        if (insertError) {
          failed += batch.length;
          if (failures.length < 3) failures.push(insertError.message);
        } else {
          inserted += batch.length;
        }
      }

      await onComplete();
      setMessage(`Zimeingizwa: ${inserted}. Zilizoshindikana: ${failed}.`);
      if (failures.length) setError(failures.join(' | '));
      if (inserted > 0) {
        setText('');
        setRows([]);
        setFileName('');
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Imeshindikana kuingiza taarifa.');
    } finally {
      setBusy(false);
    }
  }

  const fieldHint = kind === 'students'
    ? 'Majina, jinsia, simu, anwani, tarehe ya kuzaliwa'
    : 'Majina, simu, email, anwani';

  return (
    <section style={{ border: '1px solid #cbd5e1', borderRadius: 12, padding: 16, margin: '16px 0', background: '#f8fafc', display: 'grid', gap: 12 }}>
      <div>
        <h3 style={{ margin: '0 0 6px' }}>Import {kind === 'students' ? 'Wanafunzi' : 'Walimu'} (Excel/CSV au Copy-Paste)</h3>
        <p style={{ margin: 0, color: '#64748b', fontSize: 13 }}>
          Pakia CSV au PDF yenye maandishi, au paste safu kutoka Excel moja kwa moja hapa. {fieldHint}.
        </p>
      </div>
      <label style={{ display: 'grid', gap: 6, fontWeight: 600, fontSize: 14 }}>
        Chagua faili la CSV au PDF
        <input type="file" accept=".csv,.txt,.pdf,application/pdf,text/csv,text/plain" onChange={e => void chooseFile(e.target.files?.[0])} />
      </label>
      {fileName && <small style={{ color: '#475569' }}>Faili: {fileName}</small>}
      <label style={{ display: 'grid', gap: 6, fontWeight: 600, fontSize: 14 }}>
        Au paste data hapa
        <textarea
          value={text}
          onChange={e => prepare(e.target.value)}
          rows={5}
          placeholder={'first_name\tmiddle_name\tlast_name\tphone\nAsha\tAli\tJuma\t0712345678'}
          style={{ width: '100%', boxSizing: 'border-box', padding: 12, border: '1px solid #cbd5e1', borderRadius: 9, font: '14px monospace' }}
        />
      </label>
      <small style={{ color: '#64748b' }}>
        Mpangilio bila vichwa vya safu: Jina la kwanza, jina la kati, jina la mwisho, jinsia, simu, email, anwani. Unaweza pia kutumia safu ya “Majina kamili”.
      </small>
      {rows.length > 0 && (
        <div style={{ overflowX: 'auto', background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, padding: 10 }}>
          <b>Preview: {validRows.length} kati ya {rows.length} majina yako tayari kuingizwa</b>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, marginTop: 8 }}>
            <thead><tr><th style={{ textAlign: 'left', padding: 6 }}>Jina la kwanza</th><th style={{ textAlign: 'left', padding: 6 }}>Jina la kati</th><th style={{ textAlign: 'left', padding: 6 }}>Jina la mwisho</th></tr></thead>
            <tbody>{rows.slice(0, 8).map((row, index) => <tr key={index}><td style={{ padding: 6 }}>{row.first_name}</td><td style={{ padding: 6 }}>{row.middle_name}</td><td style={{ padding: 6 }}>{row.last_name}</td></tr>)}</tbody>
          </table>
          {rows.length > 8 && <small>Inaonyesha majina 8 ya mwanzo.</small>}
        </div>
      )}
      {error && <div role="alert" style={{ color: '#b42318', background: '#fff1f0', padding: 10, borderRadius: 8, overflowWrap: 'anywhere' }}>{error}</div>}
      {message && <div role="status" style={{ color: '#16845b', background: '#ecfdf3', padding: 10, borderRadius: 8 }}>{message}</div>}
      <button type="button" disabled={busy || validRows.length === 0 || !schoolId} onClick={() => void importRows()} style={{ border: 0, borderRadius: 9, padding: '12px 16px', background: busy ? '#94a3b8' : '#173b5e', color: '#fff', fontWeight: 700, cursor: busy ? 'wait' : 'pointer' }}>
        {busy ? 'Inaingiza...' : `Ingiza majina ${validRows.length}`}
      </button>
    </section>
  );
}
