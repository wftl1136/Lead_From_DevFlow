import axios from 'axios';
import { learningStorage } from '../evolution/learning-storage.js';
import { reflectionEngine } from '../evolution/reflection-engine.js';
import { statsTracker } from '../stats/stats-tracker.js';

export class TelegramBotListener {
  private botToken: string;
  private isRunning: boolean = false;
  private offset: number = 0;
  private onManualScanRequested?: () => Promise<any>;
  private maxAgeHours: number;

  constructor(maxAgeHours: number = 5, onManualScanRequested?: () => Promise<any>) {
    this.botToken = process.env.TELEGRAM_BOT_TOKEN || '';
    this.maxAgeHours = maxAgeHours;
    this.onManualScanRequested = onManualScanRequested;
  }

  public setMaxAgeHours(hours: number): void {
    this.maxAgeHours = hours;
  }

  public async start(): Promise<void> {
    if (!this.botToken) {
      console.warn('[Telegram Listener] Токен не задан, интерактивный режим выключен.');
      return;
    }

    this.isRunning = true;
    console.log('🤖 [Telegram Listener] Интерактивные кнопки и команды (/stats, /scan, /evolve) активированы');

    // Регистрируем команды в Telegram меню
    await this.registerCommands();

    // Запускаем фоновый опрос обновлений
    this.pollLoop();
  }

  public stop(): void {
    this.isRunning = false;
  }

  private async registerCommands(): Promise<void> {
    try {
      await axios.post(`https://api.telegram.org/bot${this.botToken}/setMyCommands`, {
        commands: [
          { command: 'stats', description: '📊 Статистика фильтрации (причины и количество)' },
          { command: 'evolve', description: '🧠 Запустить цикл самообучения и поиск новых источников' },
          { command: 'scan', description: '🔄 Запустить сканирование вручную прямо сейчас' },
          { command: 'start', description: '🚀 Главное меню и кнопки управления' }
        ]
      });
    } catch (err: any) {
      console.warn('[Telegram Listener] Не удалось зарегистрировать команды меню:', err?.message);
    }
  }

  private async pollLoop(): Promise<void> {
    while (this.isRunning) {
      try {
        const response = await axios.get(`https://api.telegram.org/bot${this.botToken}/getUpdates`, {
          params: {
            offset: this.offset,
            timeout: 25,
            allowed_updates: JSON.stringify(['message', 'callback_query'])
          },
          timeout: 35000
        });

        const updates = response.data?.result;
        if (Array.isArray(updates) && updates.length > 0) {
          for (const update of updates) {
            this.offset = update.update_id + 1;
            await this.handleUpdate(update);
          }
        }
      } catch (err: any) {
        if (!this.isRunning) break;
        // Пауза при сетевых ошибках
        await new Promise(r => setTimeout(r, 4000));
      }
    }
  }

