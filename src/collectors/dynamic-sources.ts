import axios from 'axios';
import Parser from 'rss-parser';
import { learningStorage } from '../evolution/learning-storage.js';
import { RawLead } from '../types.js';
import { BaseCollector } from './base.collector.js';

export class DynamicSourcesCollector extends BaseCollector {
  name = 'Dynamic Sources (Tavily Discovered)';
  private parser: Parser;

  constructor() {
    super();
    this.parser = new Parser();
  }

  async fetchLeads(): Promise<RawLead[]> {
    const leads: RawLead[] = [];
    const activeSources = learningStorage.getActiveDiscoveredSources();

    if (activeSources.length === 0) {
      return leads;
    }

    for (const source of activeSources) {
      try {
        const response = await axios.get(source.url, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
            'Accept': 'application/atom+xml,application/xml,text/xml;q=0.9,*/*;q=0.8'
          },
          timeout: 15000,
          maxRedirects: 5
        });

        const feedData = await this.parser.parseString(response.data);

        for (const item of feedData.items || []) {
          if (!item.link || !item.title) continue;

          // Игнорируем соискателей
          if (/\[for hire\]/i.test(item.title)) continue;

          const content = item.content || item.contentSnippet || '';
          const budgetMatch = content.match(/\$\d+[\d,]*(?:\s*-\s*\$\d+[\d,]*)?(?:\/(?:hr|hour|project))?/i);
          const rawBudget = budgetMatch ? budgetMatch[0].trim() : undefined;

          leads.push({
            id: item.id || item.link,
            source: source.name,
            title: this.cleanText(item.title),
            url: item.link,
            description: this.cleanText(content),
            budget: rawBudget,
            postedAt: item.pubDate ? new Date(item.pubDate) : new Date()
          });
        }
      } catch (err: any) {
        // Если фид перестал отвечать, не ломаем цикл
        console.warn(`[DynamicSourcesCollector] Ошибка фида ${source.name}:`, err?.message);
      }
    }

    return leads;
  }
}
