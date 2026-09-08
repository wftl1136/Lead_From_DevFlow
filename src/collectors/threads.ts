import fs from 'node:fs';
import puppeteer, { Browser } from 'puppeteer-core';
import { RawLead } from '../types.js';
import { BaseCollector } from './base.collector.js';

export class ThreadsCollector extends BaseCollector {
  name = 'Threads (Meta)';

  private searchQueries = [
    'потрібен сайт',
    'розробка сайту',
    'доробка сайту',
    'need a website',
    'wordpress developer'
  ];

  /**
   * Автоматическое определение пути к Chromium (для Mac или Linux/Docker/Railway)
   */
  private getExecutablePath(): string {
    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      return process.env.PUPPETEER_EXECUTABLE_PATH;
    }

    if (process.platform === 'linux') {
      const candidates = [
        '/usr/bin/chromium',
        '/usr/bin/chromium-browser',
        '/usr/bin/google-chrome-stable'
      ];
      for (const p of candidates) {
        if (fs.existsSync(p)) return p;
      }
      return '/usr/bin/chromium';
    }

    // По умолчанию для macOS
    return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
  }

  async fetchLeads(): Promise<RawLead[]> {
    const leads: RawLead[] = [];
    let browser: Browser | null = null;
    const tempProfile = `/tmp/threads-chrome-${Date.now()}`;
    const executablePath = this.getExecutablePath();

    try {
      browser = await puppeteer.launch({
        executablePath,
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          `--user-data-dir=${tempProfile}`,
          '--disable-blink-features=AutomationControlled',
          '--lang=uk-UA,uk,en-US,en'
        ]
      });

      const page = await browser.newPage();
      await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
      await page.setViewport({ width: 1280, height: 800 });

      for (const query of this.searchQueries) {
        try {
          const url = `https://www.threads.net/search?q=${encodeURIComponent(query)}&filter=recent`;
          await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 12000 });

          const buttons = await page.$$('div[role="button"]');
          for (const btn of buttons) {
            const btnText = await page.evaluate(el => el.textContent || '', btn);
            if (btnText.includes('cookie') || btnText.includes('куки') || btnText.includes('Разрешить') || btnText.includes('Дозволити')) {
              await btn.click().catch(() => {});
              break;
            }
          }

          await new Promise(r => setTimeout(r, 2000));

          const posts = await page.evaluate(() => {
            const results: { url: string; rawText: string; datetime?: string; author?: string }[] = [];
            const articles = document.querySelectorAll('div[data-pressable-container="true"], article');

            for (const art of articles) {
              const link = art.querySelector('a[href*="/post/"]') as HTMLAnchorElement;
              const time = art.querySelector('time') as HTMLElement;
              if (!link) continue;

              let href = link.href.replace('threads.com', 'threads.net').split('?')[0];
              if (href.endsWith('/media')) {
                href = href.replace(/\/media$/, '');
              }

              const innerText = (art as HTMLElement).innerText || art.textContent || '';
              const datetime = time ? time.getAttribute('datetime') || undefined : undefined;

              if (innerText.length > 20 && !results.some(r => r.url === href)) {
                const authorMatch = href.match(/@([^/]+)/);
                const author = authorMatch ? authorMatch[1] : undefined;

                results.push({
                  url: href,
                  rawText: innerText,
                  datetime,
                  author
                });
              }
            }
            return results;
          });

          for (const post of posts) {
            const cleanBody = this.cleanThreadsContent(post.rawText);
            if (!cleanBody || cleanBody.length < 15) continue;

            const firstLine = cleanBody.split('\n')[0].replace(/^[^\wа-яіїєґА-ЯІЇЄҐ]+/, '').trim();
            const titlePrefix = post.author ? `[@${post.author}] ` : '';
            const title = `${titlePrefix}${firstLine.slice(0, 75)}...`;

            const postedAt = post.datetime ? new Date(post.datetime) : undefined;

            leads.push({
              id: post.url,
              source: 'Threads',
              title,
              url: post.url,
              description: cleanBody,
              country: query.includes('потрібен') || query.includes('розробка') ? 'Ukraine 🇺🇦' : 'Global 🌍',
              postedAt
            });
          }
        } catch (queryErr: any) {
          console.warn(`[ThreadsCollector] Ошибка по запросу "${query}":`, queryErr.message);
        }
      }
    } catch (err: any) {
      console.warn(`[ThreadsCollector] Ошибка запуска браузера (${executablePath}):`, err.message);
    } finally {
      if (browser) {
        await browser.close().catch(() => {});
      }
    }

    return leads;
  }

  private cleanThreadsContent(raw: string): string {
    const lines = raw
      .split('\n')
      .map(l => l.trim())
      .filter(Boolean);

    const contentLines: string[] = [];
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^\d+$/.test(line)) continue;
      if (/^\d{1,2}[./]\d{1,2}[./]\d{2,4}$/.test(line)) continue;
      if (['перевести', 'translate', 'ещё', 'more', 'звук выключен', 'поделиться', 'комментировать'].includes(line.toLowerCase())) continue;
      
      contentLines.push(line);
    }

    if (contentLines.length > 1 && !contentLines[0].includes(' ') && contentLines[0].length < 30) {
      contentLines.shift();
    }

    return contentLines.join('\n').trim();
  }
}
