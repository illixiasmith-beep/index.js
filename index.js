require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

// Menu Keyboard
const menuKeyboard = {
  reply_markup: {
    inline_keyboard: [
      [{ text: "🛒 Buy OTP", callback_data: "buy_otp" }],
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

// Start Command
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, "Welcome! What would you like to do?", menuKeyboard);
});

// Handle Button Clicks
bot.on("callback_query", async (query) => {
  const msg = query.message;
  const data = query.data;

  switch (data) {
    case "buy_otp":
      bot.sendMessage(msg.chat.id, "📲 OTP purchasing is coming soon.");
      break;

    case "balance":
      bot.sendMessage(msg.chat.id, "💰 Your balance is: ₱0.00");
      break;

    case "topup":
      bot.sendMessage(
        msg.chat.id,
        `💳 *Top-Up Instructions:*\n\n` +
        `GCash: 09625699439 (Non-Verified)\n` +
        `Maya: 09625699439\n\n` +
        `After payment, please send a screenshot here.`,
        { parse_mode: "Markdown" }
      );
      break;

    case "rates":
      bot.sendMessage(msg.chat.id, "📊 Rates:\n\nSample OTP = ₱5");
      break;

    case "availability":
      bot.sendMessage(msg.chat.id, "📡 Checking availability...\nAll services available ✅");
      break;

    case "help":
      bot.sendMessage(
        msg.chat.id,
        "❓ Help:\n\nUse the menu buttons to navigate.\nFor issues, contact admin."
      );
      break;
  }

  bot.answerCallbackQuery(query.id);
});

// Handle Screenshot Upload
bot.on("photo", async (msg) => {
  const userId = msg.from.id;

  // Get highest quality photo
  const photo = msg.photo[msg.photo.length - 1].file_id;

  // Notify user
  bot.sendMessage(msg.chat.id, "✅ Screenshot received. Waiting for admin confirmation.");

  // Forward to admin
  bot.sendPhoto(process.env.ADMIN_ID, photo, {
    caption: `💰 New Top-Up Proof\n\nUser ID: ${userId}\nUsername: @${msg.from.username || "N/A"}`
  });
});
