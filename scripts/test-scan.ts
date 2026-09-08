import 'dotenv/config';
import { leadAnalyzer } from '../src/ai/lead-analyzer.js';
import { DjinniCollector } from '../src/collectors/djinni.js';
import { FreelancehuntCollector } from '../src/collectors/freelancehunt.js';
import { RedditCollector } from '../src/collectors/reddit.js';
import { RemoteBoardsCollector } from '../src/collectors/remote-boards.js';
import { db } from '../src/db/database.js';
import { GeoBlacklistFilter } from '../src/filters/geo-blacklist.js';
import { telegramNotifier } from '../src/telegram/notifier.js';

async function runTestScan() {
  console.log('--- Запуск тестового цикла сканирования ---');
  const collectors = [
    new FreelancehuntCollector(),
    new DjinniCollector(),
    new RedditCollector(),
    new RemoteBoardsCollector()
  ];

  let sentCount = 0;
  const maxToSendInTest = 3; // Отправим не более 3 реальных заказов для демонстрации

  for (const col of collectors) {
    console.log(`\n📡 Опрос: ${col.name}...`);
    const leads = await col.fetchLeads();
    console.log(`   Всего в фиде: ${leads.length}`);

    for (const lead of leads) {
      if (sentCount >= maxToSendInTest) break;

      // Фильтр РФ
      const geoCheck = GeoBlacklistFilter.check(lead);
      if (!geoCheck.allowed) {
        console.log(`   ⛔️ [Anti-RU] Исключен заказ: "${lead.title.slice(0, 35)}..." (${geoCheck.reason})`);
        continue;
      }

      // Скоринг
      const analyzed = await leadAnalyzer.analyze(lead);
      console.log(`   🔎 [Скор: ${analyzed.score}/10] [${analyzed.projectType}] ${analyzed.title.slice(0, 45)}...`);

      if (analyzed.score >= 6) {
        console.log(`      🚀 Отправка в Telegram...`);
        await telegramNotifier.sendLead(analyzed);
        sentCount++;
        await new Promise(r => setTimeout(r, 1500));
      }
    }

    if (sentCount >= maxToSendInTest) break;
  }

  console.log(`\n🎉 Тестовый прогон завершен. Реальных релевантных заказов доставлено в Telegram: ${sentCount}`);
}

runTestScan().catch(console.error);
