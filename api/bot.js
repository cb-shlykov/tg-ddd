// ──────────────────────────────────────────────────────────────────────
//  api/bot.js – Telegram‑бот, Vercel Serverless Function (Node 18)
// ──────────────────────────────────────────────────────────────────────
import { Telegraf } from "telegraf";
import getRawBody from "raw-body";

/* ------------------------------------------------------------------
   Конфигурация
   ------------------------------------------------------------------ */
const BOT_TOKEN = "7964054515:AAHIU9aDGoFQkfDaplTkbVQ9_JlilcrBzYM"; // ваш токен
const ADMIN_ID  = 111603368;                                      // ваш telegram‑user_id

if (!BOT_TOKEN) throw new Error("BOT_TOKEN is missing");
const bot = new Telegraf(BOT_TOKEN);

/* ------------------------------------------------------------------
   Демосети – расписание и информация о забирании/карате
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
   Маппинг дней
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
   Хранилище всех, кто когда‑либо стартовал (для рассылки)
   ------------------------------------------------------------------ */
let knownUsers = new Set();

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
  if (isAdmin) {
    btns.push([{ text: "🔔 Уведомить об обновлении", callback_data: "admin_notify" }]);
  }
  return { inline_keyboard: btns };
}

/* Клавиатура выбора дней – prefix = "schedule" | "pickup" */
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
   Логирование всех входящих обновлений (удобно для отладки)
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
   Вспомогательная функция: экранирование символов MarkdownV2
   ------------------------------------------------------------------ */
function escapeMarkdownV2(text) {
  // символы, которые надо экранировать в MarkdownV2
  return text.replace(/[_*[\]()~`>#+\-=|{}.!]/g, '\\$&');
}

/* ------------------------------------------------------------------
   Безопасный answerCallbackQuery (не падаем, если запрос уже старый)
   ------------------------------------------------------------------ */
async function safeAnswerCbQuery(ctx, txt) {
  try {
    await ctx.answerCbQuery(txt);
  } catch (e) {
    // 400 Bad Request – “query is too old” – просто игнорируем
    console.warn("⚠️ answerCbQuery failed:", e.description || e.message);
  }
}

/* ------------------------------------------------------------------
   Безопасный reply (escape markdown, отлавливаем 400‑й)
   ------------------------------------------------------------------ */
async function safeReply(ctx, text, opts = {}) {
  const safeText = typeof text === "string" ? escapeMarkdownV2(text) : text;
  try {
    await ctx.reply(safeText, { parse_mode: "MarkdownV2", ...opts });
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
   Возврат в главное меню
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
  await ctx.reply(
    "❓ Выберите действие, используя кнопки ниже.",
    { reply_markup: mainMenuKeyboard(ctx.from.id === ADMIN_ID) }
  );
});

/* ------------------------------------------------------------------
   VERCEL‑handler (Webhook entry‑point)
   ------------------------------------------------------------------ */
export default async function handler(req, res) {
  // Telegram посылает только POST‑запросы
  if (req.method !== "POST") {
    return res.status(200).send("Telegram bot is alive 👋");
  }

  try {
    // 1️⃣ Получаем «сырой» буфер тела запроса (без автопарсинга Vercel)
    const raw = await getRawBody(req, {
      length: req.headers["content-length"],
      limit: "1mb",
      encoding: true // получаем строку JSON
    });

    // 2️⃣ Преобразуем в объект Update
    const update = JSON.parse(raw);

    // 3️⃣ Обрабатываем запрос Telegraf‑ом
    await bot.handleUpdate(update);

    // 4️⃣ Возвращаем 200 OK – иначе Telegram будет повторять запрос
    res.status(200).send("ok");
  } catch (err) {
    console.error("❗ Bot error (handler):", err);
    // даже при ошибке отвечаем 200, чтобы Telegram не делал бесконечные повторения
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
