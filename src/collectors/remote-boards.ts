import Parser from 'rss-parser';
import { SOURCES_CONFIG } from '../../config/sources.config.js';
import { RawLead } from '../types.js';
import { BaseCollector } from './base.collector.js';

export class RemoteBoardsCollector extends BaseCollector {
  name = 'WeWorkRemotely';
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

    for (const feed of SOURCES_CONFIG.REMOTE_BOARDS_FEEDS) {
      try {
        const feedData = await this.parser.parseURL(feed.url);

        for (const item of feedData.items || []) {
          if (!item.link || !item.title) continue;

          const content = item.content || item.contentSnippet || '';

          leads.push({
            id: item.guid || item.link,
            source: 'WeWorkRemotely',
            title: this.cleanText(item.title),
            url: item.link,
            description: this.cleanText(content),
            postedAt: item.pubDate ? new Date(item.pubDate) : new Date()
          });
        }
      } catch (error: any) {
        console.warn(`[RemoteBoardsCollector] Ошибка загрузки фида ${feed.name}:`, error.message);
      }
    }

    return leads;
  }
}
