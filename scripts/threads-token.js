#!/usr/bin/env node
// Alat bantu token Threads. Jalankan di dalam container n8n (variabel dari .env sudah tersedia):
//
//   docker compose exec n8n node /scripts/threads-token.js cek
//   docker compose exec n8n node /scripts/threads-token.js tukar <TOKEN_SHORT_LIVED>
//   docker compose exec n8n node /scripts/threads-token.js refresh
//
// cek     : tampilkan akun Threads pemilik token di .env (sekaligus menguji token)
// tukar   : tukar token short-lived (1 jam) jadi long-lived (60 hari). Butuh THREADS_APP_SECRET.
// refresh : perpanjang token long-lived di .env (minimal berumur 24 jam dan belum kedaluwarsa)

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

function envToken() {
  const token = (process.env.THREADS_ACCESS_TOKEN || '').trim();
  if (!token) throw new Error('THREADS_ACCESS_TOKEN di .env masih kosong.');
  return token;
}

function printNewToken(res) {
  const days = Math.round((Number(res.expires_in) || 0) / 86400);
  console.log('\nToken baru (berlaku ~' + days + ' hari):\n');
  console.log(res.access_token);
  console.log('\nSalin token di atas ke THREADS_ACCESS_TOKEN di file .env, lalu jalankan: docker compose up -d');
}

const commands = {
  async cek() {
    const me = await call('/v1.0/me', { fields: 'id,username,name', access_token: envToken() });
    console.log('Token valid.');
    console.log(`Akun     : @${me.username}${me.name ? ` (${me.name})` : ''}`);
    console.log(`User ID  : ${me.id}  (boleh diisi ke THREADS_USER_ID, atau biarkan "me")`);
  },

  async tukar(shortToken) {
    if (!shortToken) throw new Error('Pakai: node /scripts/threads-token.js tukar <TOKEN_SHORT_LIVED>');
    const secret = (process.env.THREADS_APP_SECRET || '').trim();
    if (!secret) throw new Error('THREADS_APP_SECRET di .env masih kosong (lihat App settings > Basic > Threads App secret).');
    printNewToken(
      await call('/access_token', { grant_type: 'th_exchange_token', client_secret: secret, access_token: shortToken })
    );
  },

  async refresh() {
    printNewToken(await call('/refresh_access_token', { grant_type: 'th_refresh_token', access_token: envToken() }));
  },
};

const [cmd, ...args] = process.argv.slice(2);
if (!commands[cmd]) {
  console.log('Perintah: cek | tukar <TOKEN_SHORT_LIVED> | refresh');
  process.exit(1);
}
commands[cmd](...args).catch((err) => {
  console.error('Gagal:', err.message);
  process.exit(1);
});
