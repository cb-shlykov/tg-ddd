// api/bot.js
// ---------------------------------------------------------------
//  Telegram‑бот, Vercel Serverless Function (Node 18)
// ---------------------------------------------------------------
import { Telegraf } from "telegraf";
import getRawBody from "raw-body";

// ----- импорт из config.js ------------------------------------------------
import { BOT_TOKEN, ADMIN_ID, schedule, dayInfo } from "../config.js";

if (!BOT_TOKEN) throw new Error("BOT_TOKEN is missing");
const bot = new Telegraf(BOT_TOKEN);

/* ------------------------------------------------------------------
   Маппинг названий дней
   ------------------------------------------------------------------ */
const EN_RU_DAYS = {
  Monday:    "Пн",
  Tuesday:   "Вт",
  Wednesday: "Ср",
  Thursday:  "Чт",
  Friday:    "Пт",
  Saturday:  "Сб"
};

const RU_EN_DAYS = {
  Пн: "Monday",
  Вт: "Tuesday",
  Ср: "Wednesday",
  Чт: "Thursday",
  Пт: "Friday",
  Сб: "Saturday"
};

/* ------------------------------------------------------------------
   Хранилище (для рассылки и для удаления прошлых сообщений)
   ------------------------------------------------------------------ */
let knownUsers = new Set();               // пользователи, запустившие /start
const lastBotMessage = new Map();          // chatId → message_id

/* ------------------------------------------------------------------
   Форматтеры (schedule & dayInfo)
   ------------------------------------------------------------------ */
function formatDaySchedule(ruDay) {
  const enDay = RU_EN_DAYS[ruDay];
  if (!enDay) return `❓ Неизвестный день «${ruDay}».`;

  const rows = schedule
    .filter(r => r[enDay])
    .map(r => `${r.time} — ${r[enDay]}`);

  return rows.length
    ? `📅 *${ruDay}*:\n` + rows.join("\n")
    : `📅 *${ruDay}* — занятий нет.`;
}
function formatWeekSchedule() {
  const days = ["Пн", "Вт", "Ср", "Чт", "Пт"];
  return days.map(formatDaySchedule).join("\n\n");
}
function formatPickupInfo(ruDay) {
  const info = dayInfo.find(i => i.day === ruDay);
  if (!info) return `❓ Нет данных для дня ${ruDay}.`;

  const karate = info.karate === false ? "❌ нет" : `🕒 ${info.karate}`;
  return (
    `📌 *${ruDay}*:\n` +
    `⏰ Конец уроков: ${info.endOfLessons}\n` +
    `👤 Кто заберёт: ${info.pickup}\n` +
    `🥋 Карате: ${karate}`
  );
}
function formatWeekPickup() {
  return dayInfo.map(i => formatPickupInfo(i.day)).join("\n\n");
}

/* ------------------------------------------------------------------
   Инлайн‑клавиатуры
   ------------------------------------------------------------------ */
function mainMenuKeyboard(isAdmin) {
  const btns = [
    [{ text: "📅 Расписание на неделю",   callback_data: "schedule_week" }],
    [{ text: "📅 Расписание на день",     callback_data: "schedule_day" }],
    [{ text: "🗓️ График на неделю",      callback_data: "pickup_week" }],
    [{ text: "🗓️ График на день",        callback_data: "pickup_day" }]
  ];
  if (isAdmin) {
    btns.push([{ text: "🔔 Уведомить об обновлении", callback_data: "admin_notify" }]);
  }
  return { inline_keyboard: btns };
}
function daysKeyboard(prefix) {
  const dayBtns = ["Пн", "Вт", "Ср", "Чт", "Пт"].map(d => ({
    text: d,
    callback_data: `${prefix}_${d}`
  }));
  return {
    inline_keyboard: [
      dayBtns.slice(0, 3),
      dayBtns.slice(3, 5).concat([{ text: "↩️ Назад", callback_data: "back_main" }])
    ]
  };
}

/* ------------------------------------------------------------------
   Логирование всех входящих обновлений (отладка)
   ------------------------------------------------------------------ */
bot.use((ctx, next) => {
  console.log("🟢 Update type:", ctx.updateType);
  console.log("🔎 Payload:", JSON.stringify(ctx.update, null, 2));
  return next();
});

/* ------------------------------------------------------------------
   Глобальная обработка ошибок (логируем, но не падаем дальше)
   ------------------------------------------------------------------ */
bot.catch((err, ctx) => {
  console.error("❗ Unhandled bot error:", err);
});

/* ------------------------------------------------------------------
   Утилиты
   ------------------------------------------------------------------ */
// 1️⃣ Экранирование markdown‑v2
function escapeMarkdownV2(text) {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}

// 2️⃣ Быстрый answerCallbackQuery, игнорируем «query is too old»
async function safeAnswerCbQuery(ctx, txt) {
  try {
    await ctx.answerCbQuery(txt);
  } catch (e) {
    console.warn("⚠️ answerCbQuery failed:", e.description || e.message);
  }
}

// 3️⃣ sendAndReplace – после отправки нового сообщения удаляем предыдущее
async function sendAndReplace(ctx, sendPromise) {
  const chatId = ctx.chat?.id;
  const message = await sendPromise; // Message объект от Telegram
  if (chatId) {
    const prevId = lastBotMessage.get(chatId);
    if (prevId && prevId !== message.message_id) {
      ctx.telegram.deleteMessage(chatId, prevId).catch(() => {}); // игнорируем ошибки
    }
    lastBotMessage.set(chatId, message.message_id);
  }
  return message;
}

