// api/bot.js
import { Telegraf } from "telegraf";

/* --------------------------------------------------------------
   Токен бота и ID администратора – уже подставлены.
   -------------------------------------------------------------- */
const BOT_TOKEN = "7964054515:AAHIU9aDGoFQkfDaplTkbVQ9_JlilcrBzYM";
const ADMIN_ID  = 111603368;               // telegram‑user_id администратора

if (!BOT_TOKEN) {
  throw new Error("BOT_TOKEN is missing!");
}

/* --------------------------------------------------------------
   Инициализация бота
   -------------------------------------------------------------- */
const bot = new Telegraf(BOT_TOKEN);

/* --------------------------------------------------------------
   Данные расписания (schedule) и дополнительной инфы (dayInfo)
   -------------------------------------------------------------- */
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

/* --------------------------------------------------------------
   Вспомогательные константы и функции
   -------------------------------------------------------------- */
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

// Запоминаем всех, кто когда‑либо писал боту (для рассылки)
let knownUsers = new Set();

/* --------------------------------------------------------------
   Форматирование расписания
   -------------------------------------------------------------- */
function formatDaySchedule(ruDay) {
  const enDay = RU_EN_DAYS[ruDay];
  if (!enDay) return `❓ Неизвестный день «${ruDay}».`;

  const rows = schedule
    .filter((r) => r[enDay])                // пропускаем пустые ячейки
    .map((r) => `${r.time} — ${r[enDay]}`);

  return rows.length
    ? `📅 *${ruDay}*:\n` + rows.join("\n")
    : `📅 *${ruDay}* — занятий нет.`;
}

function formatWeekSchedule() {
  const days = ["Пн", "Вт", "Ср", "Чт", "Пт"];
  return days.map(formatDaySchedule).join("\n\n");
}

/* --------------------------------------------------------------
   Форматирование информации о забирании/карате
   -------------------------------------------------------------- */
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

/* --------------------------------------------------------------
   Команды бота
   -------------------------------------------------------------- */
bot.start((ctx) => {
  knownUsers.add(ctx.from.id);
  ctx.reply(
    `👋 Привет, ${ctx.from.first_name}!\n` +
    `Я — бот‑ассистент школы.\n\n` +
    `📚 Доступные команды:\n` +
    `/schedule — расписание на всю неделю\n` +
    `/schedule <день> — расписание на конкретный день (Пн‑Пт)\n` +
    `/pickup — кто и когда забирает ребёнка + карате\n` +
    `/pickup <день> — та же информация только для выбранного дня\n` +
    (ctx.from.id === ADMIN_ID ? `/notify — рассылка «Расписание обновлено» (только админ)` : "")
  );
});

bot.command("schedule", (ctx) => {
  const args = ctx.message.text.split(/\s+/).slice(1); // всё после /schedule
  if (!args.length) {
    ctx.replyWithMarkdownV2(formatWeekSchedule());
    return;
  }

  const raw = args[0].trim();
  const ruDay = Object.keys(RU_EN_DAYS).find(
    (d) => d.toLowerCase() === raw.toLowerCase()
  );

  if (!ruDay) {
    return ctx.reply(`❓ Неверный день: ${raw}. Пиши Пн, Вт, Ср, Чт, Пт`);
  }

  ctx.replyWithMarkdownV2(formatDaySchedule(ruDay));
});

bot.command("pickup", (ctx) => {
  const args = ctx.message.text.split(/\s+/).slice(1);
  if (!args.length) {
    const all = dayInfo.map((i) => formatPickupInfo(i.day)).join("\n\n");
    return ctx.replyWithMarkdownV2(all);
  }

  const raw = args[0].trim();
  const ruDay = Object.keys(RU_EN_DAYS).find(
    (d) => d.toLowerCase() === raw.toLowerCase()
  );

  if (!ruDay) {
    return ctx.reply(`❓ Неверный день: ${raw}. Пиши Пн, Вт, Ср, Чт, Пт`);
  }

  ctx.replyWithMarkdownV2(formatPickupInfo(ruDay));
});

/* --------------------------------------------------------------
   Команда админа – рассылка "Расписание обновлено"
   -------------------------------------------------------------- */
bot.command("notify", async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) {
    return ctx.reply("🚫 Эта команда доступна только администратору.");
  }

  const text = "🔔 *Расписание обновлено!* Проверьте актуальные данные командой /schedule.";
  const promises = [...knownUsers].map((uid) =>
    ctx.telegram.sendMessage(uid, text, { parse_mode: "MarkdownV2" })
  );

  const results = await Promise.allSettled(promises);
  const ok = results.filter((r) => r.status === "fulfilled").length;
  const fail = results.length - ok;

  ctx.reply(`✅ Оповещение отправлено ${ok} пользователям, не удалось ${fail}.`);
});

/* --------------------------------------------------------------
   Любой другой ввод – подсказываем доступные команды
   -------------------------------------------------------------- */
bot.on("text", (ctx) => {
  ctx.reply(
    "❓ Не понял команду. Доступные команды:\n" +
    "/schedule, /schedule Пн, /pickup, /pickup Пт" +
    (ctx.from.id === ADMIN_ID ? "\n/notify (только админ)" : ""),
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

/* --------------------------------------------------------------
   Vercel‑обработчик (webhook entry‑point)
   -------------------------------------------------------------- */
export default async function handler(req, res) {
  if (req.method === "POST") {
    try {
      await bot.handleUpdate(req.body, res);
    } catch (err) {
      console.error("❗ Bot error:", err);
      res.status(500).send("internal error");
    }
  } else {
    // простая проверка, что функция живёт
    res.status(200).send("Telegram bot is up 👋");
  }
}
