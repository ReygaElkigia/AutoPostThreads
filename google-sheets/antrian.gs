/**
 * @OnlyCurrentDoc  (script hanya boleh mengakses spreadsheet ini, bukan file Google lain)
 *
 * Antrian cerita untuk Threads AutoPost.
 *
 * Cara pasang (lihat README bagian "Antrian dari Google Sheets"):
 * 1. Di Google Sheets: Ekstensi → Apps Script, hapus isi Code.gs, tempel seluruh file ini.
 * 2. Ganti SECRET di bawah dengan teks acak, lalu isi teks yang sama ke GSHEET_SECRET di .env.
 * 3. Pilih fungsi "siapkanSheet" lalu klik Jalankan (sekali saja) untuk membuat sheet "Antrian".
 * 4. Terapkan → Deployment baru → Aplikasi web, "Jalankan sebagai: Saya", "Yang memiliki akses: Siapa saja".
 * 5. Salin URL aplikasi web (berakhiran /exec) ke GSHEET_URL di .env.
 */

const SECRET = 'GANTI-DENGAN-TEKS-ACAK';
const SHEET_NAME = 'Antrian';
const HEADERS = ['tanggal', 'jam', 'akun', 'kategori', 'ide', 'jumlah_bagian', 'gambar', 'status', 'judul', 'link', 'catatan'];
// Kolom yang boleh diisi oleh n8n. Kolom lain tidak pernah diubah.
const WRITABLE = ['status', 'judul', 'link', 'catatan'];

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (SECRET === 'GANTI-DENGAN-TEKS-ACAK' || p.secret !== SECRET) {
    return json_({ ok: false, error: 'Secret salah atau belum diganti di Apps Script.' });
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) return json_({ ok: false, error: 'Sheet "' + SHEET_NAME + '" tidak ditemukan. Jalankan fungsi siapkanSheet.' });

    const tz = ss.getSpreadsheetTimeZone();
    const range = sheet.getDataRange();
    const values = range.getValues();
    const display = range.getDisplayValues();
    const headers = values[0].map(normalizeHeader_);

    if (p.action === 'list') {
      const rows = [];
      for (let i = 1; i < values.length; i++) {
        if (values[i].every((v) => v === '' || v === null)) continue;
        const row = { row: i + 1 };
        headers.forEach((h, c) => {
          // Jam diambil dari teks yang tampil, karena sel jam disimpan sebagai tanggal tahun 1899 yang rawan geser zona waktu
          if (h) row[h] = h === 'jam' ? display[i][c] : formatCell_(values[i][c], h, tz);
        });
        rows.push(row);
      }
      return json_({ ok: true, timezone: tz, rows: rows });
    }

    if (p.action === 'update') {
      let rowNumber = Number(p.row) || 0;
      // Cari baris lewat nomor eksekusi n8n (dipakai saat workflow gagal)
      if (!rowNumber && p.exec) {
        const statusCol = headers.indexOf('status');
        const catatanCol = headers.indexOf('catatan');
        for (let i = 1; i < values.length; i++) {
          const status = String(values[i][statusCol]).trim().toLowerCase();
          if (status === 'diproses' && String(values[i][catatanCol]).indexOf('#' + p.exec + ' ') !== -1) {
            rowNumber = i + 1;
            break;
          }
        }
      }
      if (rowNumber < 2 || rowNumber > values.length) return json_({ ok: true, updated: false });

      WRITABLE.forEach((key) => {
        const col = headers.indexOf(key);
        if (col === -1 || p[key] === undefined) return;
        let value = String(p[key]);
        if (/^[=+\-@]/.test(value)) value = "'" + value; // jangan sampai dianggap rumus
        sheet.getRange(rowNumber, col + 1).setValue(value);
      });
      return json_({ ok: true, updated: true, row: rowNumber });
    }

    return json_({ ok: false, error: 'Action tidak dikenal: ' + p.action });
  } finally {
    lock.releaseLock();
  }
}

/** Jalankan sekali dari editor Apps Script untuk membuat sheet "Antrian" lengkap dengan contoh. */
function siapkanSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]).setFontWeight('bold');
    sheet.getRange(2, 1, 2, HEADERS.length).setValues([
      ['', '', '', 'kisah lucu di kantor', 'salah kirim chat curhat ke grup kantor', 4, '', '', '', '', ''],
      ['', '', '', 'cerita horor kos-kosan', '', '', '', '', '', '', ''],
    ]);
    sheet.setFrozenRows(1);
    sheet.getRange('A2:A').setNumberFormat('yyyy-mm-dd');
    sheet.getRange('B2:B').setNumberFormat('hh:mm');
  }
  return 'Sheet "' + SHEET_NAME + '" siap.';
}

function normalizeHeader_(h) {
  return String(h).trim().toLowerCase().replace(/\s+/g, '_');
}

// Tanggal dikirim dalam format tetap (yyyy-MM-dd) supaya tidak tergantung format tampilan sheet
function formatCell_(value, header, tz) {
  if (Object.prototype.toString.call(value) === '[object Date]') {
    return Utilities.formatDate(value, tz, header === 'tanggal' ? 'yyyy-MM-dd' : 'yyyy-MM-dd HH:mm');
  }
  return value;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
