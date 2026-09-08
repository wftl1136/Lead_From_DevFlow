import axios from 'axios';
import Parser from 'rss-parser';
import { SOURCES_CONFIG } from '../../config/sources.config.js';
import { RawLead } from '../types.js';
import { BaseCollector } from './base.collector.js';

export class RedditCollector extends BaseCollector {
  name = 'Reddit';
  private parser: Parser;

  constructor() {
    super();
    this.parser = new Parser();
  }

  async fetchLeads(): Promise<RawLead[]> {
    const leads: RawLead[] = [];

    for (const feed of SOURCES_CONFIG.REDDIT_FEEDS) {
      try {
        const response = await axios.get(feed.url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
            'Accept': 'application/atom+xml,application/xml,text/xml;q=0.9,*/*;q=0.8'
          },
          timeout: 15000,
          maxRedirects: 5
        });

        const feedData = await this.parser.parseString(response.data);

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

        // Пауза между запросами к Reddit для защиты от 429
        await new Promise(r => setTimeout(r, 2000));
      } catch (error: any) {
        if (error?.response?.status === 429) {
          console.warn(`[RedditCollector] Reddit временно ограничил частые запросы (429) для ${feed.name}, пропуск до следующего цикла.`);
        } else {
          console.warn(`[RedditCollector] Ошибка загрузки фида ${feed.name}:`, error.message);
        }
      }
    }

    return leads;
  }
}
