require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// ===== DATA =====
const services = {
  Foodpanda: 7,
  Grab: 5,
  Facebook: 5,
  Telegram: 18,
  Whatsapp: 3,
  Arionplay: 3,
  Ninogaming: 3,
  Casinoplus: 8,
  Bingoplus: 8,
  Jagat: 7,
  Moveit: 6,
  Joyride: 5,
  Shopee: 7,
  Lazada: 8,
  Shein: 5,
  Gcash: 10,
  Maya: 8,
  Grinder: 4,
  Viber: 7,
  Netflix: 5,
  Okbet: 3,
  "8aceotp": 3,
  Sg8Casino: 7,
  Mosloan: 5,
  Tala: 5,
  fb5emotion: 6,
  ArenaPlus: 5,
  Playtime: 5
};

// Initialize balances and availability
let balances = {};
let availability = {};
Object.keys(services).forEach((s) => (availability[s] = 200));

// ===== MENU =====
const mainMenu = {
  reply_markup: {
    inline_keyboard: [
      [{ text: "🛒 Buy OTP", callback_data: "buy" }],
      [{ text: "💰 Check Balance", callback_data: "balance" }],
      [{ text: "➕ Top-Up", callback_data: "topup" }],
      [
        { text: "📊 Rates", callback_data: "rates" },
        { text: "📡 Check Availability", callback_data: "availability" }
      ],
      [{ text: "❓ Help", callback_data: "help" }]
    ]
  }
};

// ===== HELPERS =====
const renderAvailabilityTable = () => {
  let table = '📡 *Current Availability:*\n\n';
  table += 'Service       | Qty\n';
  table += '-----------------\n';
  for (const s in availability) {
    table += `${s.padEnd(12)} | ${availability[s]}\n`;
  }
  return table;
};

// ===== START =====
bot.onText(/\/start/, (msg) => {
  const userId = msg.from.id.toString();

  if (userId === process.env.ADMIN_ID) balances[userId] = 100; // test balance
  if (!balances[userId]) balances[userId] = 0;

  // Only send the menu button, no spam text
  bot.sendMessage(msg.chat.id, "📌 Click the button below to open the menu:", mainMenu);
});

// ===== CALLBACK HANDLER =====
bot.on("callback_query", async (query) => {
  const msg = query.message;
  const userId = query.from.id.toString();
  const data = query.data;

  // ===== BUY MENU =====
  if (data === "buy") {
    const buttons = Object.keys(services).map((s) => [
      { text: `${s} (₱${services[s]})`, callback_data: `buy_${s}` }
    ]);
    bot.sendMessage(msg.chat.id, "Select Service:", { reply_markup: { inline_keyboard: buttons } });
  }

  // ===== BUY OTP =====
  if (data.startsWith("buy_")) {
    const service = data.replace("buy_", "");
    const price = services[service];

    if (balances[userId] < price) return bot.sendMessage(msg.chat.id, "❌ Not enough balance.");

    try {
      // Example: 5SIM integration
      const res = await axios.get(
        `${process.env.OTP_API_URL}/buy/activation/philippines/any/${service}`,
        { headers: { Authorization: `Bearer ${process.env.OTP_API_KEY}` } }
      );

      balances[userId] -= price;

      bot.sendMessage(
        msg.chat.id,
        `✅ OTP Requested for ${service}\n📱 Number: ${res.data.phone}\n💰 Balance: ₱${balances[userId]}`
      );

      // Poll for SMS
      const checkSMS = setInterval(async () => {
        const check = await axios.get(`${process.env.OTP_API_URL}/check/${res.data.id}`, {
          headers: { Authorization: `Bearer ${process.env.OTP_API_KEY}` }
        });
        if (check.data.sms && check.data.sms.length > 0) {
          bot.sendMessage(msg.chat.id, `✅ OTP Code: ${check.data.sms[0].code}`);
          clearInterval(checkSMS);
        }
      }, 5000);

    } catch (err) {
      bot.sendMessage(msg.chat.id, "❌ OTP request failed.");
    }
  }

  // ===== BALANCE =====
  if (data === "balance") bot.sendMessage(msg.chat.id, `💰 Balance: ₱${balances[userId]}`);

  // ===== TOP-UP =====
  if (data === "topup") {
    bot.sendMessage(
      msg.chat.id,
      `💳 Top-Up:\n\nGCash: 09625699439 (Non-Verified)\nMaya: 09625699439\n\nSend screenshot after payment.`
    );
  }

  // ===== RATES =====
  if (data === "rates") {
    let text = "📊 Rates:\n\n";
    for (let s in services) text += `${s} - ₱${services[s]}\n`;
    text += "\n🎰 Other casinos: ₱3-₱5";
    bot.sendMessage(msg.chat.id, text);
  }

  // ===== AVAILABILITY =====
  if (data === "availability") {
    bot.sendMessage(msg.chat.id, renderAvailabilityTable(), { parse_mode: "Markdown" });
  }

  // ===== HELP =====
  if (data === "help") bot.sendMessage(msg.chat.id, `Hello! Thanks for "Clicking Me"\nContact admin: @kiaramauir`);

  // ===== ADMIN APPROVE / REJECT =====
  if (data.startsWith("approve_") || data.startsWith("reject_")) {
    if (userId !== process.env.ADMIN_ID) return;

    const target = data.split("_")[1];
    if (data.startsWith("approve_")) {
      const amount = 50;
      balances[target] = (balances[target] || 0) + amount;
      bot.sendMessage(target, `✅ Top-Up Approved!\n💰 +₱${amount}`);
      bot.answerCallbackQuery(query.id, { text: "Approved" });
    } else {
      bot.sendMessage(target, "❌ Top-Up Rejected.");
      bot.answerCallbackQuery(query.id, { text: "Rejected" });
    }
  }

  bot.answerCallbackQuery(query.id);
});

// ===== RECEIVE SCREENSHOT =====
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

// ===== ADMIN UPDATE AVAILABILITY =====
bot.onText(/\/update_avail (.+) (\d+)/, (msg, match) => {
  const userId = msg.from.id.toString();
  if (userId !== process.env.ADMIN_ID) return;

  const service = match[1];
  const qty = parseInt(match[2]);
  availability[service] = qty;

  bot.sendMessage(msg.chat.id, `✅ Updated ${service} quantity to ${qty}`);
});
