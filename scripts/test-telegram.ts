import 'dotenv/config';
import { telegramNotifier } from '../src/telegram/notifier.js';
import { AnalyzedLead } from '../src/types.js';

async function testTelegram() {
  console.log('Отправка тестовой карточки заказа в Telegram...');

  const sampleLead: AnalyzedLead = {
    id: 'test-12345',
    source: 'Upwork',
    title: 'WordPress Developer for Custom WooCommerce Checkout & Bug Fixes',
    url: 'https://www.upwork.com',
    description: 'Looking for an experienced WordPress & WooCommerce developer to fix a broken checkout page, optimize site speed (LCP) and add custom fields using ACF Pro.',
    budget: '$350 (Fixed)',
    country: 'United States 🇺🇸',
    score: 9,
    projectType: 'Доработка / Багфикс',
    stackMatches: ['WordPress', 'WooCommerce', 'ACF Pro', 'CSS3', 'JavaScript'],
    summary: 'Клиенту требуется исправить ошибки в чекауте WooCommerce, ускорить загрузку (LCP) и настроить кастомные поля через ACF Pro.',
    pitch: "Hi! I have 3+ years of experience in custom WordPress & WooCommerce development. I can quickly troubleshoot the checkout conflict, configure the ACF fields, and optimize your page speed without any downtime on your live store. Ready to start today!",
    language: 'en'
  };

  const success = await telegramNotifier.sendLead(sampleLead);
  if (success) {
    console.log('✅ Тестовая карточка успешно доставлена в ваш Telegram!');
  } else {
    console.error('❌ Ошибка отправки карточки.');
  }
}

testTelegram().catch(console.error);
