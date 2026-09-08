import Parser from 'rss-parser';
import { SOURCES_CONFIG } from '../../config/sources.config.js';
import { RawLead } from '../types.js';
import { BaseCollector } from './base.collector.js';

export class RedditCollector extends BaseCollector {
  name = 'Reddit';
  private parser: Parser;

  constructor() {
    super();
    this.parser = new Parser({
      headers: {
        'User-Agent': 'LeadRadarBot/1.0 by devora'
      }
    });
  }

  async fetchLeads(): Promise<RawLead[]> {
    const leads: RawLead[] = [];

    for (const feed of SOURCES_CONFIG.REDDIT_FEEDS) {
      try {
        const feedData = await this.parser.parseURL(feed.url);

        for (const item of feedData.items || []) {
          if (!item.link || !item.title) continue;

          const title = item.title;
          // Игнорируем посты других фрилансеров [For Hire], берем только работодателей [Hiring]
          if (/\[for hire\]/i.test(title)) continue;
          if (!/\[hiring\]/i.test(title) && !/hiring/i.test(title)) continue;

          const content = item.content || item.contentSnippet || '';

          // Поиск бюджета в посте (например, $25/hr, $500, etc.)
          const budgetMatch = content.match(/\$\d+[\d,]*(?:\s*-\s*\$\d+[\d,]*)?(?:\/(?:hr|hour|project))?/i) ||
                              title.match(/\$\d+[\d,]*(?:\s*-\s*\$\d+[\d,]*)?(?:\/(?:hr|hour|project))?/i);
          const rawBudget = budgetMatch ? budgetMatch[0].trim() : undefined;

          leads.push({
            id: item.id || item.link,
            source: 'Reddit',
            title: this.cleanText(title),
            url: item.link,
            description: this.cleanText(content),
            budget: rawBudget,
            postedAt: item.pubDate ? new Date(item.pubDate) : new Date()
          });
        }
      } catch (error: any) {
        console.warn(`[RedditCollector] Ошибка загрузки фида ${feed.name}:`, error.message);
      }
    }

    return leads;
  }
}
