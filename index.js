require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// ===== MESSAGE TRACKING FOR /clear =====
let sentMessages = {}; // { chatId: [messageId, ...] }

// Helper to send message and track its message_id
async function sendAndTrack(chatId, text, options) {
  try {
    const sent = await bot.sendMessage(chatId, text, options);
    if (!sentMessages[chatId]) sentMessages[chatId] = [];
    sentMessages[chatId].push(sent.message_id);
    return sent;
  } catch (err) {
    console.error("sendAndTrack error:", err.message);
  }
}

// Helper to send photo and track its message_id
async function sendPhotoAndTrack(chatId, photo, options) {
  try {
    const sent = await bot.sendPhoto(chatId, photo, options);
    if (!sentMessages[chatId]) sentMessages[chatId] = [];
    sentMessages[chatId].push(sent.message_id);
    return sent;
  } catch (err) {
    console.error("sendPhotoAndTrack error:", err.message);
  }
}

// ===== QUEUE SYSTEM =====
let otpQueue = [];
let currentProcess = null;

// ===== TOP-UP PENDING =====
let pendingTopUps = {}; // { userId: { chatId, screenshot, approved: false } }

// ===== TELEGRAM MENU BUTTON =====
bot.setMyCommands([
  { command: "start", description: "Open Menu" },
  { command: "buy", description: "Buy OTP" },
  { command: "balance", description: "Check Balance" },
  { command: "rates", description: "View Rates" },
  { command: "availability", description: "Check Availability" }
]);

// ===== DATA =====
const services = {
  Foodpanda: 7, Grab: 5, Facebook: 5, Telegram: 18, Whatsapp: 3,
  Arionplay: 3, Ninogaming: 3, Casinoplus: 8, Bingoplus: 8,
  Jagat: 7, Moveit: 6, Joyride: 5, Shopee: 7, Lazada: 8,
  Shein: 5, Gcash: 10, Maya: 8, Grinder: 4, Viber: 7,
  Netflix: 5, Okbet: 3, "8aceotp": 3, Sg8Casino: 7,
  Mosloan: 5, Tala: 5, fb5emotion: 6, ArenaPlus: 5, Playtime: 5
};

let balances = {};
let availability = {};
Object.keys(services).forEach((s) => (availability[s] = 200));

// ===== MAIN MENU =====
const mainMenuKeyboard = {
  reply_markup: {
    keyboard: [
      ["🛒 Buy OTP", "💰 Balance"],
      ["📊 Rates", "📡 Availability"],
      ["➕ Top Up", "❓ Help"]
    ],
    resize_keyboard: true
  }
};

// ===== AVAILABILITY TABLE =====
const renderAvailabilityTable = () => {
  let text = `📡 <b>Service Availability</b>\n\n<pre>`;
  for (const s in availability) {
    const qty = availability[s];
    const status = qty > 0 ? "🟢" : "🔴";
    const name = s.padEnd(12, " ");
    text += `${status} ${name} ${qty}\n`;
  }
  text += `</pre>`;
  return text;
};

// ===== UTILITY: Ensure user balance is initialized =====
function ensureBalance(userId) {
  if (balances[userId] === undefined) {
    balances[userId] = 0;
  }
}

// ===== START =====
bot.onText(/\/start/, (msg) => {
  const userId = msg.from.id.toString();

  if (userId === process.env.ADMIN_ID) {
    balances[userId] = 999999;
  } else {
    ensureBalance(userId);
  }

  sendAndTrack(
    msg.chat.id,
    `✨ <b>OTP SERVICE PANEL</b>\n\nWelcome! Choose an option below:`,
    { parse_mode: "HTML", ...mainMenuKeyboard }
  );
});

// ===== CLEAR CHAT COMMAND =====
bot.onText(/\/clear/, async (msg) => {
  const chatId = msg.chat.id;

  if (!sentMessages[chatId] || sentMessages[chatId].length === 0) {
    return sendAndTrack(chatId, "🧹 Nothing to clear.");
  }

  // Delete all tracked bot messages
  for (const messageId of sentMessages[chatId]) {
    try {
      await bot.deleteMessage(chatId, messageId);
    } catch {
      // ignore errors such as message too old or already deleted
    }
  }
  sentMessages[chatId] = [];

  // Optionally delete the /clear command message itself
  try {
    await bot.deleteMessage(chatId, msg.message_id);
  } catch {}

  sendAndTrack(chatId, "🧹 Chat cleared (bot messages only).");
});

