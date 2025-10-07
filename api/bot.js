// api/bot.js
import { Telegraf } from "telegraf";

// ----------- CONFIG -------------------------------------------------
const BOT_TOKEN   = process.env.BOT_TOKEN;      // <-- set in Vercel env vars
const ADMIN_ID    = Number(process.env.ADMIN_ID); // <-- telegram numeric user_id of the admin
if (!BOT_TOKEN) throw new Error("BOT_TOKEN env var is required");

// -------------------------------------------------------------------
const bot = new Telegraf(BOT_TOKEN);

// -------------------------------------------------------------------
// 2 JSON‑tables (you can also read them from a file or a DB if you prefer)
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

// -------------------------------------------------------------------
// Helper maps
const EN_RU_DAYS = {
  Monday: "Пн",
  Tuesday: "Вт",
  Wednesday: "Ср",
  Thursday: "Чт",
  Friday: "Пт",
  Saturday: "Сб"
};

const RU_EN_DAYS = {
  Пн: "Monday",
  Вт: "Tuesday",
  Ср: "Wednesday",
  Чт: "Thursday",
  Пт: "Friday",
  Сб: "Saturday"
};

// In‑memory list of known users (persisted only while function "warms up").
//   In production you would use a real DB (e.g. Upstash Redis, Supabase, …)
//   For a simple demo this is enough.
let knownUsers = new Set();

// -------------------------------------------------------------------
// 1️⃣  /start – greet & remember the user
bot.start((ctx) => {
  knownUsers.add(ctx.from.id);
  ctx.reply(
    `👋 Привет, ${ctx.from.first_name}!\n` +
    `Я — бот‑ассистент школы.\n\n` +
    `📚 Доступные команды:\n` +
    `/schedule – расписание на всю неделю\n` +
    `/schedule <день> – расписание на выбранный день (Пн‑Пт)\n` +
    `/pickup – информация о том, кто забирает ребёнка и есть ли карате\n` +
    `/pickup <день> – та же информация только для конкретного дня\n` +
    (ctx.from.id === ADMIN_ID
      ? `\n🛎️ /notify – отправить всем сообщение “Расписание обновлено”`
      : "")
  );
});

// -------------------------------------------------------------------
// Helper: format schedule for a **single** day (RU day abbreviation)
function formatDaySchedule(ruDay) {
  const enDay = RU_EN_DAYS[ruDay];
  if (!enDay) return `❓ Неизвестный день «${ruDay}».`;
  const rows = schedule
    .filter((row) => row[enDay]) // skip rows where the cell is null/undefined
    .map((row) => `${row.time} — ${row[enDay]}`);
  return rows.length
    ? `📅 *${ruDay}*:\n` + rows.join("\n")
    : `📅 *${ruDay}* — нет занятий.`;
}

// Helper: format whole‑week schedule
function formatWeekSchedule() {
  const daysOrder = ["Пн", "Вт", "Ср", "Чт", "Пт"];
  const parts = daysOrder.map((d) => formatDaySchedule(d));
  return parts.join("\n\n");
}

// -------------------------------------------------------------------
// 2️⃣  /schedule – whole week or one day
bot.command("schedule", (ctx) => {
  const args = ctx.message.text.split(/\s+/).slice(1); // after /schedule
  if (args.length === 0) {
    ctx.replyWithMarkdownV2(formatWeekSchedule());
    return;
  }
  const day = args[0].charAt(0).toUpperCase() + args[0].slice(1).toLowerCase(); // normalise
  const ruDay = Object.keys(RU_EN_DAYS).find(
    (d) => d.toLowerCase() === day.toLowerCase()
  );
  if (!ruDay) {
    ctx.reply(`❓ Неправильный день: ${day}. Пиши Пн, Вт, Ср, Чт, Пт`);
    return;
  }
  ctx.replyWithMarkdownV2(formatDaySchedule(ruDay));
});

// -------------------------------------------------------------------
// 3️⃣  /pickup – info about who picks the child + karate
function formatPickupInfo(ruDay) {
  const info = dayInfo.find((i) => i.day === ruDay);
  if (!info) return `❓ Нет данных для дня ${ruDay}.`;

  const karate = info.karate === false ? "❌ нет" : `🕒 ${info.karate}`;
  return (
    `📌 *${ruDay}*:\n` +
    `⏰ Конец уроков: ${info.endOfLessons}\n` +
    `👤 Кто заберёт: ${info.pickup}\n` +
    `🥋 Карате: ${karate}`
  );
}

bot.command("pickup", (ctx) => {
  const args = ctx.message.text.split(/\s+/).slice(1);
  if (args.length === 0) {
    // show all days (Mon‑Fri)
    const all = dayInfo
      .map((i) => formatPickupInfo(i.day))
      .join("\n\n");
    ctx.replyWithMarkdownV2(all);
    return;
  }
  const day = args[0].charAt(0).toUpperCase() + args[0].slice(1).toLowerCase();
  const ruDay = Object.keys(RU_EN_DAYS).find(
    (d) => d.toLowerCase() === day.toLowerCase()
  );
  if (!ruDay) {
    ctx.reply(`❓ Неправильный день: ${day}. Пиши Пн, Вт, Ср, Чт, Пт`);
    return;
  }
  ctx.replyWithMarkdownV2(formatPickupInfo(ruDay));
});

// -------------------------------------------------------------------
// 4️⃣  ADMIN command – broadcast “Расписание обновлено”
bot.command("notify", async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) {
    return ctx.reply("🚫 Вы не администратор.");
  }
  const text = "🔔 *Расписание обновлено!* Проверьте актуальные данные командой /schedule.";
  const promises = [...knownUsers].map((uid) => ctx.telegram.sendMessage(uid, text, { parse_mode: "MarkdownV2" }));
  try {
    await Promise.allSettled(promises);
    ctx.reply(`✅ Оповещение отправлено ${knownUsers.size} пользователям.`);
  } catch (e) {
    ctx.reply("⚠️ При отправке произошла ошибка.");
  }
});

// -------------------------------------------------------------------
// 5️⃣  Any other text – friendly fallback + quick‑reply keyboard
bot.on("text", (ctx) => {
  ctx.reply(
    "❓ Я не понял команду. Доступные команды:\n" +
    "/schedule, /schedule Пн, /pickup, /pickup Пт\n" +
    (ctx.from.id === ADMIN_ID ? "/notify (только админ)" : ""),
    {
      reply_markup: {
        keyboard: [
          [{ text: "🗓️ Расписание на неделю" }, { text: "🗓️ Расписание на Пн" }],
          [{ text: "📦 Кто забирает?" }, { text: "🥋 Карате?" }]
        ],
        resize_keyboard: true,
        one_time_keyboard: false
      }
    }
  );
});

// -------------------------------------------------------------------
// Vercel entry point – webhook handler
export default async function handler(req, res) {
  if (req.method === "POST") {
    // Telegraf expects the raw body as a Buffer
    try {
      await bot.handleUpdate(req.body, res);
    } catch (e) {
      console.error("⚡️ Bot error:", e);
      res.status(500).send("internal error");
    }
  } else {
    // Simple GET for sanity check
    res.status(200).send("Telegram bot is alive 👋");
  }
}
