export interface RawLead {
  id: string;                 // Уникальный идентификатор (хеш или URL)
  source: string;             // 'Upwork' | 'Freelancehunt' | 'Reddit' | 'RemoteOK' | 'WeWorkRemotely'
  title: string;              // Название проекта
  url: string;                // Прямая ссылка
  description: string;        // Текст описания / требования
  budget?: string;            // Указанный бюджет (например, "$250" или "Почасовая $30-50")
  currency?: string;          // USD, EUR, UAH и т.д.
  postedAt?: Date;            // Время публикации
  country?: string;           // Страна клиента (если доступна)
  tags?: string[];            // Теги / категории
}

export interface AnalyzedLead extends RawLead {
  score: number;              // Оценка релевантности от 1 до 10
  stackMatches: string[];     // Совпавшие технологии из стека
  projectType: 'Сайт с нуля' | 'Доработка / Багфикс' | 'Редизайн' | 'API / Интеграция' | 'Оптимизация скорости' | 'Другое';
  summary: string;            // Краткая выжимка задачи (1-2 предложения)
  pitch: string;              // Персонализированный отклик (Cover Letter Pitch)
  language: 'en' | 'ua' | 'other';
  reason?: string;            // Обоснование оценки
}

export interface Collector {
  name: string;
  fetchLeads(): Promise<RawLead[]>;
}
