import { BLACKLIST_CONFIG } from '../../config/blacklist.config.js';
import { RawLead } from '../types.js';

export interface FilterResult {
  allowed: boolean;
  reason?: string;
}

export class GeoBlacklistFilter {
  /**
   * Проверяет лид на наличие признаков РФ, нежелательных ключевых слов и валют
   */
  public static check(lead: RawLead): FilterResult {
    const fullText = [
      lead.title,
      lead.description,
      lead.url,
      lead.country || '',
      lead.currency || '',
      lead.budget || '',
      (lead.tags || []).join(' ')
    ]
      .join(' ')
      .toLowerCase();

    // 1. Проверка на валюту РФ
    for (const cur of BLACKLIST_CONFIG.CURRENCIES) {
      const regex = new RegExp(`(^|\\s|\\b)${cur}(\\s|\\b|$)`, 'i');
      if (regex.test(fullText) || (lead.currency && lead.currency.toLowerCase() === cur)) {
        return {
          allowed: false,
          reason: `Валюта РФ (${cur})`
        };
      }
    }

    // 2. Проверка на географические маркеры РФ
    for (const geo of BLACKLIST_CONFIG.GEO_KEYWORDS) {
      // Ищем границы слов
      const escaped = geo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(^|[^a-zA-Zа-яА-ЯёЁ0-9])${escaped}([^a-zA-Zа-яА-ЯёЁ0-9]|$)`, 'i');
      if (regex.test(fullText)) {
        return {
          allowed: false,
          reason: `Гео-маркер РФ/РБ (${geo})`
        };
      }
    }

    // 3. Проверка на доменные зоны и почтовые сервисы РФ
    for (const domain of BLACKLIST_CONFIG.DOMAINS_AND_EMAILS) {
      if (fullText.includes(domain.toLowerCase())) {
        return {
          allowed: false,
          reason: `Домен/почта РФ (${domain})`
        };
      }
    }

    // 4. Проверка на экосистемы РФ (Битрикс, Сбер, Тинькофф и т.д.)
    for (const eco of BLACKLIST_CONFIG.RU_ECOSYSTEMS) {
      const escaped = eco.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`(^|[^a-zA-Zа-яА-ЯёЁ0-9])${escaped}([^a-zA-Zа-яА-ЯёЁ0-9]|$)`, 'i');
      if (regex.test(fullText)) {
        return {
          allowed: false,
          reason: `Экосистема/платежка РФ (${eco})`
        };
      }
    }

    // 5. Проверка на нецелевые задачи (спам, курсовые, крипто-боты)
    for (const spam of BLACKLIST_CONFIG.NON_TARGET_KEYWORDS) {
      if (fullText.includes(spam.toLowerCase())) {
        return {
          allowed: false,
          reason: `Нецелевая категория (${spam})`
        };
      }
    }

    return { allowed: true };
  }
}
