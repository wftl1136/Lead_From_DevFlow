# Инструкция: Деплой LeadRadar AI на Railway (24/7 в облаке)

Проект полностью настроен для запуска в облачном Linux-контейнере с поддержкой Chromium для парсинга Threads.

---

### Шаг 1. Залить код в свой GitHub (Private репозиторий)
1. Откройте [github.com/new](https://github.com/new) и создайте новый **Private** репозиторий (например, `lead-finder-agent`).
2. В терминале на вашем Mac выполните:
   ```bash
   cd /Users/maksym/lead-finder-agent
   git remote add origin https://github.com/ВАШ_ЮЗЕРНЕЙМ/lead-finder-agent.git
   git branch -M main
   git push -u origin main
   ```
   *(Файл `.env` защищен через `.gitignore` и в GitHub не попадет).*

---

### Шаг 2. Развернуть на Railway
1. Перейдите на [railway.com](https://railway.com) и войдите через **GitHub**.
2. Нажмите **«+ New Project»** → выберите **«Deploy from GitHub repo»**.
3. Выберите ваш репозиторий `lead-finder-agent`.
4. Railway автоматически обнаружит наш `Dockerfile` и начнет сборку контейнера с поддержкой Chromium.

---

### Шаг 3. Добавить переменные в Railway
Перейдите во вкладку **«Variables»** вашего проекта на Railway и добавьте:

| Переменная | Значение |
| :--- | :--- |
| `TELEGRAM_BOT_TOKEN` | `8910170174:AAHRf2XjYtmMYekspFDh6LY93_uN_9ZH5L4` |
| `TELEGRAM_CHAT_ID` | `-1004302268313` |
| `TELEGRAM_ADMIN_CHAT_ID` | `-1004302268313` |
| `MAX_LEAD_AGE_HOURS` | `5` | Макс. возраст заказа в часах (5 часов = 300 минут) |
| `SCAN_INTERVAL_MINUTES` | `5` |
| `MIN_SCORE_TO_NOTIFY` | `1` |
| `GEMINI_API_KEY` | *(ваш ключ при наличии)* |

---

### Результат:
Railway запустит контейнер в облаке. Агент начнет сканировать **Threads, Freelancehunt, Djinni, Hacker News, Reddit** и присылать заказы в Telegram круглые сутки, даже когда ваш Mac полностью выключен.
