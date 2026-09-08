import fs from 'node:fs';
import path from 'node:path';
import { telegramNotifier } from '../telegram/notifier.js';
import { discoveryEngine } from './discovery-engine.js';
import { learningStorage } from './learning-storage.js';

export class ReflectionEngine {
  private isRunning: boolean = false;

  /**
   * Запускает полный цикл самообучения и рефлексии
   */
  public async runEvolutionCycle(): Promise<string> {
    if (this.isRunning) return 'Цикл эволюции уже выполняется';
    this.isRunning = true;

    try {
      console.log('🧠 [Reflection Engine] Старт ежедневного цикла самообучения...');

      // 1. Анализ пользовательской обратной связи (RLHF)
      const feedbackStats = this.analyzeFeedback();

      // 2. Автономный поиск новых источников через Tavily
      const newSources = await discoveryEngine.discoverNewSources();

      // 3. Формирование отчета об эволюции
      const goldCount = learningStorage.getGoldExamples([], 999).length;
      const stopWords = learningStorage.getDynamicStopWords();
      const activeSources = learningStorage.getActiveDiscoveredSources();

      const report = `🧠 <b>ОТЧЕТ САМООБУЧЕНИЯ LEADRADAR AI</b>

📊 <b>Обучение на обратной связи (RLHF):</b>
• Одобрено эталонных откликов (Gold Pitches): <b>${goldCount}</b>
• Всего пользовательских реакций: <b>${feedbackStats.total}</b> (🔥 ${feedbackStats.good} / 💩 ${feedbackStats.bad})
• Выучено новых динамических стоп-слов: <b>${stopWords.length}</b>

📡 <b>Автономная разведка (Tavily Engine):</b>
• Найдено новых подтвержденных источников: <b>${newSources.length}</b>
• Всего динамических источников в работе: <b>${activeSources.length}</b>
${newSources.length > 0 ? newSources.map(s => `  • ➕ <i>${s.name}</i>`).join('\n') : '  • Новые источники проверены и актуальны'}

🎯 <b>Калибровка точности:</b>
• Индивидуальный стиль откликов (Few-Shot): <b>${goldCount > 0 ? 'АКТИВЕН' : 'Ожидает первых 🔥'}</b>
• Автоматический отсев спама: <b>АКТИВЕН</b>

<i>Бот стал точнее понимать ваши требования и готов к новым поискам!</i>`;

      // 4. Отправка отчета в Telegram
      await telegramNotifier.sendAlert(report);
      return report;
    } finally {
      this.isRunning = false;
    }
  }

  private analyzeFeedback(): { total: number; good: number; bad: number } {
    const feedbackFile = path.join('./data', 'learning_feedback.jsonl');
    let total = 0;
    let good = 0;
    let bad = 0;

    if (!fs.existsSync(feedbackFile)) {
      return { total: 0, good: 0, bad: 0 };
    }

    try {
      const lines = fs.readFileSync(feedbackFile, 'utf-8').split('\n').filter(l => l.trim() !== '');
      for (const line of lines) {
        const item = JSON.parse(line);
        total++;
        if (item.verdict === 'good') good++;
        if (item.verdict === 'bad') bad++;
      }
    } catch {}

    return { total, good, bad };
  }
}

export const reflectionEngine = new ReflectionEngine();