// ===== HANDLE KEYBOARD =====
bot.on("message", (msg) => {
  if (!msg.text) return;

  const text = msg.text;
  const userId = msg.from.id.toString();

  // Always ensure balance exists on any user message
  ensureBalance(userId);

  if (text === "🛒 Buy OTP") return bot.emit("callback_query", { data: "buy", message: msg, from: msg.from, id: "manual" });
  if (text === "💰 Balance") return bot.emit("callback_query", { data: "balance", message: msg, from: msg.from, id: "manual" });
  if (text === "📊 Rates") return bot.emit("callback_query", { data: "rates", message: msg, from: msg.from, id: "manual" });
  if (text === "📡 Availability") return bot.emit("callback_query", { data: "availability", message: msg, from: msg.from, id: "manual" });
  if (text === "➕ Top Up") return bot.emit("callback_query", { data: "topup", message: msg, from: msg.from, id: "manual" });
  if (text === "❓ Help") return bot.emit("callback_query", { data: "help", message: msg, from: msg.from, id: "manual" });
});

// ===== QUEUE PROCESS FUNCTION =====
async function processQueue() {
  if (currentProcess || otpQueue.length === 0) return;

  const next = otpQueue.shift();
  currentProcess = next;

  const { userId, chatId, service, price } = next;

  try {
    const res = await axios.get(
      `${process.env.OTP_API_URL}/buy/activation/philippines/any/${service}`,
      { headers: { Authorization: `Bearer ${process.env.OTP_API_KEY}` } }
    );

    // Deduct price, ensure balance initialized just in case
    ensureBalance(userId);
    balances[userId] -= price;

    sendAndTrack(
      chatId,
      `✅ <b>OTP REQUEST STARTED</b>

📦 <b>Service:</b> ${service}
📱 <b>Number:</b>
<code>${res.data.phone}</code>

💰 <b>Balance:</b> ₱${balances[userId]}`,
      { parse_mode: "HTML" }
    );

    let attempts = 0;

    const checkSMS = setInterval(async () => {
      attempts++;

      if (attempts > 24) {
        clearInterval(checkSMS);
        sendAndTrack(chatId, "❌ OTP Timeout. Try again.");
        currentProcess = null;
        processQueue();
        return;
      }

      try {
        const check = await axios.get(
          `${process.env.OTP_API_URL}/check/${res.data.id}`,
          { headers: { Authorization: `Bearer ${process.env.OTP_API_KEY}` } }
        );

        if (check.data.sms && check.data.sms.length > 0) {
          sendAndTrack(
            chatId,
            `🔐 <b>OTP RECEIVED</b>

<code>${check.data.sms[0].code}</code>`,
            { parse_mode: "HTML" }
          );

          clearInterval(checkSMS);
          currentProcess = null;
          processQueue();
        }
      } catch (err) {
        console.log("CHECK ERROR:", err.message);
      }
    }, 5000);

  } catch (err) {
    console.error("OTP request error:", err.response?.data || err.message);
    sendAndTrack(chatId, "❌ OTP request failed.");
    currentProcess = null;
    processQueue();
  }
}

