import 'dotenv/config';
import { leadAnalyzer } from '../src/ai/lead-analyzer.js';
import { DjinniCollector } from '../src/collectors/djinni.js';
import { FreelancehuntCollector } from '../src/collectors/freelancehunt.js';
import { HackerNewsCollector } from '../src/collectors/hn-jobs.js';
import { RedditCollector } from '../src/collectors/reddit.js';
import { RemoteBoardsCollector } from '../src/collectors/remote-boards.js';
import { ThreadsCollector } from '../src/collectors/threads.js';
import { GeoBlacklistFilter } from '../src/filters/geo-blacklist.js';
import { RecencyFilter } from '../src/filters/recency-filter.js';
import { WebDevFilter } from '../src/filters/web-dev-filter.js';
import { telegramNotifier } from '../src/telegram/notifier.js';

async function checkActiveLeads() {
  console.log('====================================================');
  console.log('🔍 [РУЧНАЯ ПРОВЕРКА] Поиск активных свежих заказов прямо сейчас...');
  console.log('Текущее время системы:', new Date().toISOString(), `(${new Date().toLocaleTimeString()})`);
  console.log('====================================================\n');

  const collectors = [
    new FreelancehuntCollector(),
    new DjinniCollector(),
    new RedditCollector(),
    new HackerNewsCollector(),
    new RemoteBoardsCollector(),
    new ThreadsCollector()
  ];

  let totalScanned = 0;
  let recentFound = 0;
  let targetWebFound = 0;
  const recentLeads: any[] = [];

  for (const col of collectors) {
    console.log(`📡 Сканирование: ${col.name}...`);
    try {
      const leads = await col.fetchLeads();
      console.log(`   Всего в выдаче: ${leads.length} объявлений`);

      for (const lead of leads) {
        totalScanned++;

        // 1. Проверка даты
        const recency = RecencyFilter.isRecent(lead, 1.0); // 1 час
        const ageMin = recency.ageMinutes;

        // Если выложен в последние 3 часа (для наглядности анализа)
        if (ageMin <= 180) {
          const geo = GeoBlacklistFilter.check(lead);
          const web = WebDevFilter.isTargetWebProject(lead);

          recentLeads.push({
            source: lead.source,
            title: lead.title,
            url: lead.url,
            ageMinutes: ageMin,
            isWithin1Hour: recency.recent,
            geoAllowed: geo.allowed,
            geoReason: geo.reason,
            webMatch: web.match,
            webReason: web.reason,
            lead
          });

          if (recency.recent) {
            recentFound++;
            if (geo.allowed && web.match) {
              targetWebFound++;
            }
          }
        }
      }
    } catch (err: any) {
      console.error(`❌ Ошибка ${col.name}:`, err.message);
    }
  }

  console.log('\n====================================================');
  console.log(`📊 РЕЗУЛЬТАТЫ СКАНИРОВАНИЯ:`);
  console.log(`• Всего проанализировано объявлений: ${totalScanned}`);
  console.log(`• Опубликовано за последний 1 ЧАС (<= 60 мин): ${recentFound}`);
  console.log(`• Из них строго по созданию/доработке сайтов (целевые): ${targetWebFound}`);
  console.log('====================================================\n');

  if (recentLeads.length === 0) {
    console.log('За последние 3 часа вообще не было новых публикаций в просканированных фидах.');
  } else {
    console.log('📋 Детальный список объявлений (опубликованных за последние 3 часа):');
    for (const item of recentLeads) {
      const timeStr = item.isWithin1Hour ? `🟢 ${item.ageMinutes} мин назад (СВЕЖИЙ)` : `⏳ ${item.ageMinutes} мин назад (> 1 часа)`;
      const statusStr = (item.geoAllowed && item.webMatch) ? '✅ ЦЕЛЕВОЙ САЙТ' : `❌ ${item.geoReason || item.webReason}`;
      
      console.log(`\n[${item.source}] "${item.title.slice(0, 60)}"`);
      console.log(`   Время: ${timeStr}`);
      console.log(`   Статус: ${statusStr}`);
      console.log(`   URL: ${item.url}`);

      // Если лид свежий и целевой - отправим его в Telegram
      if (item.isWithin1Hour && item.geoAllowed && item.webMatch) {
        console.log(`   🚀 Отправляю в Telegram...`);
        const analyzed = await leadAnalyzer.analyze(item.lead);
        await telegramNotifier.sendLead(analyzed);
      }
    }
  }
}

checkActiveLeads().catch(console.error);
