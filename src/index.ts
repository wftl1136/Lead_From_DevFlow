import 'dotenv/config';
import { leadAnalyzer } from './ai/lead-analyzer.js';
import { DjinniCollector } from './collectors/djinni.js';
import { FreelancehuntCollector } from './collectors/freelancehunt.js';
import { HackerNewsCollector } from './collectors/hn-jobs.js';
import { RedditCollector } from './collectors/reddit.js';
import { RemoteBoardsCollector } from './collectors/remote-boards.js';
import { ThreadsCollector } from './collectors/threads.js';
import { UpworkCollector } from './collectors/upwork.js';
import { db } from './db/database.js';
import { GeoBlacklistFilter } from './filters/geo-blacklist.js';
import { RecencyFilter } from './filters/recency-filter.js';
import { WebDevFilter } from './filters/web-dev-filter.js';
import { statsTracker } from './stats/stats-tracker.js';
import { TelegramBotListener } from './telegram/bot-listener.js';
import { telegramNotifier } from './telegram/notifier.js';
import { Collector, RawLead } from './types.js';

class LeadRadarAgent {
  private collectors: Collector[] = [];
  private isRunning: boolean = false;
  private intervalMinutes: number = 5;
  private maxAgeHours: number = 5.0;
  private timer: NodeJS.Timeout | null = null;
  private botListener: TelegramBotListener;

  constructor() {
    this.collectors = [
      new FreelancehuntCollector(),
      new DjinniCollector(),
      new ThreadsCollector(),
      new HackerNewsCollector(),
      new RedditCollector(),
      new RemoteBoardsCollector(),
      new UpworkCollector()
    ];

    this.intervalMinutes = parseInt(process.env.SCAN_INTERVAL_MINUTES || '5', 10);
    this.maxAgeHours = parseFloat(process.env.MAX_LEAD_AGE_HOURS || '5.0');
    this.botListener = new TelegramBotListener(this.maxAgeHours, () => this.runScanCycle());
  }

  public async start(): Promise<void> {
    console.log('====================================================');
    console.log('🚀 [LeadRadar AI] АВТОНОМНЫЙ АГЕНТ ЗАПУЩЕН');
    console.log(`⏱ Режим: АВТОМАТИЧЕСКИЙ (сканирование каждые ${this.intervalMinutes} мин)`);
    console.log(`⏰ Фильтр свежести: ТОЛЬКО ПОСТЫ НЕ СТАРШЕ ${this.maxAgeHours * 60} МИНУТ (${this.maxAgeHours} ЧАСОВ)`);
    console.log(`🎯 Фокус: ТОЛЬКО СОЗДАНИЕ И ДОРАБОТКА САЙТОВ`);
    console.log(`🛡 Защита Anti-RU: АКТИВНА (100% бан РФ, рублей, .ru)`);
    console.log(`📡 Активные источники: Freelancehunt, Djinni, Threads, Hacker News, Reddit, Remote Boards, Upwork`);
    console.log('====================================================');

    // Запуск слушателя команд Telegram и интерактивных кнопок
    await this.botListener.start();

    // Оповещение об обновлении правил в Telegram с кнопками
    await telegramNotifier.sendAlert(
      `⏱ <b>LeadRadar AI: Фильтр свежести обновлен (${this.maxAgeHours} ч)!</b>\n\n` +
      `• <b>Максимальный возраст:</b> не старше <b>${this.maxAgeHours * 60} минут (${this.maxAgeHours} ч)</b>\n` +
      `• <b>Старые посты:</b> автоматически отбрасываются\n` +
      `• <b>Интерактивные кнопки:</b> нажмите «📊 Статистика фильтрации» внизу для отчета`
    );

    // Первый цикл
    await this.runScanCycle();

    // Планировщик регулярного запуска
    this.timer = setInterval(
      () => this.runScanCycle(),
      this.intervalMinutes * 60 * 1000
    );
  }

