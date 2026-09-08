import Parser from 'rss-parser';
import { RawLead } from '../types.js';
import { BaseCollector } from './base.collector.js';

export class DjinniCollector extends BaseCollector {
  name = 'Djinni.co (UA / Global Remote)';
  private parser: Parser;

  private feeds = [
    { name: 'Djinni WordPress', url: 'https://djinni.co/jobs/rss/?primary_keyword=WordPress' },
    { name: 'Djinni React.js', url: 'https://djinni.co/jobs/rss/?primary_keyword=React.js' },
    { name: 'Djinni Node.js', url: 'https://djinni.co/jobs/rss/?primary_keyword=Node.js' },
    { name: 'Djinni Part-time / Contract', url: 'https://djinni.co/jobs/rss/?employment=parttime' }
  ];

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

    for (const feed of this.feeds) {
      try {
        const feedData = await this.parser.parseURL(feed.url);

        for (const item of feedData.items || []) {
          if (!item.link || !item.title) continue;

          const content = item.content || item.contentSnippet || '';
          
          // Извлечение зарплатной вилки или бюджета (например, $1500 - $3000 или $30/hr)
          const salaryMatch = item.title.match(/\$[\d,]+(?:\s*-\s*\$[\d,]+)?/i) ||
                              content.match(/\$[\d,]+(?:\s*-\s*\$[\d,]+)?/i);
          const rawBudget = salaryMatch ? salaryMatch[0].trim() : undefined;

          leads.push({
            id: item.guid || item.link,
            source: 'Djinni.co',
            title: this.cleanText(item.title),
            url: item.link,
            description: this.cleanText(content),
            budget: rawBudget,
            country: 'Ukraine / Remote 🌍',
            currency: 'USD',
            postedAt: item.pubDate ? new Date(item.pubDate) : new Date()
          });
        }
      } catch (error: any) {
        console.warn(`[DjinniCollector] Ошибка загрузки фида ${feed.name}:`, error.message);
      }
    }

    return leads;
  }
}