  private async handleUpdate(update: any): Promise<void> {
    try {
      // 1. Обработка нажатий на Inline-кнопки
      if (update.callback_query) {
        const cq = update.callback_query;
        const data = cq.data || '';
        const chatId = cq.message?.chat?.id;

        if (data.startsWith('fb_g:')) {
          const shortId = data.replace('fb_g:', '');
          learningStorage.recordFeedback(shortId, 'good');
          await this.answerCallbackQuery(cq.id, '🔥 Добавлено в эталоны!');
          if (chatId) {
            await this.sendTextMessage(chatId, '🔥 <b>Заказ сохранен как эталон!</b>\nНейросеть выучила этот проект и будет использовать его стиль для будущих откликов.');
          }
          return;
        }

        if (data.startsWith('fb_b:')) {
          const shortId = data.replace('fb_b:', '');
          learningStorage.recordFeedback(shortId, 'bad');
          await this.answerCallbackQuery(cq.id, '💩 Отмечено как нерелевантное');
          if (chatId) {
            await this.sendTextMessage(chatId, '💩 <b>Заказ отмечен как нерелевантный.</b>\nКлючевые сигналы добавлены в динамический стоп-лист.');
          }
          return;
        }

        await this.answerCallbackQuery(cq.id);

        if (data === 'get_stats' && chatId) {
          await this.sendStatsMessage(chatId);
        } else if (data === 'run_evolve' && chatId) {
          await this.sendTextMessage(chatId, '🧠 <b>Запускаю цикл самообучения и поиск новых источников через Tavily...</b>');
          await reflectionEngine.runEvolutionCycle();
        } else if (data === 'run_scan' && chatId) {
          await this.sendTextMessage(chatId, '🔄 <b>Запускаю сканирование всех площадок...</b>');
          if (this.onManualScanRequested) {
            await this.onManualScanRequested();
          }
        }
        return;
      }

      // 2. Обработка текстовых команд и сообщений
      if (update.message && update.message.text) {
        const msg = update.message;
        const text = msg.text.trim().toLowerCase();
        const chatId = msg.chat.id;

        if (text === '/stats' || text.includes('статистик') || text === '📊 статистика') {
          await this.sendStatsMessage(chatId);
        } else if (text === '/evolve' || text.includes('обуч') || text === '🧠 самообучение') {
          await this.sendTextMessage(chatId, '🧠 <b>Запускаю цикл самообучения и поиск новых источников через Tavily...</b>');
          await reflectionEngine.runEvolutionCycle();
        } else if (text === '/scan' || text.includes('сканир') || text === '🔄 сканировать сейчас') {
          await this.sendTextMessage(chatId, '🔄 <b>Запускаю сканирование всех площадок...</b>');
          if (this.onManualScanRequested) {
            await this.onManualScanRequested();
          }
        } else if (text === '/start' || text === '/help') {
          await this.sendWelcomeMessage(chatId);
        }
      }
    } catch (err: any) {
      console.warn('[Telegram Listener] Ошибка обработки update:', err?.message);
    }
  }

  public async sendStatsMessage(chatId: string | number): Promise<void> {
    const text = statsTracker.getFormattedReport(this.maxAgeHours);

    await axios.post(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🔄 Обновить статистику', callback_data: 'get_stats' },
            { text: '⚡️ Сканировать сейчас', callback_data: 'run_scan' }
          ]
        ]
      }
    });
  }

  private async sendWelcomeMessage(chatId: string | number): Promise<void> {
    const welcome = `👋 <b>Добро пожаловать в панель управления LeadRadar AI!</b>

Я круглосуточно сканирую freelance-биржи и открытый интернет (Freelancehunt, Djinni, Threads, Reddit, Hacker News, WeWorkRemotely, Upwork) в поиске заказов на разработку и доработку сайтов.

<b>Быстрые действия:</b>
• Нажмите <b>«📊 Статистика»</b> для просмотра причин и количества отсеянных заказов.
• Нажмите <b>«🔄 Сканировать сейчас»</b> для внеочередного поиска лидов.`;

    await axios.post(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
      chat_id: chatId,
      text: welcome,
      parse_mode: 'HTML',
      reply_markup: {
        keyboard: [
          [{ text: '📊 Статистика' }, { text: '🔄 Сканировать сейчас' }],
          [{ text: '🧠 Самообучение' }]
        ],
        resize_keyboard: true
      }
    });
  }

  private async sendTextMessage(chatId: string | number, text: string): Promise<void> {
    await axios.post(`https://api.telegram.org/bot${this.botToken}/sendMessage`, {
      chat_id: chatId,
      text,
      parse_mode: 'HTML'
    });
  }

  private async answerCallbackQuery(callbackQueryId: string, text?: string): Promise<void> {
    try {
      await axios.post(`https://api.telegram.org/bot${this.botToken}/answerCallbackQuery`, {
        callback_query_id: callbackQueryId,
        text
      });
    } catch {}
  }
}
