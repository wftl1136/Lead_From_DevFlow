import 'dotenv/config';
import { leadAnalyzer } from '../src/ai/lead-analyzer.js';
import { DjinniCollector } from '../src/collectors/djinni.js';
import { FreelancehuntCollector } from '../src/collectors/freelancehunt.js';
import { HackerNewsCollector } from '../src/collectors/hn-jobs.js';
import { RedditCollector } from '../src/collectors/reddit.js';
import { RemoteBoardsCollector } from '../src/collectors/remote-boards.js';
import { ThreadsCollector } from '../src/collectors/threads.js';
import { db } from '../src/db/database.js';
import { GeoBlacklistFilter } from '../src/filters/geo-blacklist.js';
import { RecencyFilter } from '../src/filters/recency-filter.js';
import { WebDevFilter } from '../src/filters/web-dev-filter.js';
import { telegramNotifier } from '../src/telegram/notifier.js';
import { RawLead } from '../src/types.js';

async function runManualCheck() {
  console.log('====================================================');
  console.log('🔍 [РУЧНАЯ ПРОВЕРКА] Поиск активных лидов в реальном времени');
  console.log(`⏰ Время запуска: ${new Date().toLocaleTimeString()} (UTC ${new Date().toISOString()})`);
  console.log('====================================================\n');

  const collectors = [
    new FreelancehuntCollector(),
    new DjinniCollector(),
    new HackerNewsCollector(),
    new RedditCollector(),
    new RemoteBoardsCollector(),
    new ThreadsCollector()
  ];

  const allActiveLeads: { lead: RawLead; ageMin: number; webMatch: boolean; webReason?: string; geoAllowed: boolean }[] = [];

  for (const col of collectors) {
    console.log(`📡 Сканирование: ${col.name}...`);
    try {
      const items = await col.fetchLeads();
      console.log(`   Получено объявлений: ${items.length}`);

      for (const lead of items) {
        const recency = RecencyFilter.isRecent(lead, 2.0); // Смотрим окно в 2 часа
        const ageMin = recency.ageMinutes;

        // Если выложено в последние 120 минут
        if (ageMin <= 120) {
          const geo = GeoBlacklistFilter.check(lead);
          const web = WebDevFilter.isTargetWebProject(lead);

          allActiveLeads.push({
            lead,
            ageMin,
            webMatch: web.match,
            webReason: web.reason,
            geoAllowed: geo.allowed
          });
        }
      }
    } catch (e: any) {
      console.error(`❌ Ошибка ${col.name}:`, e.message);
    }
  }

  console.log('\n====================================================');
  console.log(`📊 ИТОГИ РУЧНОЙ ПРОВЕРКИ (за последние 2 часа):`);
  console.log(`Всего свежих объявлений на всех площадках: ${allActiveLeads.length}`);
  
  const targetLeads = allActiveLeads.filter(a => a.geoAllowed && a.webMatch);
  console.log(`Из них ЦЕЛЕВЫХ по созданию/доработке сайтов: ${targetLeads.length}`);
  console.log('====================================================\n');

  if (allActiveLeads.length > 0) {
    console.log('Список свежих объявлений:');
    for (const item of allActiveLeads) {
      const statusIcon = (item.geoAllowed && item.webMatch) ? '✅ [ЦЕЛЕВОЙ САЙТ]' : '❌ [ОТФИЛЬТРОВАН]';
      console.log(`\n${statusIcon} [${item.lead.source}] "${item.lead.title}"`);
      console.log(`   ⏰ Возраст: ${item.ageMin} мин назад`);
      console.log(`   Причина: ${item.webReason || (item.geoAllowed ? 'Ок' : 'Гео-бан РФ')}`);
      console.log(`   URL: ${item.lead.url}`);

      // Если целевой - отправляем в Telegram
      if (item.geoAllowed && item.webMatch) {
        console.log(`   🚀 Отправка в Telegram...`);
        const analyzed = await leadAnalyzer.analyze(item.lead);
        await telegramNotifier.sendLead(analyzed);
        db.markSeen(analyzed, analyzed.score);
        await new Promise(r => setTimeout(r, 1500));
      }
    }
  } else {
    console.log('В течение последних 2 часов на площадках не было новых публикаций.');
  }
}

runManualCheck().catch(console.error);
