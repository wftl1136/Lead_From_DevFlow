import { learningStorage } from '../evolution/learning-storage.js';
import { RawLead } from '../types.js';

export class WebDevFilter {
  // Запрещенные темы (даже если есть слово "сайт")
  private static FORBIDDEN_TOPICS = [
    // Тексты и копирайтинг (даже "для сайта")
    'копирайтер', 'копірайтер', 'копирайтинг', 'копірайтинг', 'написание статей', 'написання статей',
    'переводчик', 'перекладач', 'рерайт', 'редактор статей', 'контент-менеджер', 'заполнение карточек',

    // Видео и мультимедиа
    'съемка видео', 'сьемка видео', 'відеозйомка', 'видеомонтаж', 'монтаж видео', 'монтаж відео',
    'lifestyle-видео', 'reels', 'tiktok', 'відеоролик', 'видеоролик', 'озвучка', 'диктор',
    'анимация для сафари', 'видео презентац', 'відео презентац', 'youtube видео',

    // Графический дизайн без верстки/кода
    'логотип', 'лого', 'розробка лого', 'дизайн лого', 'баннер', 'банер', 'дизайн банер',
    'полиграфия', 'поліграфія', 'визитка', 'візитка', 'флаер', 'буклет', 'иллюстрация', 'ілюстрація',
    '3d модел', 'blender', 'дизайн упаковки', 'айдентика', 'фирменный стиль', 'фірмовий стиль',
    'этикетка', 'наклейка',

    // Маркетинг и таргет
    'таргетолог', 'настройка таргета', 'google ads', 'контекстная реклама',
    'smm специалист', 'smm спеціаліст', 'ведение инстаграм', 'продвижение инстаграм',

    // Бытовые вопросы пользователей (не заказы)
    'хто вже знайшов сайт', 'кто уже нашел сайт', 'посоветуйте сайт', 'порадьте сайт',
    'где скачать', 'де скачати', 'какой сайт лучше', 'який сайт кращий', 'хто знає сайт', 'кто знает сайт'
  ];

  // Основы слов намерения разработки или правок (стемминг)
  private static INTENT_STEMS = [
    'потріб', 'нужн', 'шука', 'ищу', 'розроб', 'разработ', 'створен', 'создан',
    'зробит', 'сделат', 'замов', 'заказ', 'доработ', 'доопрацюв', 'допил',
    'полагод', 'почин', 'исправ', 'виправ', 'верстк', 'натяжк', 'ускор', 'прискор',
    'hiring', 'looking for', 'need', 'build', 'create', 'develop', 'redesign', 'fix',
    'maintain', 'custom', 'setup', 'настройк'
  ];

  // Ключевые технологии и термины веб-разработки
  private static WEB_ENTITIES = [
    'сайт', 'website', 'web site', 'лендинг', 'landing', 'інтернет-магазин', 'интернет-магазин',
    'веб-додаток', 'веб-приложение', 'web app', 'корпоративный сайт', 'корпоративний сайт',
    'wordpress', 'вордпресс', 'woocommerce', 'вукомерс', 'react', 'next.js', 'nextjs',
    'typescript', 'node.js', 'nodejs', 'elementor', 'acf pro', 'pagespeed', 'lcp',
    'figma в html', 'figma to html', 'верстка', 'html', 'css', 'frontend', 'front-end', 'fullstack'
  ];

  /**
   * Проверяет, является ли заказ разработкой или доработкой сайта
   */
  public static isTargetWebProject(lead: RawLead): { match: boolean; reason?: string } {
    const text = `${lead.title} ${lead.description}`.toLowerCase();

    // 1. Проверка на базовые и динамически выученные стоп-темы
    for (const forbidden of this.FORBIDDEN_TOPICS) {
      if (text.includes(forbidden)) {
        return {
          match: false,
          reason: `Исключено по стоп-теме: "${forbidden}"`
        };
      }
    }

    // Проверка динамических стоп-слов, выученных ботом по реакциям пользователя
    for (const learned of learningStorage.getDynamicStopWords()) {
      if (text.includes(learned)) {
        return {
          match: false,
          reason: `Исключено по выученному стоп-слову: "${learned}"`
        };
      }
    }

    // 2. Если в заголовке или описании прямо упомянут стек (Next.js, WordPress, WooCommerce, React, верстка и т.д.)
    const strongStackMatches = [
      'wordpress', 'вордпресс', 'woocommerce', 'вукомерс', 'next.js', 'nextjs',
      'react', 'elementor', 'acf', 'figma в html', 'figma to html', 'верстка'
    ].filter(tech => text.includes(tech));

    if (strongStackMatches.length > 0) {
      return {
        match: true,
        reason: `Прямое совпадение со стеком веб-разработки: [${strongStackMatches.join(', ')}]`
      };
    }

    // 3. Наличие общей веб-сущности (сайт, лендинг, магазин)
    const matchedEntities = this.WEB_ENTITIES.filter(e => text.includes(e));
    if (matchedEntities.length === 0) {
      return {
        match: false,
        reason: 'Нет веб-сущностей (сайт/магазин/WordPress/React)'
      };
    }

    // 4. Наличие намерения разработки/поиска по основам слов
    const matchedIntents = this.INTENT_STEMS.filter(stem => text.includes(stem));
    if (matchedIntents.length === 0) {
      return {
        match: false,
        reason: 'Нет коммерческого намерения разработки (нужен/ищу/создание/доработка)'
      };
    }

    return {
      match: true,
      reason: `Целевой проект: [${matchedEntities[0]}] с намерением [${matchedIntents[0]}]`
    };
  }
}
