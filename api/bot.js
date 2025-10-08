// ──────────────────────────────────────────────────────────────────────
//  api/bot.js – Telegram‑бот, Vercel Serverless Function (Node 18)
// ──────────────────────────────────────────────────────────────────────
import { Telegraf } from "telegraf";
import getRawBody from "raw-body";

/* ======================  CONFIG  ====================== */
const BOT_TOKEN = "7964054515:AAHIU9aDGoFQkfDaplTkbVQ9_JlilcrBzYM";
const ADMIN_ID  = 111603368;               // ваш telegram‑user_id

if (!BOT_TOKEN) throw new Error("BOT_TOKEN is missing");
const bot = new Telegraf(BOT_TOKEN);

/* ======================  DATA  ====================== */
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

/* ======================  HELPERS  ====================== */
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

let knownUsers = new Set();               // для рассылки

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

/* -------------------  INLINE KEYBOARDS  ------------------- */
function mainMenuKeyboard(isAdmin) {
  const btns = [
    [{ text: "📅 Расписание на неделю", callback_data: "schedule_week" }],
    [{ text: "📅 Расписание на день",   callback_data: "schedule_day" }],
    [{ text: "🗓️ График на неделю",    callback_data: "pickup_week" }],
    [{ text: "🗓️ График на день",      callback_data: "pickup_day" }]
  ];
  if (isAdmin) btns.push([{ text: "🔔 Уведомить об обновлении", callback_data: "admin_notify" }]);
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

/* -------------------  LOGGING & DEBUG  ------------------- */
bot.use((ctx, next) => {
  console.log("🟢 Update type:", ctx.updateType);
  // Полный объект полностью виден в логах Vercel, удобно для отладки
  console.log("🔎 Update payload:", JSON.stringify(ctx.update, null, 2));
  return next();
});

/* -------------------  BOT COMMANDS  ------------------- */
bot.start(ctx => {
  knownUsers.add(ctx.from.id);
  ctx.reply(
    `👋 Привет, ${ctx.from.first_name}!\nВыбери действие, нажимая кнопки ниже.`,
    { reply_markup: mainMenuKeyboard(ctx.from.id === ADMIN_ID) }
  );
});

/* ---------- Главное меню ---------- */
bot.action("schedule_week", async ctx => {
  await ctx.answerCbQuery();          // ✅ подтверждаем запрос
  await ctx.replyWithMarkdownV2(formatWeekSchedule(), {
    reply_markup: { inline_keyboard: [[{ text: "↩️ Назад", callback_data: "back_main" }]] }
  });
});
bot.action("schedule_day", async ctx => {
  await ctx.answerCbQuery();
  await ctx.reply("Выбери день недели:", { reply_markup: daysKeyboard("schedule") });
});
bot.action("pickup_week", async ctx => {
  await ctx.answerCbQuery();
  await ctx.replyWithMarkdownV2(formatWeekPickup(), {
    reply_markup: { inline_keyboard: [[{ text: "↩️ Назад", callback_data: "back_main" }]] }
  });
});
bot.action("pickup_day", async ctx => {
  await ctx.answerCbQuery();
  await ctx.reply("Выбери день недели:", { reply_markup: daysKeyboard("pickup") });
});

/* ---------- Выбор отдельного дня ---------- */
bot.action(/^schedule_(\p{L}{2})$/u, async ctx => {
  const ruDay = ctx.match[1];
  await ctx.answerCbQuery();
  await ctx.replyWithMarkdownV2(formatDaySchedule(ruDay), {
    reply_markup: { inline_keyboard: [[{ text: "↩️ Назад", callback_data: "back_main" }]] }
  });
});
bot.action(/^pickup_(\p{L}{2})$/u, async ctx => {
  const ruDay = ctx.match[1];
  await ctx.answerCbQuery();
  await ctx.replyWithMarkdownV2(formatPickupInfo(ruDay), {
    reply_markup: { inline_keyboard: [[{ text: "↩️ Назад", callback_data: "back_main" }]] }
  });
});

/* ---------- Возврат в главное меню ---------- */
bot.action("back_main", async ctx => {
  await ctx.answerCbQuery();
  await ctx.editMessageText("Главное меню:", {
    reply_markup: mainMenuKeyboard(ctx.from.id === ADMIN_ID)
  });
});

/* ---------- Уведомление админа ---------- */
bot.action("admin_notify", async ctx => {
  if (ctx.from.id !== ADMIN_ID) {
    await ctx.answerCbQuery("Эта кнопка только для администратора", { show_alert: true });
    return;
  }

  await ctx.answerCbQuery(); // ✅ запрос обработан

  const text = "🔔 *Расписание обновлено!* Проверьте свежие данные в боте.";
  const promises = [...knownUsers].map(uid =>
    ctx.telegram.sendMessage(uid, text, { parse_mode: "MarkdownV2" })
  );

  const results = await Promise.allSettled(promises);
  const ok = results.filter(r => r.status === "fulfilled").length;
  const fail = results.length - ok;

  await ctx.reply(`✅ Оповещение отправлено ${ok} пользователям, не удалось ${fail}.`);
});

/* ---------- Любой текст ---------- */
bot.on("text", async ctx => {
  await ctx.reply(
    "❓ Выберите действие, используя кнопки ниже.",
    { reply_markup: mainMenuKeyboard(ctx.from.id === ADMIN_ID) }
  );
});

/* --------------------------------------------------------------
   VERCEL HANDLER (webhook entry‑point)
   -------------------------------------------------------------- */
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).send("Telegram bot is alive 👋");
  }

  try {
    // 1️⃣ Получаем «сырой» буфер тела запроса
    const raw = await getRawBody(req, {
      length: req.headers["content-length"],
      limit: "1mb",
      encoding: true               // получаем строку JSON
    });

    // 2️⃣ Преобразуем в объект, который понимает Telegraf
    const update = JSON.parse(raw);

    // 3️⃣ Передаём объект в Telegraf
    await bot.handleUpdate(update);

    // 4️⃣ Обязательно отвечаем 200, иначе Telegram будет считать, что запрос провален
    res.status(200).send("ok");
  } catch (err) {
    console.error("❗ Bot error:", err);
    res.status(500).send("internal error");
  }
}

/* --------------------------------------------------------------
   Отключаем автоматический парсер Vercel (это важно!)
   -------------------------------------------------------------- */
export const config = {
  api: {
    bodyParser: false   // <‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑‑-
  }
};
