import 'dotenv/config';
import { FreelancehuntCollector } from '../src/collectors/freelancehunt.js';
import { RedditCollector } from '../src/collectors/reddit.js';
import { RemoteBoardsCollector } from '../src/collectors/remote-boards.js';
import { UpworkCollector } from '../src/collectors/upwork.js';
import { GeoBlacklistFilter } from '../src/filters/geo-blacklist.js';
import { RawLead } from '../src/types.js';

async function testCollectors() {
  console.log('--- Тестирование Anti-RU фильтра ---');
  const fakeRuLead: RawLead = {
    id: 'fake-ru-1',
    source: 'Test',
    title: 'Доработать сайт на 1С-Битрикс в Москве',
    url: 'https://example.com',
    description: 'Нужна интеграция со Сбербанком и оплата через Юкассу. Оплата 25000 руб.',
    country: 'Россия',
    currency: 'RUB'
  };

  const ruCheck = GeoBlacklistFilter.check(fakeRuLead);
  console.log('Тест блокировки РФ лида:', ruCheck.allowed ? '❌ Ошибка (пропустил)' : `✅ Успешно заблокирован (${ruCheck.reason})`);

  const fakeUaLead: RawLead = {
    id: 'fake-ua-1',
    source: 'Freelancehunt',
    title: 'Розробка сайту на WordPress з WooCommerce',
    url: 'https://freelancehunt.com',
    description: 'Потрібно зробити інтернет магазин на Вордпресс під ключ.',
    country: 'Ukraine',
    currency: 'UAH',
    budget: '15 000 грн'
  };
  const uaCheck = GeoBlacklistFilter.check(fakeUaLead);
  console.log('Тест пропуска целевого лида (Украина/Запад):', uaCheck.allowed ? '✅ Успешно допущен' : `❌ Ошибка блокировки (${uaCheck.reason})`);

  console.log('\n--- Тестирование сетевых коллекторов ---');
  const collectors = [
    new FreelancehuntCollector(),
    new UpworkCollector(),
    new RedditCollector(),
    new RemoteBoardsCollector()
  ];

  for (const col of collectors) {
    console.log(`\nПроверка коллектора: ${col.name}...`);
    try {
      const items = await col.fetchLeads();
      console.log(`Найдено записей: ${items.length}`);
      if (items.length > 0) {
        const first = items[0];
        console.log(`Пример: [${first.source}] "${first.title}"`);
        if (first.budget) console.log(`   Бюджет: ${first.budget}`);
      }
    } catch (err: any) {
      console.error(`Ошибка коллектора ${col.name}:`, err.message);
    }
  }
}

testCollectors().catch(console.error);
