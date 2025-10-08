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
   DEMO DATA (schedule & dayInfo)
   ------------------------------------------------------------------ */
const schedule = [
  {
    time: "08:00-08:40",
    Monday:    "Разговоры о важном",
    Tuesday:   "Литература",
    Wednesday: "Физ-ра",
    Thursday:  "Русский язык",
    Friday:    "Окруж. мир",
    Saturday:  "Окруж. мир"
  },
  {
    time: "08:50-09:30",
    Monday:    "Литература",
    Tuesday:   "Русский язык",
    Wednesday: "Литература",
    Thursday:  "Математика",
    Friday:    "Математика",
    Saturday:  "Математика"
  },
  {
    time: "09:45-10:25",
    Monday:    "Музыка",
    Tuesday:   "Ритмика",
    Wednesday: "Окруж. мир",
    Thursday:  "Ритмика",
    Friday:    "Физ-ра",
    Saturday:  "Физ-ра"
  },
  {
    time: "10:45-11:25",
    Monday:    "Ритмика",
    Tuesday:   "Математика",
    Wednesday: "Русский язык",
    Thursday:  "Труд",
    Friday:    null,
    Saturday:  null
  },
  {
    time: "11:45-12:25",
    Monday:    "Русский язык",
    Tuesday:   null,
    Wednesday: null,
    Thursday:  null,
    Friday:    null,
    Saturday:  null
  }
];

const dayInfo = [
  { day: "Пн", endOfLessons: "11:40", pickup: "Бабушка", karate: false },
  { day: "Вт", endOfLessons: "11:40", pickup: "Бабушка", karate: "16:30" },
  { day: "Ср", endOfLessons: "11:40", pickup: "Продленка", karate: false },
  { day: "Чт", endOfLessons: "11:40", pickup: "Бабушка", karate: "16:30" },
  { day: "Пт", endOfLessons: "11:40", pickup: "Продленка", karate: false }
];

/* ------------------------------------------------------------------
   DAY MAPPINGS
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
   In‑memory storage
   ------------------------------------------------------------------ */
// Пользователи, которые хотя бы раз нажали /start – нужны для рассылки.
let knownUsers = new Set();

// Последнее сообщение бота в каждом чате (для удаления)
const lastBotMessage = new Map();   // chatId → message_id

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
   Inline keyboards
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
   Логирование всех входящих обновлений
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
// 1️⃣ Экранирование markdown‑v2
function escapeMarkdownV2(text) {
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}

// 2️⃣ Безопасный answerCallbackQuery (не падаем, если запрос уже «старый»)
async function safeAnswerCbQuery(ctx, txt) {
  try {
    await ctx.answerCbQuery(txt);
  } catch (e) {
    console.warn("⚠️ answerCbQuery failed:", e.description || e.message);
  }
}

// 3️⃣ sendAndReplace – отправляем сообщение, удаляем предыдущее
async function sendAndReplace(ctx, sendPromise) {
  const chatId = ctx.chat?.id;
  const message = await sendPromise;          // Message объект
  if (chatId) {
    const prevId = lastBotMessage.get(chatId);
    if (prevId && prevId !== message.message_id) {
      // пытаемся удалить старое сообщение, ошибки игнорируем
      ctx.telegram.deleteMessage(chatId, prevId).catch(() => {});
    }
    lastBotMessage.set(chatId, message.message_id);
  }
  return message;
}

// 4️⃣ safeReply – обёртка над ctx.reply / ctx.replyWithMarkdownV2
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
bot.start(ctx => {
  knownUsers.add(ctx.from.id);
  ctx.reply(
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
  await ctx.reply("Выбери день недели:", {
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
  await ctx.reply("Выбери день недели:", {
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
   Возврат в главное меню (здесь удобнее **редактировать** предыдущее сообщение)
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
    // отвечаем 200, иначе Telegram будет бесконечно повторять запрос
    res.status(200).send("ok");
  }
}

/* ------------------------------------------------------------------
   Отключаем автоматический парсер Vercel (нужен raw‑body)
   ------------------------------------------------------------------ */
export const config = {
  api: {
    bodyParser: false
  }
};
