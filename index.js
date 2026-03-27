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

let balances = {};
let pendingTopups = {}; // store proof

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

// ===== START =====
bot.onText(/\/start/, (msg) => {
  const userId = msg.from.id;

  if (userId.toString() === process.env.ADMIN_ID) {
    balances[userId] = 100;
  }

  if (!balances[userId]) balances[userId] = 0;

  bot.sendMessage(msg.chat.id, "Welcome!", mainMenu);
});

// ===== BUTTON HANDLER =====
bot.on("callback_query", async (query) => {
  const msg = query.message;
  const userId = query.from.id;
  const data = query.data;

  // ===== BUY MENU =====
  if (data === "buy") {
    const buttons = Object.keys(services).map((s) => [
      { text: `${s} (₱${services[s]})`, callback_data: `buy_${s}` }
    ]);

    bot.sendMessage(msg.chat.id, "Select Service:", {
      reply_markup: { inline_keyboard: buttons }
    });
  }

  // ===== BUY OTP (API CALL) =====
  if (data.startsWith("buy_")) {
    const service = data.replace("buy_", "");
    const price = services[service];

    if (balances[userId] < price) {
      return bot.sendMessage(msg.chat.id, "❌ Not enough balance.");
    }

    try {
      const res = await axios.post(
        `${process.env.OTP_API_URL}/request`,
        {
          service: service
        },
        {
          headers: {
            Authorization: `Bearer ${process.env.OTP_API_KEY}`
          }
        }
      );

      balances[userId] -= price;

      bot.sendMessage(
        msg.chat.id,
        `✅ OTP Requested for ${service}\n📱 Number: ${res.data.number}\n💰 Balance: ₱${balances[userId]}`
      );

    } catch (err) {
      bot.sendMessage(msg.chat.id, "❌ OTP request failed.");
    }
  }

  // ===== BALANCE =====
  if (data === "balance") {
    bot.sendMessage(msg.chat.id, `💰 Balance: ₱${balances[userId]}`);
  }

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
    let text = "📡 Availability:\n\n";
    for (let s in services) text += `${s} - 200\n`;

    bot.sendMessage(msg.chat.id, text);
  }

  // ===== HELP =====
  if (data === "help") {
    bot.sendMessage(
      msg.chat.id,
      `Hello! Thanks for "Clicking Me"\nContact admin: @kiaramauir`
    );
  }

  // ===== ADMIN APPROVE =====
  if (data.startsWith("approve_")) {
    if (userId.toString() !== process.env.ADMIN_ID) return;

    const target = data.split("_")[1];
    const amount = 50;

    balances[target] = (balances[target] || 0) + amount;

    bot.sendMessage(target, `✅ Top-Up Approved!\n💰 +₱${amount}`);
    bot.answerCallbackQuery(query.id, { text: "Approved" });
  }

  // ===== ADMIN REJECT =====
  if (data.startsWith("reject_")) {
    if (userId.toString() !== process.env.ADMIN_ID) return;

    const target = data.split("_")[1];

    bot.sendMessage(target, "❌ Top-Up Rejected.");
    bot.answerCallbackQuery(query.id, { text: "Rejected" });
  }

  bot.answerCallbackQuery(query.id);
});

// ===== RECEIVE SCREENSHOT =====
bot.on("photo", (msg) => {
  const userId = msg.from.id;
  const photo = msg.photo[msg.photo.length - 1].file_id;

  bot.sendMessage(msg.chat.id, "⏳ Waiting for admin approval...");

  // Send to admin with buttons
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
