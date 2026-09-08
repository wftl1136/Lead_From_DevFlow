import axios from 'axios';
import Parser from 'rss-parser';
import { learningStorage, DiscoveredSource } from './learning-storage.js';

export class DiscoveryEngine {
  private tavilyApiKey: string;
  private parser: Parser;

  constructor() {
    this.tavilyApiKey = process.env.TAVILY_API_KEY || '';
    this.parser = new Parser();
  }

  /**
   * Запускает автономный цикл поиска новых источников лидов через Tavily Search API
   */
  public async discoverNewSources(): Promise<DiscoveredSource[]> {
    const apiKey = process.env.TAVILY_API_KEY || this.tavilyApiKey || '';
    if (!apiKey) {
      console.warn('[Discovery Engine] TAVILY_API_KEY не задан, поиск пропущен.');
      return [];
    }

    console.log('🔍 [Discovery Engine] Запуск автономного поиска новых площадок и сабреддитов...');
    const discovered: DiscoveredSource[] = [];

    const searchQueries = [
      'site:reddit.com inurl:/r/ hiring web developer OR wordpress OR react',
      'remote web developer contracts RSS feed',
      'freelance web development jobs RSS feed'
    ];

    for (const query of searchQueries) {
      try {
        const response = await axios.post('https://api.tavily.com/search', {
          api_key: apiKey,
          query,
          search_depth: 'basic',
          max_results: 5
        }, { timeout: 20000 });

        const results = response.data?.results || [];

        for (const item of results) {
          const url = item.url;
          if (!url) continue;

          // 1. Проверка Anti-RU
          if (/\.ru|\.by|russia|росси/i.test(url) || /\.ru|\.by|russia|росси/i.test(item.content || '')) {
            continue;
          }

          // 2. Распознавание нового сабреддита Reddit
          const redditMatch = url.match(/reddit\.com\/r\/([a-zA-Z0-9_-]+)/i);
          if (redditMatch) {
            const subreddit = redditMatch[1];
            // Исключаем системные и общие сабреддиты
            const skipSubreddits = ['all', 'popular', 'announcements', 'help', 'forhire', 'freelance_forhire'];
            if (!skipSubreddits.includes(subreddit.toLowerCase())) {
              const rssUrl = `https://www.reddit.com/r/${subreddit}/new.rss`;
              const isValid = await this.testRssFeed(rssUrl);
              if (isValid) {
                const source: DiscoveredSource = {
                  name: `Reddit r/${subreddit}`,
                  url: rssUrl,
                  type: 'reddit',
                  discoveredAt: new Date().toISOString(),
                  active: true
                };
                if (learningStorage.addDiscoveredSource(source)) {
                  discovered.push(source);
                }
              }
            }
            continue;
          }

          // 3. Распознавание прямых RSS-фидов
          if (url.includes('.rss') || url.includes('/feed') || url.includes('/atom')) {
            const isValid = await this.testRssFeed(url);
            if (isValid) {
              const source: DiscoveredSource = {
                name: item.title || new URL(url).hostname,
                url,
                type: 'rss',
                discoveredAt: new Date().toISOString(),
                active: true
              };
              if (learningStorage.addDiscoveredSource(source)) {
                discovered.push(source);
              }
            }
          }
        }
      } catch (err: any) {
        console.warn(`[Discovery Engine] Ошибка поиска по запросу "${query}":`, err?.message);
      }
    }

    console.log(`✅ [Discovery Engine] Поиск завершен. Найдено новых подтвержденных источников: ${discovered.length}`);
    return discovered;
  }

  /**
   * Тестирует RSS-фид на работоспособность
   */
  private async testRssFeed(rssUrl: string): Promise<boolean> {
    try {
      const res = await axios.get(rssUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        timeout: 10000,
        maxRedirects: 5
      });
      const parsed = await this.parser.parseString(res.data);
      return Array.isArray(parsed.items) && parsed.items.length > 0;
    } catch {
      return false;
    }
  }
}

export const discoveryEngine = new DiscoveryEngine();
