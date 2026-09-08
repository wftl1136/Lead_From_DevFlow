import 'dotenv/config';
import { leadAnalyzer } from '../src/ai/lead-analyzer.js';
import { ThreadsCollector } from '../src/collectors/threads.js';
import { db } from '../src/db/database.js';
import { WebDevFilter } from '../src/filters/web-dev-filter.js';
import { telegramNotifier } from '../src/telegram/notifier.js';

async function resendThreads() {
  console.log('🔄 Пересканирование и повторная отправка постов из Threads с новыми ссылками и описанием...');
  const collector = new ThreadsCollector();
  const leads = await collector.fetchLeads();
  console.log(`Найдено постов в Threads: ${leads.length}`);

  let sent = 0;
  for (const lead of leads) {
    // Проверка фильтром веб-разработки
    const check = WebDevFilter.isTargetWebProject(lead);
    if (!check.match) {
      console.log(`Пропуск не-веб: "${lead.title}" (${check.reason})`);
      continue;
    }

    const analyzed = await leadAnalyzer.analyze(lead);
    console.log(`🚀 Отправка в Telegram: [${analyzed.source}] ${analyzed.title}`);
    console.log(`   URL: ${analyzed.url}`);
    
    await telegramNotifier.sendLead(analyzed);
    db.markSeen(analyzed, analyzed.score);
    sent++;

    await new Promise(r => setTimeout(r, 2000));
    if (sent >= 5) break; // Отправим до 5 качественных постов для демонстрации
  }

  console.log(`✅ Успешно переотправлено постов из Threads: ${sent}`);
}

resendThreads().catch(console.error);
