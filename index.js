require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// ====== DATA ======
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

// ====== USER BALANCE STORAGE ======
let balances = {};
let pendingTopup = {};

// ====== MENU ======
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

// ====== START ======
bot.onText(/\/start/, (msg) => {
  const userId = msg.from.id;

  // Give admin ₱100
  if (userId.toString() === process.env.ADMIN_ID) {
    balances[userId] = 100;
  }

  if (!balances[userId]) balances[userId] = 0;

  bot.sendMessage(msg.chat.id, "Welcome! Choose an option:", mainMenu);
});

// ====== BUTTON HANDLER ======
bot.on("callback_query", async (query) => {
  const msg = query.message;
  const userId = query.from.id;
  const data = query.data;

  // ===== BUY OTP MENU =====
  if (data === "buy") {
    const serviceButtons = Object.keys(services).map((s) => [
      { text: `${s} (₱${services[s]})`, callback_data: `buy_${s}` }
    ]);

    bot.sendMessage(msg.chat.id, "Select Service:", {
      reply_markup: { inline_keyboard: serviceButtons }
    });
  }

  // ===== BUY SERVICE =====
  if (data.startsWith("buy_")) {
    const service = data.replace("buy_", "");
    const price = services[service];

    if (balances[userId] < price) {
      return bot.sendMessage(msg.chat.id, "❌ Not enough balance.");
    }

    balances[userId] -= price;

    bot.sendMessage(
      msg.chat.id,
      `✅ OTP for ${service} requested!\n💸 Deducted: ₱${price}\n💰 Remaining: ₱${balances[userId]}`
    );
  }

  // ===== BALANCE =====
  if (data === "balance") {
    bot.sendMessage(msg.chat.id, `💰 Balance: ₱${balances[userId]}`);
  }

  // ===== TOP UP =====
  if (data === "topup") {
    pendingTopup[userId] = true;

    bot.sendMessage(
      msg.chat.id,
      `💳 Top-Up:\n\nGCash: 09625699439 (Non-Verified)\nMaya: 09625699439\n\nSend screenshot after payment.`
    );
  }

  // ===== RATES =====
  if (data === "rates") {
    let text = "📊 Rates:\n\n";

    for (let s in services) {
      text += `${s} - ₱${services[s]}\n`;
    }

    text += "\n🎰 Other casinos: ₱3-₱5";

    bot.sendMessage(msg.chat.id, text);
  }

  // ===== AVAILABILITY =====
  if (data === "availability") {
    let text = "📡 Availability:\n\n";

    for (let s in services) {
      text += `${s} - 200\n`;
    }

    bot.sendMessage(msg.chat.id, text);
  }

  // ===== HELP =====
  if (data === "help") {
    bot.sendMessage(
      msg.chat.id,
      `Hello! Thanks for "Clicking Me" 😊\n\nContact admin: @kiaramauir\n\nAfter top-up, send screenshot to get balance.`
    );
  }

  bot.answerCallbackQuery(query.id);
});

// ===== HANDLE SCREENSHOT =====
bot.on("photo", (msg) => {
  const userId = msg.from.id;

  if (!pendingTopup[userId]) {
    return bot.sendMessage(msg.chat.id, "⚠️ Please click Top-Up first.");
  }

  const photo = msg.photo[msg.photo.length - 1].file_id;

  // Auto add balance (example ₱50)
  const amount = 50;

  balances[userId] += amount;
  pendingTopup[userId] = false;

  bot.sendMessage(
    msg.chat.id,
    `✅ Payment received!\n💰 Added ₱${amount}\nNew Balance: ₱${balances[userId]}`
  );

  // Send to admin
  bot.sendPhoto(process.env.ADMIN_ID, photo, {
    caption: `📥 New Top-Up\nUser: ${userId}\nAmount Added: ₱${amount}`
  });
});