// ===== CALLBACK HANDLER =====
bot.on("callback_query", async (query) => {
  const msg = query.message;
  const userId = query.from.id.toString();
  const data = query.data;

  // Always ensure balance on callback queries too
  ensureBalance(userId);

  // ===== BUY MENU =====
  if (data === "buy") {
    const buttons = [];
    const keys = Object.keys(services).sort();

    for (let i = 0; i < keys.length; i += 2) {
      buttons.push([
        { text: `📦 ${keys[i]}`, callback_data: `buy_${keys[i]}` },
        keys[i + 1]
          ? { text: `📦 ${keys[i + 1]}`, callback_data: `buy_${keys[i + 1]}` }
          : null
      ].filter(Boolean));
    }

    return sendAndTrack(
      msg.chat.id,
      `🛒 <b>Select Service</b>\n\nChoose the platform you want OTP from:`,
      {
        parse_mode: "HTML",
        reply_markup: { inline_keyboard: buttons }
      }
    );
  }

  // ===== BUY OTP (QUEUE VERSION) =====
  if (data.startsWith("buy_")) {
    const service = data.replace("buy_", "");
    const price = services[service];

    if (balances[userId] < price)
      return sendAndTrack(msg.chat.id, "❌ Not enough balance.");

    otpQueue.push({
      userId,
      chatId: msg.chat.id,
      service,
      price
    });

    const position = otpQueue.length;

    sendAndTrack(
      msg.chat.id,
      `⏳ <b>Added to Queue</b>

📦 Service: ${service}
📍 Position: ${position}

Please wait for your turn...`,
      { parse_mode: "HTML" }
    );

    processQueue();
  }

  // ===== BALANCE =====
  if (data === "balance") {
    const userBalance = balances[userId] ?? 0;
    sendAndTrack(msg.chat.id, `💰 <b>Your Balance:</b> ₱${userBalance}`, { parse_mode: "HTML" });
  }

  // ===== TOPUP =====
  if (data === "topup") {
    pendingTopUps[userId] = { chatId: msg.chat.id, approved: false, screenshot: null };

    sendAndTrack(
      msg.chat.id,
      `💳 <b>Top-Up Details</b>

GCash: <code>09625699439</code>
Maya: <code>09625699439</code>

📸 Send screenshot after payment (optional).`,
      { parse_mode: "HTML" }
    );

    // Notify admin dynamically
    sendAndTrack(
      process.env.ADMIN_ID,
      `📥 <b>Top-Up Request Pending</b>\nUser: ${userId}`,
      { parse_mode: "HTML" }
    );
  }

  // ===== RATES =====
  if (data === "rates") {
    let text = `📊 <b>Service Rates</b>\n\n`;
    const keys = Object.keys(services).sort();
    for (let s of keys) text += `• ${s} — ₱${services[s]}\n`;
    sendAndTrack(msg.chat.id, text, { parse_mode: "HTML" });
  }

  // ===== AVAILABILITY =====
  if (data === "availability") {
    sendAndTrack(msg.chat.id, renderAvailabilityTable(), { parse_mode: "HTML" });
  }

  // ===== HELP =====
  if (data === "help")
    sendAndTrack(msg.chat.id, `❓ <b>Help</b>\n\nContact admin: @kiaramauir`, { parse_mode: "HTML" });

  bot.answerCallbackQuery(query.id);
});

// ===== PHOTO HANDLER =====
bot.on("photo", (msg) => {
  const userId = msg.from.id.toString();
  if (!pendingTopUps[userId]) return;

  const photo = msg.photo[msg.photo.length - 1].file_id;
  pendingTopUps[userId].screenshot = photo;

  sendAndTrack(msg.chat.id, "⏳ Waiting for admin approval...");

  sendPhotoAndTrack(process.env.ADMIN_ID, photo, {
    caption: `📥 Top-Up Request\nUser: ${userId}`,
    reply_markup: {
      inline_keyboard: [
        [
          { text: "✅ Approve", callback_data: `approve_${userId}` },
          { text: "❌ Reject", callback_data: `reject_${userId}` }
        ]
      ]
    }
  });
});

// ===== ADMIN APPROVE/REJECT =====
bot.on("callback_query", (query) => {
  const msg = query.message;
  const data = query.data;

  if (!data.startsWith("approve_") && !data.startsWith("reject_")) return;

  const userId = data.split("_")[1];
  if (msg.from.id.toString() !== process.env.ADMIN_ID) return;

  if (!pendingTopUps[userId]) return;

  if (data.startsWith("approve_")) {
    bot.sendMessage(process.env.ADMIN_ID, `💰 Send amount to add for user ${userId}:`, { reply_markup: { force_reply: true } });

    bot.once("message", (replyMsg) => {
      const amount = parseFloat(replyMsg.text);
      if (isNaN(amount) || amount <= 0) {
        return bot.sendMessage(process.env.ADMIN_ID, "❌ Invalid amount.");
      }
      ensureBalance(userId);
      balances[userId] += amount;
      pendingTopUps[userId].approved = true;

      sendAndTrack(userId, `✅ Your top-up of ₱${amount} has been approved!`);
      delete pendingTopUps[userId];
    });
  } else if (data.startsWith("reject_")) {
    sendAndTrack(userId, "❌ Your top-up request has been rejected.");
    delete pendingTopUps[userId];
  }

  bot.answerCallbackQuery(query.id);
});
