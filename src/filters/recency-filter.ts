import { RawLead } from '../types.js';

export class RecencyFilter {
  /**
   * Проверяет, был ли заказ опубликован не более чем maxHours назад (по умолчанию 1 час)
   */
  public static isRecent(lead: RawLead, maxHours: number = 1.0): { recent: boolean; ageMinutes: number } {
    if (!lead.postedAt || isNaN(lead.postedAt.getTime())) {
      // Если даты вообще нет, считаем не свежим во избежание старых постов
      return { recent: false, ageMinutes: 999999 };
    }

    const now = Date.now();
    const postedTime = lead.postedAt.getTime();
    const ageMs = now - postedTime;
    const ageMinutes = Math.round(ageMs / (1000 * 60));
    const maxAgeMs = maxHours * 60 * 60 * 1000;

    // Заказ должен быть не старше maxHours и не из далекого будущего (с погрешностью в 5 минут на часовые пояса)
    const isRecent = ageMs >= -5 * 60 * 1000 && ageMs <= maxAgeMs;

    return {
      recent: isRecent,
      ageMinutes: Math.max(0, ageMinutes)
    };
  }
}
