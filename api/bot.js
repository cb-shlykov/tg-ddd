// ──────────────────────────────────────────────────────────────────────
//  api/bot.js – Telegram‑бот, Vercel Serverless Function (Node 18)
// ──────────────────────────────────────────────────────────────────────
import { Telegraf } from "telegraf";
import getRawBody from "raw-body";

/* ------------------------------------------------------------------
   CONFIG
   ------------------------------------------------------------------ */
const BOT_TOKEN = "7964054515:AAHIU9aDGoFQkfDaplTkbVQ9_JlilcrBzYM";
const ADMIN_ID  = 111603368;               // ваш telegram‑user_id

if (!BOT_TOKEN) throw new Error("BOT_TOKEN is missing");
const bot = new Telegraf(BOT_TOKEN);

/* ------------------------------------------------------------------
   ДЕМОДАННЫЕ (обновлённые массивы)
   ------------------------------------------------------------------ */
const schedule = [
  {
    time: "08:00-08:40",
    Monday:    "Разговоры о важном",
    Tuesday:   "Литература",
    Wednesday: "Физ-ра",
    Thursday:  "Русский язык",
    Friday:    "Физ-рар"
  },
  {
    time: "09:90-09:40",
    Monday:    "Литература",
    Tuesday:   "Русский язык",
    Wednesday: "Литература",
    Thursday:  "Математика",
    Friday:    "Математика"
  },
  {
    time: "10:00-10:50",
    Monday:    "Музыка",
    Tuesday:   "Динамическая пауза",
    Wednesday: "Динам. пауза/Окруж. мир",
    Thursday:  "Динам. пауза/Ритмика",
    Friday:    "Окруж. мир"
  },
  {
    time: "11:00-11:40",
    Monday:    "Динам. пауза/Ритмика",
    Tuesday:   "Математика",
    Wednesday: "Русский язык",
    Thursday:  "Труд",
    Friday:    null
  },
  {
    time: "12:00-12:40",
    Monday:    "Русский язык",
    Tuesday:   null,
    Wednesday: null,
    Thursday:  null,
    Friday:    null
  }
];

const dayInfo = [
  { day: "Пн", endOfLessons: "11:40", pickup: "Бабушка", karate: false },
  { day: "Вт", endOfLessons: "11:40", pickup: "Бабушка", karate: false },
  { day: "Ср", endOfLessons: "11:40", pickup: "Продленка", karate: false },
  { day: "Чт", endOfLessons: "11:40", pickup: "Бабушка", karate: false },
  { day: "Пт", endOfLessons: "11:40", pickup: "Продленка", karate: false }
];

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
   Хранилище
   ------------------------------------------------------------------ */
// Список пользователей, которые хотя бы раз нажали /start (нужен для рассылки)
let knownUsers = new Set();

// Последнее сообщение бота в каждом чате (для удаления перед новым)
const lastBotMessage = new Map(); // chatId → message_id

/* ------------------------------------------------------------------
   Форматтеры
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
  if (isAdmin) btns.push([{ text: "🔔 Уведомить об обновлении", callback_data: "admin_notify" }]);
  return { inline_keyboard: btns };
}

/* Кнопки выбора дней – префикс = "schedule" или "pickup" */
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
   Логи всех входящих обновлений (для отладки)
   ------------------------------------------------------------------ */
bot.use((ctx, next) => {
  console.log("🟢 Update type:", ctx.updateType);
  console.log("🔎 Payload:", JSON.stringify(ctx.update, null, 2));
  return next();
});

/* ------------------------------------------------------------------
   Глобальная обработка ошибок (логируем, но не бросаем дальше)
   ------------------------------------------------------------------ */
bot.catch((err, ctx) => {
  console.error("❗ Unhandled bot error:", err);
});

/* ------------------------------------------------------------------
   Вспомогательные функции
   ------------------------------------------------------------------ */
// Экранирование символов, запрещённых в MarkdownV2
function escapeMarkdownV2(text) {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}

// Быстрый answerCallbackQuery без падения, если запрос уже «старый»
async function safeAnswerCbQuery(ctx, txt) {
  try {
    await ctx.answerCbQuery(txt);
  } catch (e) {
    console.warn("⚠️ answerCbQuery failed:", e.description || e.message);
  }
}

/* ------------------------------------------------------------------
   sendAndReplace – отправляем новое сообщение и удаляем предыдущее
   ------------------------------------------------------------------ */
async function sendAndReplace(ctx, sendPromise) {
  const chatId = ctx.chat?.id;
  const message = await sendPromise;          // объект Message от Telegram

  if (chatId) {
    const prevId = lastBotMessage.get(chatId);
    if (prevId && prevId !== message.message_id) {
      // удаляем предыдущее сообщение бота, игнорируем ошибки
      ctx.telegram.deleteMessage(chatId, prevId).catch(() => {});
    }
    lastBotMessage.set(chatId, message.message_id);
  }
  return message;
}

/* ------------------------------------------------------------------
   safeReply – обёртка над ctx.reply/ctx.replyWithMarkdownV2,
   автоматически удаляет предыдущее сообщение бота
   ------------------------------------------------------------------ */
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
  // используем safeReply, чтобы сообщение попало в lastBotMessage
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
  // тоже через safeReply, чтобы это сообщение стало «последним»
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
   Возврат в главное меню (редактируем то же сообщение)
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
    // Получаем «сырой» буфер тела запроса (без автопарсинга Vercel)
    const raw = await getRawBody(req, {
      length: req.headers["content-length"],
      limit: "1mb",
      encoding: true // получаем строку JSON
    });
    const update = JSON.parse(raw);
    await bot.handleUpdate(update);
    res.status(200).send("ok");
  } catch (err) {
    console.error("❗ Bot error (handler):", err);
    // отвечаем 200, иначе Telegram будет бесконечно пере‑отправлять запрос
    res.status(200).send("ok");
  }
}

/* ------------------------------------------------------------------
   Отключаем автоматический body‑parser Vercel (нужен raw‑body)
   ------------------------------------------------------------------ */
export const config = {
  api: {
    bodyParser: false
  }
};
