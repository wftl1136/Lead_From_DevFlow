import Parser from 'rss-parser';
import { SOURCES_CONFIG } from '../../config/sources.config.js';
import { RawLead } from '../types.js';
import { BaseCollector } from './base.collector.js';

export class FreelancehuntCollector extends BaseCollector {
  name = 'Freelancehunt';
  private parser: Parser;

  constructor() {
    super();
    this.parser = new Parser({
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)'
      }
    });
  }

  async fetchLeads(): Promise<RawLead[]> {
    const leads: RawLead[] = [];

    for (const feed of SOURCES_CONFIG.FREELANCEHUNT_FEEDS) {
      try {
        const feedData = await this.parser.parseURL(feed.url);

        for (const item of feedData.items || []) {
          if (!item.link || !item.title) continue;

          let title = this.cleanText(item.title);
          let rawBudget: string | undefined = undefined;

          // Формат заголовка в Freelancehunt часто заканчивается на: " - 4550UAH" или " - 150USD"
          const budgetEndMatch = title.match(/\s*-\s*(\d+[\d\s]*)(UAH|USD|EUR)\s*$/i);
          if (budgetEndMatch) {
            const amount = budgetEndMatch[1].trim();
            const curr = budgetEndMatch[2].toUpperCase();
            rawBudget = `${amount} ${curr}`;
            title = title.replace(/\s*-\s*(\d+[\d\s]*)(UAH|USD|EUR)\s*$/i, '').trim();
          }

          const content = item.content || item.contentSnippet || '';

          leads.push({
            id: item.guid || item.link,
            source: 'Freelancehunt',
            title,
            url: item.link,
            description: this.cleanText(content),
            budget: rawBudget,
            country: 'Ukraine 🇺🇦',
            currency: rawBudget?.includes('USD') ? 'USD' : (rawBudget?.includes('EUR') ? 'EUR' : 'UAH'),
            tags: item.categories || [],
            postedAt: item.pubDate ? new Date(item.pubDate) : new Date()
          });
        }
      } catch (error: any) {
        console.warn(`[FreelancehuntCollector] Ошибка загрузки фида ${feed.name}:`, error.message);
      }
    }

    return leads;
  }
}
