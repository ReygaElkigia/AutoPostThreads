#!/usr/bin/env node
// Alat bantu token Threads. Jalankan di dalam container n8n (variabel dari .env sudah tersedia):
//
//   docker compose exec n8n node /scripts/threads-token.js cek [nomor-akun]
//   docker compose exec n8n node /scripts/threads-token.js tukar <TOKEN_SHORT_LIVED>
//   docker compose exec n8n node /scripts/threads-token.js refresh [nomor-akun]
//
// cek     : tampilkan akun Threads pemilik token di .env (sekaligus menguji token)
// tukar   : tukar token short-lived (1 jam) jadi long-lived (60 hari). Butuh THREADS_APP_SECRET.
// refresh : perpanjang token long-lived di .env (minimal berumur 24 jam dan belum kedaluwarsa)
// nomor-akun: kosong/1 = THREADS_ACCESS_TOKEN, 2 = AKUN_2_THREADS_ACCESS_TOKEN, dst. Isi "semua" untuk cek semua akun.

const HOST = (process.env.THREADS_API_HOST || 'https://graph.threads.net').replace(/\/+$/, '');

async function call(path, params) {
  const url = `${HOST}${path}?${new URLSearchParams(params)}`;
  const res = await fetch(url);
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) {
    const msg = body.error?.message || `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return body;
}

function namaVariabel(no) {
  return Number(no) > 1 ? `AKUN_${Number(no)}_THREADS_ACCESS_TOKEN` : 'THREADS_ACCESS_TOKEN';
}

function envToken(no = 1) {
  const nama = namaVariabel(no);
  const token = (process.env[nama] || (Number(no) === 1 ? process.env.AKUN_1_THREADS_ACCESS_TOKEN : '') || '').trim();
  if (!token) throw new Error(`${nama} di .env masih kosong.`);
  return token;
}

function printNewToken(res, variabel = 'THREADS_ACCESS_TOKEN') {
  const days = Math.round((Number(res.expires_in) || 0) / 86400);
  console.log('\nToken baru (berlaku ~' + days + ' hari):\n');
  console.log(res.access_token);
  console.log(`\nSalin token di atas ke ${variabel} di file .env, lalu jalankan: docker compose up -d`);
}

const commands = {
  async cek(no = '1') {
    if (no === 'semua') {
      for (let n = 1; n <= 10; n++) {
        if (!(process.env[namaVariabel(n)] || '').trim()) continue;
        console.log(`\n== Akun ${n} (${namaVariabel(n)})`);
        await commands.cek(String(n)).catch((err) => console.log('Gagal:', err.message));
      }
      return;
    }
    const me = await call('/v1.0/me', { fields: 'id,username,name', access_token: envToken(no) });
    const awalan = Number(no) > 1 ? `AKUN_${Number(no)}_` : '';
    console.log('Token valid.');
    console.log(`Akun     : @${me.username}${me.name ? ` (${me.name})` : ''}`);
    console.log(`User ID  : ${me.id}  (boleh diisi ke ${awalan}THREADS_USER_ID, atau biarkan kosong)`);
  },

  async tukar(shortToken) {
    if (!shortToken) throw new Error('Pakai: node /scripts/threads-token.js tukar <TOKEN_SHORT_LIVED>');
    const secret = (process.env.THREADS_APP_SECRET || '').trim();
    if (!secret) throw new Error('THREADS_APP_SECRET di .env masih kosong (lihat App settings > Basic > Threads App secret).');
    printNewToken(
      await call('/access_token', { grant_type: 'th_exchange_token', client_secret: secret, access_token: shortToken })
    );
  },

  async refresh(no = '1') {
    printNewToken(
      await call('/refresh_access_token', { grant_type: 'th_refresh_token', access_token: envToken(no) }),
      namaVariabel(no)
    );
  },
};

const [cmd, ...args] = process.argv.slice(2);
if (!commands[cmd]) {
  console.log('Perintah: cek [nomor-akun|semua] | tukar <TOKEN_SHORT_LIVED> | refresh [nomor-akun]');
  process.exit(1);
}
commands[cmd](...args).catch((err) => {
  console.error('Gagal:', err.message);
  process.exit(1);
});
