#!/usr/bin/env node
// Alat bantu notifikasi Telegram. Jalankan di dalam container n8n (variabel dari .env sudah tersedia):
//
//   docker compose exec n8n node /scripts/telegram.js chat-id
//   docker compose exec n8n node /scripts/telegram.js tes
//
// chat-id : tampilkan chat ID dari pesan terbaru yang diterima bot (kirim /start ke bot dulu)
// tes     : kirim pesan uji ke TELEGRAM_CHAT_ID

const HOST = (process.env.TELEGRAM_API_HOST || 'https://api.telegram.org').replace(/\/+$/, '');

function botToken() {
  const token = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
  if (!token) throw new Error('TELEGRAM_BOT_TOKEN di .env masih kosong (buat bot lewat @BotFather).');
  return token;
}

async function call(method, body) {
  const res = await fetch(`${HOST}/bot${botToken()}/${method}`, {
    method: body ? 'POST' : 'GET',
    headers: body ? { 'content-type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!data.ok) throw new Error(data.description || `HTTP ${res.status}`);
  return data.result;
}

const commands = {
  async 'chat-id'() {
    const bot = await call('getMe');
    const updates = await call('getUpdates');
    const chats = new Map();
    for (const u of updates) {
      const chat = (u.message || u.channel_post || u.my_chat_member || {}).chat;
      if (chat) chats.set(chat.id, chat);
    }
    if (chats.size === 0) {
      console.log(`Belum ada pesan untuk bot @${bot.username}.`);
      console.log(`Buka Telegram, kirim /start ke @${bot.username} (atau tambahkan bot ke grup lalu kirim pesan), lalu jalankan perintah ini lagi.`);
      return;
    }
    console.log(`Chat yang pernah mengirim pesan ke @${bot.username}:\n`);
    for (const chat of chats.values()) {
      const name = chat.title || [chat.first_name, chat.last_name].filter(Boolean).join(' ') || chat.username || '-';
      console.log(`  ${String(chat.id).padEnd(16)} ${chat.type.padEnd(11)} ${name}`);
    }
    console.log('\nSalin angka chat ID ke TELEGRAM_CHAT_ID di file .env, lalu jalankan: docker compose up -d');
  },

  async tes() {
    const chatId = (process.env.TELEGRAM_CHAT_ID || '').trim();
    if (!chatId) throw new Error('TELEGRAM_CHAT_ID di .env masih kosong. Jalankan dulu: node /scripts/telegram.js chat-id');
    await call('sendMessage', { chat_id: chatId, text: '👋 Tes notifikasi dari Threads AutoPost berhasil!' });
    console.log('Pesan uji terkirim. Cek Telegram kamu.');
  },
};

const [cmd] = process.argv.slice(2);
if (!commands[cmd]) {
  console.log('Perintah: chat-id | tes');
  process.exit(1);
}
commands[cmd]().catch((err) => {
  console.error('Gagal:', err.message);
  process.exit(1);
});
