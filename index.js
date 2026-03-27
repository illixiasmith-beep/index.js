require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// ===== TELEGRAM MENU BUTTON (near input field) =====
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

// ===== CLEAN KEYBOARD MENU =====
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

// ===== CLEAN AVAILABILITY TABLE =====
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

// ===== START =====
bot.onText(/\/start/, (msg) => {
  const userId = msg.from.id.toString();

  if (userId === process.env.ADMIN_ID) balances[userId] = 100;
  if (!balances[userId]) balances[userId] = 0;

  bot.sendMessage(
    msg.chat.id,
    `✨ <b>OTP SERVICE PANEL</b>\n\nWelcome! Choose an option below:`,
    { parse_mode: "HTML", ...mainMenuKeyboard }
  );
});

// ===== HANDLE KEYBOARD TEXT =====
bot.on("message", (msg) => {
  if (!msg.text) return;

  const text = msg.text;

  if (text === "🛒 Buy OTP") return bot.emit("callback_query", { data: "buy", message: msg, from: msg.from, id: "manual" });
  if (text === "💰 Balance") return bot.emit("callback_query", { data: "balance", message: msg, from: msg.from, id: "manual" });
  if (text === "📊 Rates") return bot.emit("callback_query", { data: "rates", message: msg, from: msg.from, id: "manual" });
  if (text === "📡 Availability") return bot.emit("callback_query", { data: "availability", message: msg, from: msg.from, id: "manual" });
  if (text === "➕ Top Up") return bot.emit("callback_query", { data: "topup", message: msg, from: msg.from, id: "manual" });
  if (text === "❓ Help") return bot.emit("callback_query", { data: "help", message: msg, from: msg.from, id: "manual" });
});

// ===== CALLBACK HANDLER =====
bot.on("callback_query", async (query) => {
  const msg = query.message;
  const userId = query.from.id.toString();
  const data = query.data;

  // ===== BUY MENU (2 COLUMN CLEAN) =====
  if (data === "buy") {
    const buttons = [];
    const keys = Object.keys(services);

    for (let i = 0; i < keys.length; i += 2) {
      buttons.push([
        { text: `${keys[i]} (₱${services[keys[i]]})`, callback_data: `buy_${keys[i]}` },
        keys[i + 1]
          ? { text: `${keys[i + 1]} (₱${services[keys[i + 1]]})`, callback_data: `buy_${keys[i + 1]}` }
          : null
      ].filter(Boolean));
    }

    return bot.sendMessage(msg.chat.id, "🛒 <b>Select Service</b>", {
      parse_mode: "HTML",
      reply_markup: { inline_keyboard: buttons }
    });
  }

  // ===== BUY OTP =====
  if (data.startsWith("buy_")) {
    const service = data.replace("buy_", "");
    const price = services[service];

    if (balances[userId] < price)
      return bot.sendMessage(msg.chat.id, "❌ Not enough balance.");

    try {
      const res = await axios.get(
        `${process.env.OTP_API_URL}/buy/activation/philippines/any/${service}`,
        { headers: { Authorization: `Bearer ${process.env.OTP_API_KEY}` } }
      );

      balances[userId] -= price;

      bot.sendMessage(
        msg.chat.id,
        `✅ <b>OTP Requested</b>\n\n📦 Service: ${service}\n📱 Number: <code>${res.data.phone}</code>\n💰 Balance: ₱${balances[userId]}`,
        { parse_mode: "HTML" }
      );

      const checkSMS = setInterval(async () => {
        const check = await axios.get(`${process.env.OTP_API_URL}/check/${res.data.id}`, {
          headers: { Authorization: `Bearer ${process.env.OTP_API_KEY}` }
        });

        if (check.data.sms && check.data.sms.length > 0) {
          bot.sendMessage(
            msg.chat.id,
            `✅ <b>OTP Code:</b> <code>${check.data.sms[0].code}</code>`,
            { parse_mode: "HTML" }
          );
          clearInterval(checkSMS);
        }
      }, 5000);

    } catch (err) {
      bot.sendMessage(msg.chat.id, "❌ OTP request failed.");
    }
  }

  // ===== BALANCE =====
  if (data === "balance")
    bot.sendMessage(msg.chat.id, `💰 <b>Your Balance:</b> ₱${balances[userId]}`, { parse_mode: "HTML" });

  // ===== TOPUP =====
  if (data === "topup") {
    bot.sendMessage(
      msg.chat.id,
      `💳 <b>Top-Up Details</b>\n\nGCash: <code>09625699439</code>\nMaya: <code>09625699439</code>\n\n📸 Send screenshot after payment.`,
      { parse_mode: "HTML" }
    );
  }

  // ===== RATES =====
  if (data === "rates") {
    let text = `📊 <b>Service Rates</b>\n\n`;

    for (let s in services) text += `• ${s} — ₱${services[s]}\n`;

    bot.sendMessage(msg.chat.id, text, { parse_mode: "HTML" });
  }

  // ===== AVAILABILITY =====
  if (data === "availability") {
    bot.sendMessage(msg.chat.id, renderAvailabilityTable(), {
      parse_mode: "HTML"
    });
  }

  // ===== HELP =====
  if (data === "help")
    bot.sendMessage(msg.chat.id, `❓ <b>Help</b>\n\nContact admin: @kiaramauir`, { parse_mode: "HTML" });

  bot.answerCallbackQuery(query.id);
});

// ===== PHOTO (TOPUP PROOF) =====
bot.on("photo", (msg) => {
  const userId = msg.from.id.toString();
  const photo = msg.photo[msg.photo.length - 1].file_id;

  bot.sendMessage(msg.chat.id, "⏳ Waiting for admin approval...");

  bot.sendPhoto(process.env.ADMIN_ID, photo, {
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

// ===== ADMIN UPDATE =====
bot.onText(/\/update_avail (.+) (\d+)/, (msg, match) => {
  const userId = msg.from.id.toString();
  if (userId !== process.env.ADMIN_ID) return;

  const service = match[1];
  const qty = parseInt(match[2]);
  availability[service] = qty;

  bot.sendMessage(msg.chat.id, `✅ Updated ${service} → ${qty}`);
});
