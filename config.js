// config.js
// ---------------------------------------------------------------
//  Конфигурация бота – токен, ID админа и данные расписания
//  (ES‑модуль, потому что в package.json указано "type": "module")
// ---------------------------------------------------------------

export const BOT_TOKEN = "7964054515:AAHIU9aDGoFQkfDaplTkbVQ9_JlilcrBzYM"; // <-- ваш токен
export const ADMIN_ID  = 111603368;                                      // <-- ваш telegram‑user_id

// -------------------------- schedule ----------------------------
export const schedule = [
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

// -------------------------- dayInfo ---------------------------
export const dayInfo = [
  { day: "Пн", endOfLessons: "11:40", pickup: "Бабушка", karate: false },
  { day: "Вт", endOfLessons: "11:40", pickup: "Бабушка", karate: "16:30" },
  { day: "Ср", endOfLessons: "11:40", pickup: "Продленка", karate: false },
  { day: "Чт", endOfLessons: "11:40", pickup: "Бабушка", karate: "16:30" },
  { day: "Пт", endOfLessons: "11:40", pickup: "Продленка", karate: false }
];
