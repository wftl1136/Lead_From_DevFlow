import 'dotenv/config';
import { telegramNotifier } from '../src/telegram/notifier.js';
import { AnalyzedLead } from '../src/types.js';

async function testCardFormat() {
  console.log('Отправка обновленной демонстрационной карточки в Telegram...');

  const sampleLead: AnalyzedLead = {
    id: 'test-en-demo',
    source: 'Upwork',
    title: 'Custom WordPress & WooCommerce Checkout Bug Fixes',
    url: 'https://www.upwork.com',
    description: 'We are seeking an experienced WordPress and WooCommerce developer to urgently fix our broken multi-step checkout flow. Payment gateways are throwing AJAX timeouts, and we need custom fields integrated using ACF Pro. Only developers with 3+ years experience, please.',
    budget: '$450 (Fixed)',
    country: 'United States 🇺🇸',
    score: 9,
    projectType: 'Доработка / Багфикс',
    stackMatches: ['WordPress', 'WooCommerce', 'ACF Pro', 'REST API', 'JavaScript'],
    summary: 'Клиенту срочно требуется исправить многошаговый чекаут в WooCommerce, где возникают тайм-ауты платежных шлюзов по AJAX, и интегрировать кастомные поля через ACF Pro.',
    pitch: "Hi! I noticed your multi-step WooCommerce checkout is running into AJAX timeouts with payment gateways. With 3+ years of specialized WordPress & WooCommerce development, I frequently diagnose and resolve gateway hook conflicts and ACF custom field bindings. I can inspect your staging environment today and have the checkout running smoothly without downtime.",
    language: 'en'
  };

  await telegramNotifier.sendLead(sampleLead);
  console.log('✅ Обновленная карточка доставлена в Telegram!');
}

testCardFormat().catch(console.error);
