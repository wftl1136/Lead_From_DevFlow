import axios from 'axios';
import { RawLead } from '../types.js';
import { BaseCollector } from './base.collector.js';

export class HackerNewsCollector extends BaseCollector {
  name = 'Hacker News (Freelancer)';

  async fetchLeads(): Promise<RawLead[]> {
    const leads: RawLead[] = [];

    try {
      // Поиск по открытому Algolia API по комментариям в тредах найма
      const queries = ['seeking freelancer', 'wordpress', 'react website', 'frontend freelancer'];

      for (const query of queries) {
        const res = await axios.get('https://hn.algolia.com/api/v1/search_by_date', {
          params: {
            query,
            tags: 'comment',
            hitsPerPage: 10
          },
          timeout: 10000
        });

        for (const hit of res.data?.hits || []) {
          if (!hit.comment_text || hit.comment_text.length < 50) continue;

          // Игнорируем соискателей [FREELANCER FOR HIRE], берем только работодателей [SEEKING FREELANCER] или клиентов
          const text = hit.comment_text.toLowerCase();
          if (text.includes('seeking work') || text.includes('available for hire') || text.includes('freelancer for hire')) {
            continue;
          }

          const cleanText = this.cleanText(hit.comment_text);
          const title = `[HN] ${cleanText.slice(0, 80)}...`;
          const url = `https://news.ycombinator.com/item?id=${hit.objectID}`;

          leads.push({
            id: `hn-${hit.objectID}`,
            source: 'Hacker News',
            title,
            url,
            description: cleanText,
            country: 'US / Global 🌍',
            postedAt: new Date(hit.created_at)
          });
        }
      }
    } catch (err: any) {
      console.warn('[HackerNewsCollector] Ошибка загрузки:', err.message);
    }

    return leads;
  }
}
