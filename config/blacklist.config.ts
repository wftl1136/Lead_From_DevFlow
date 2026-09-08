export const BLACKLIST_CONFIG = {
  // Запрещенные страны, города и географические маркеры (РФ)
  GEO_KEYWORDS: [
    'russia',
    'russian federation',
    'россия',
    'российская федерация',
    'рф',
    'москва',
    'moscow',
    'санкт-петербург',
    'петербург',
    'питер',
    'spb',
    'новосибирск',
    'екатеринбург',
    'казань',
    'нижний новгород',
    'челябинск',
    'самара',
    'ростов-на-дону',
    'уфа',
    'красноярск',
    'воронеж',
    'пермь',
    'волгоград',
    'краснодар',
    'беларусь',
    'belarus',
    'минск',
    'minsk'
  ],

  // Запрещенные валюты
  CURRENCIES: [
    'rub',
    'руб',
    'рубл',
    '₽',
    'rur'
  ],

  // Запрещенные доменные зоны, почтовые сервисы и ссылки
  DOMAINS_AND_EMAILS: [
    '.ru',
    '.рф',
    '.su',
    '@mail.ru',
    '@yandex.',
    '@rambler.ru',
    '@bk.ru',
    '@inbox.ru',
    '@list.ru',
    'vk.com',
    'dzen.ru',
    'ok.ru'
  ],

  // Специфические для РФ экосистемы, платежки и CMS
  RU_ECOSYSTEMS: [
    '1с-битрикс',
    'битрикс',
    'bitrix',
    '1c-bitrix',
    'тинькофф',
    'т-банк',
    'сбербанк',
    'сбер',
    'sberbank',
    'sber',
    'юkassa',
    'юкасса',
    'юmoney',
    'юмани',
    'robokassa',
    'робокасса',
    'vk pay',
    'карта мир',
    'яндекс.касса'
  ],

  // Нецелевые типы задач (не веб-разработка, спам, рефераты, крипта-скам)
  NON_TARGET_KEYWORDS: [
    'academic writing',
    'essay writing',
    'crypto trading bot',
    'onlyfans chatter',
    'data entry clerk',
    'virtual assistant call center',
    'unity game developer',
    'unreal engine',
    'blender 3d animator'
  ]
};
