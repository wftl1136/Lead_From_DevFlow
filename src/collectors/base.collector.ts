import { Collector, RawLead } from '../types.js';

export abstract class BaseCollector implements Collector {
  abstract name: string;
  abstract fetchLeads(): Promise<RawLead[]>;

  protected cleanText(text?: string): string {
    if (!text) return '';
    return text
      .replace(/<[^>]+>/g, ' ') // Удаление HTML-тегов
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, ' ')
      .trim();
  }
}