  public stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.botListener.stop();
    console.log('🛑 [LeadRadar AI] Агент остановлен');
  }

  /**
   * Полный цикл сканирования всех источников
   */
  public async runScanCycle(): Promise<{ found: number; sent: number; droppedRu: number; droppedOld: number; droppedNonWeb: number }> {
    if (this.isRunning) {
      console.log('⏳ Предыдущий цикл еще в процессе, пропускаем...');
      return { found: 0, sent: 0, droppedRu: 0, droppedOld: 0, droppedNonWeb: 0 };
    }

    this.isRunning = true;
    const startTime = Date.now();
    console.log(`\n🔍 [${new Date().toLocaleTimeString()}] Старт автоматического сканирования...`);

    let totalFound = 0;
    let totalSent = 0;
    let totalDroppedRu = 0;
    let totalDroppedOld = 0;
    let totalDroppedNonWeb = 0;

    try {
      for (const collector of this.collectors) {
        console.log(`📡 Сбор лидов: ${collector.name}...`);
        try {
          const leads: RawLead[] = await collector.fetchLeads();
          const newCount = leads.filter(l => !db.hasSeen(l.id)).length;
          const duplicateCount = leads.length - newCount;
          console.log(`   Объявлений получено: ${leads.length} (Новых: ${newCount}, Ранее проверенных: ${duplicateCount})`);

          for (const lead of leads) {
            totalFound++;
            statsTracker.recordLeadFound(lead.source);

            // 1. Проверка на дубликаты
            if (db.hasSeen(lead.id)) {
              statsTracker.recordDuplicate();
              continue;
            }

            // 2. Жесткий Anti-RU фильтр
            const geoCheck = GeoBlacklistFilter.check(lead);
            if (!geoCheck.allowed) {
              totalDroppedRu++;
              statsTracker.recordAntiRu();
              db.markSeen(lead, 0);
              console.log(`   ⛔️ [Anti-RU] Отброшен: "${lead.title.slice(0, 35)}..." (${geoCheck.reason})`);
              continue;
            }

            // 3. Фильтр свежести: заказ должен быть выложен НЕ БОЛЕЕ maxAgeHours НАЗАД
            const recencyCheck = RecencyFilter.isRecent(lead, this.maxAgeHours);
            if (!recencyCheck.recent) {
              totalDroppedOld++;
              statsTracker.recordOldLead();
              db.markSeen(lead, 0);
              console.log(`   ⏰ [Старый заказ] Отброшен: "${lead.title.slice(0, 35)}..." (${recencyCheck.ageMinutes} мин назад > ${this.maxAgeHours * 60} мин)`);
              continue;
            }

            // 4. Строгий фильтр задач: ТОЛЬКО создание и доработка сайтов
            const webCheck = WebDevFilter.isTargetWebProject(lead);
            if (!webCheck.match) {
              totalDroppedNonWeb++;
              statsTracker.recordNonWeb();
              db.markSeen(lead, 0);
              console.log(`   🚫 [Не сайт] Отброшен: "${lead.title.slice(0, 40)}..." (${webCheck.reason})`);
              continue;
            }

            // 5. ИИ-анализ и формирование питча
            const analyzed = await leadAnalyzer.analyze(lead);
            db.markSeen(analyzed, analyzed.score);

            // 6. Отправка в Telegram
            console.log(`   ⭐️ [Свежий сайт: ${recencyCheck.ageMinutes}м назад] [Скор ${analyzed.score}/10] "${analyzed.title.slice(0, 45)}..."`);
            const sent = await telegramNotifier.sendLead(analyzed);
            if (sent) {
              totalSent++;
              statsTracker.recordSent();
              await new Promise(res => setTimeout(res, 1200));
            }
          }
        } catch (collectorError: any) {
          console.error(`❌ Ошибка коллектора ${collector.name}:`, collectorError.message);
        }
      }
    } finally {
      this.isRunning = false;
      statsTracker.recordScanComplete();
      const durationSec = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(`✅ Цикл завершен за ${durationSec}с. Свежих заказов отправлено: ${totalSent} (РФ: ${totalDroppedRu}, Старых (>${this.maxAgeHours}ч): ${totalDroppedOld}, Не-сайтов: ${totalDroppedNonWeb})\n`);
    }

    return { found: totalFound, sent: totalSent, droppedRu: totalDroppedRu, droppedOld: totalDroppedOld, droppedNonWeb: totalDroppedNonWeb };
  }
}

// Запуск приложения
const agent = new LeadRadarAgent();

process.on('SIGINT', () => {
  agent.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  agent.stop();
  process.exit(0);
});

agent.start().catch(err => {
  console.error('Фатальная ошибка агента:', err);
});
