import Parser from 'rss-parser';
import { SOURCES_CONFIG } from '../../config/sources.config.js';
import { RawLead } from '../types.js';
import { BaseCollector } from './base.collector.js';

export class UpworkCollector extends BaseCollector {
  name = 'Upwork';
  private parser: Parser;

  constructor() {
    super();
    this.parser = new Parser({
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*'
      }
    });
  }

  async fetchLeads(): Promise<RawLead[]> {
    const leads: RawLead[] = [];
    const feedsToFetch = [...SOURCES_CONFIG.UPWORK_FEEDS];

    // Если пользователь указал свой персональный RSS-фид Upwork (с токеном)
    if (process.env.UPWORK_CUSTOM_FEED_URL) {
      feedsToFetch.unshift({
        name: 'Upwork Custom Feed (с токеном)',
        url: process.env.UPWORK_CUSTOM_FEED_URL
      });
    }

    for (const feed of feedsToFetch) {
      try {
        const feedData = await this.parser.parseURL(feed.url);

        for (const item of feedData.items || []) {
          if (!item.link || !item.title) continue;

          const content = item.content || item.contentSnippet || '';
          const budgetMatch = content.match(/<b>Budget<\/b>:\s*([^<]+)/i) || 
                              content.match(/<b>Hourly Range<\/b>:\s*([^<]+)/i);
          const countryMatch = content.match(/<b>Country<\/b>:\s*([^<]+)/i);

          const rawBudget = budgetMatch ? budgetMatch[1].trim() : undefined;
          const country = countryMatch ? countryMatch[1].trim() : undefined;

          const cleanedDesc = this.cleanText(content.split('<br /><br /><b>')[0] || content);

          leads.push({
            id: item.guid || item.link,
            source: 'Upwork',
            title: this.cleanText(item.title),
            url: item.link,
            description: cleanedDesc,
            budget: rawBudget,
            country: country,
            postedAt: item.pubDate ? new Date(item.pubDate) : new Date()
          });
        }
      } catch (error: any) {
        // Логируем только если это пользовательский фид или в режиме отладки
        if (feed.name.includes('Custom')) {
          console.warn(`[UpworkCollector] Ошибка пользовательского фида:`, error.message);
        }
      }
    }

    return leads;
  }
}