// 4️⃣ safeReply – обёртка над ctx.reply, автоматически удаляет предыдущее
async function safeReply(ctx, text, opts = {}) {
  const safeText = typeof text === "string" ? escapeMarkdownV2(text) : text;
  try {
    const promise = ctx.reply(safeText, { parse_mode: "MarkdownV2", ...opts });
    return await sendAndReplace(ctx, promise);
  } catch (e) {
    console.warn("⚠️ safeReply error:", e.description || e.message);
  }
}

/* ------------------------------------------------------------------
   /start
   ------------------------------------------------------------------ */
bot.start(async ctx => {
  knownUsers.add(ctx.from.id);
  await safeReply(
    ctx,
    `👋 Привет, ${ctx.from.first_name}!\nВыбери действие, нажимая кнопки ниже.`,
    { reply_markup: mainMenuKeyboard(ctx.from.id === ADMIN_ID) }
  );
});

/* ------------------------------------------------------------------
   Главное меню – расписание
   ------------------------------------------------------------------ */
bot.action("schedule_week", async ctx => {
  await safeAnswerCbQuery(ctx);
  await safeReply(ctx, formatWeekSchedule(), {
    reply_markup: {
      inline_keyboard: [[{ text: "↩️ Назад", callback_data: "back_main" }]]
    }
  });
});

bot.action("schedule_day", async ctx => {
  await safeAnswerCbQuery(ctx);
  await safeReply(ctx, "Выбери день недели:", {
    reply_markup: daysKeyboard("schedule")
  });
});

/* ------------------------------------------------------------------
   Главное меню – график (pickup)
   ------------------------------------------------------------------ */
bot.action("pickup_week", async ctx => {
  await safeAnswerCbQuery(ctx);
  await safeReply(ctx, formatWeekPickup(), {
    reply_markup: {
      inline_keyboard: [[{ text: "↩️ Назад", callback_data: "back_main" }]]
    }
  });
});

bot.action("pickup_day", async ctx => {
  await safeAnswerCbQuery(ctx);
  await safeReply(ctx, "Выбери день недели:", {
    reply_markup: daysKeyboard("pickup")
  });
});

/* ------------------------------------------------------------------
   Выбор отдельного дня расписания
   ------------------------------------------------------------------ */
bot.action(/^schedule_(\p{L}{2})$/u, async ctx => {
  const ruDay = ctx.match[1];
  await safeAnswerCbQuery(ctx);
  await safeReply(ctx, formatDaySchedule(ruDay), {
    reply_markup: {
      inline_keyboard: [[{ text: "↩️ Назад", callback_data: "back_main" }]]
    }
  });
});

/* ------------------------------------------------------------------
   Выбор отдельного дня графика
   ------------------------------------------------------------------ */
bot.action(/^pickup_(\p{L}{2})$/u, async ctx => {
  const ruDay = ctx.match[1];
  await safeAnswerCbQuery(ctx);
  await safeReply(ctx, formatPickupInfo(ruDay), {
    reply_markup: {
      inline_keyboard: [[{ text: "↩️ Назад", callback_data: "back_main" }]]
    }
  });
});

/* ------------------------------------------------------------------
   Возврат в главное меню (редактируем уже‑отправленное сообщение)
   ------------------------------------------------------------------ */
bot.action("back_main", async ctx => {
  await safeAnswerCbQuery(ctx);
  await ctx.editMessageText("Главное меню:", {
    reply_markup: mainMenuKeyboard(ctx.from.id === ADMIN_ID)
  });
});

/* ------------------------------------------------------------------
   Уведомление админа
   ------------------------------------------------------------------ */
bot.action("admin_notify", async ctx => {
  if (ctx.from.id !== ADMIN_ID) {
    await ctx.answerCbQuery("Эта кнопка только для администратора", { show_alert: true });
    return;
  }

  await safeAnswerCbQuery(ctx);
  const text = "🔔 *Расписание обновлено!* Проверьте актуальные данные в боте.";
  const promises = [...knownUsers].map(uid =>
    ctx.telegram.sendMessage(uid, text, { parse_mode: "MarkdownV2" })
  );
  const results = await Promise.allSettled(promises);
  const ok = results.filter(r => r.status === "fulfilled").length;
  const fail = results.length - ok;
  await ctx.reply(`✅ Оповещение отправлено ${ok} пользователям, не удалось ${fail}.`);
});

/* ------------------------------------------------------------------
   Любой произвольный текст (fallback)
   ------------------------------------------------------------------ */
bot.on("text", async ctx => {
  await safeAnswerCbQuery(ctx);
  await safeReply(ctx, "❓ Выберите действие, используя кнопки ниже.", {
    reply_markup: mainMenuKeyboard(ctx.from.id === ADMIN_ID)
  });
});

/* ------------------------------------------------------------------
   VERCEL‑handler (Webhook entry‑point)
   ------------------------------------------------------------------ */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).send("Telegram bot is alive 👋");
  }

  try {
    const raw = await getRawBody(req, {
      length: req.headers["content-length"],
      limit: "1mb",
      encoding: true
    });
    const update = JSON.parse(raw);
    await bot.handleUpdate(update);
    res.status(200).send("ok");
  } catch (err) {
    console.error("❗ Bot error (handler):", err);
    // отвечаем 200, чтобы Telegram не повторял запрос бесконечно
    res.status(200).send("ok");
  }
}

/* ------------------------------------------------------------------
   Отключаем автопарсер Vercel – нужен raw‑body
   ------------------------------------------------------------------ */
export const config = {
  api: {
    bodyParser: false
  }
};
