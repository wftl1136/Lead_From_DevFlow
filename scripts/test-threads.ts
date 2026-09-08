import puppeteer from 'puppeteer-core';

async function testThreads() {
  console.log('Запуск Chromium для тестирования поиска Threads...');
  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--lang=uk-UA,uk']
  });

  try {
    const page = await browser.newPage();
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36');
    await page.setViewport({ width: 1280, height: 800 });

    const query = encodeURIComponent('потрібен сайт');
    console.log(`Переход на https://www.threads.net/search?q=${query}...`);
    await page.goto(`https://www.threads.net/search?q=${query}`, { waitUntil: 'networkidle2', timeout: 30000 });

    // Обработка баннера cookies
    const cookieBtns = await page.$$('div[role="button"]');
    for (const btn of cookieBtns) {
      const text = await page.evaluate(el => el.textContent, btn);
      if (text && (text.includes('cookie') || text.includes('куки') || text.includes('Разрешить') || text.includes('Дозволити'))) {
        await btn.click().catch(() => {});
        break;
      }
    }

    await new Promise(r => setTimeout(r, 4000));

    // Поиск постов
    const posts = await page.evaluate(() => {
      const results: { text: string; url?: string }[] = [];
      const spans = document.querySelectorAll('span[dir="auto"]');
      spans.forEach(span => {
        const text = (span.textContent || '').trim();
        if (text.length > 30 && (text.toLowerCase().includes('сайт') || text.toLowerCase().includes('розробк'))) {
          const link = span.closest('div')?.parentElement?.querySelector('a[href*="/post/"]') as HTMLAnchorElement;
          results.push({
            text: text.slice(0, 200),
            url: link ? link.href : undefined
          });
        }
      });
      return results;
    });

    console.log(`Найдено постов в Threads: ${posts.length}`);
    posts.slice(0, 3).forEach(p => console.log(`- ${p.text} (URL: ${p.url || 'N/A'})`));
  } catch (err: any) {
    console.error('Ошибка Threads:', err.message);
  } finally {
    await browser.close();
  }
}

testThreads().catch(console.error);
