import fs from 'node:fs';
import path from 'node:path';

export interface FilterStats {
  startedAt: string;
  lastScanAt: string | null;
  totalFound: number;
  totalSent: number;
  byReason: {
    nonWeb: number;
    oldLead: number;
    antiRu: number;
    duplicate: number;
  };
  bySource: Record<string, number>;
}

export class StatsTracker {
  private filePath: string;
  private stats: FilterStats;
  private startTimeMs: number = Date.now();

  constructor(storageDir: string = './data') {
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }
    this.filePath = path.join(storageDir, 'filter_stats.json');
    this.stats = this.load();
  }

  private load(): FilterStats {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          return {
            startedAt: parsed.startedAt || new Date().toISOString(),
            lastScanAt: parsed.lastScanAt || null,
            totalFound: Number(parsed.totalFound) || 0,
            totalSent: Number(parsed.totalSent) || 0,
            byReason: {
              nonWeb: Number(parsed.byReason?.nonWeb) || 0,
              oldLead: Number(parsed.byReason?.oldLead) || 0,
              antiRu: Number(parsed.byReason?.antiRu) || 0,
              duplicate: Number(parsed.byReason?.duplicate) || 0
            },
            bySource: parsed.bySource && typeof parsed.bySource === 'object' ? parsed.bySource : {}
          };
        }
      }
    } catch (err) {
      console.error('[StatsTracker] Ошибка загрузки файла статистики:', err);
    }

    return {
      startedAt: new Date().toISOString(),
      lastScanAt: null,
      totalFound: 0,
      totalSent: 0,
      byReason: {
        nonWeb: 0,
        oldLead: 0,
        antiRu: 0,
        duplicate: 0
      },
      bySource: {}
    };
  }

  private save(): void {
    try {
      fs.writeFileSync(this.filePath, JSON.stringify(this.stats, null, 2), 'utf-8');
    } catch (err) {
      console.error('[StatsTracker] Ошибка сохранения статистики:', err);
    }
  }

  public recordLeadFound(source: string): void {
    this.stats.totalFound++;
    this.stats.bySource[source] = (this.stats.bySource[source] || 0) + 1;
    this.save();
  }

  public recordDuplicate(): void {
    this.stats.byReason.duplicate++;
    this.save();
  }

  public recordAntiRu(): void {
    this.stats.byReason.antiRu++;
    this.save();
  }

  public recordOldLead(): void {
    this.stats.byReason.oldLead++;
    this.save();
  }

  public recordNonWeb(): void {
    this.stats.byReason.nonWeb++;
    this.save();
  }

  public recordSent(): void {
    this.stats.totalSent++;
    this.save();
  }

  public recordScanComplete(): void {
    this.stats.lastScanAt = new Date().toISOString();
    this.save();
  }

  public getRawStats(): FilterStats {
    return { ...this.stats };
  }

  public getFormattedReport(maxAgeHours: number = 5): string {
    const totalFiltered =
      this.stats.byReason.nonWeb +
      this.stats.byReason.oldLead +
      this.stats.byReason.antiRu +
      this.stats.byReason.duplicate;

    const uptimeMs = Date.now() - this.startTimeMs;
    const hours = Math.floor(uptimeMs / (1000 * 60 * 60));
    const minutes = Math.floor((uptimeMs % (1000 * 60 * 60)) / (1000 * 60));
    const uptimeStr = hours > 0 ? `${hours} ч ${minutes} мин` : `${minutes} мин`;

    let lastScanStr = 'еще не выполнялось';
    if (this.stats.lastScanAt) {
      const d = new Date(this.stats.lastScanAt);
      lastScanStr = d.toLocaleTimeString('uk-UA', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }

    const sourceLines = Object.entries(this.stats.bySource)
      .sort((a, b) => b[1] - a[1])
      .map(([src, count]) => `  • <b>${src}:</b> ${count.toLocaleString('ru-RU')}`)
      .join('\n');

    return `📊 <b>СТАТИСТИКА ФИЛЬТРАЦИИ ЗАКАЗОВ LEADRADAR</b>

🔢 <b>Всего обработано объявлений:</b> ${this.stats.totalFound.toLocaleString('ru-RU')}
✅ <b>Отправлено целевых лидов:</b> ${this.stats.totalSent.toLocaleString('ru-RU')}
🗑 <b>Всего отсеяно:</b> ${totalFiltered.toLocaleString('ru-RU')}

━━━━━━━━━━━━━━━━━━━━
⛔️ <b>ПРИЧИНЫ И КОЛИЧЕСТВО ОТСЕВА:</b>

1. <b>Не разработка сайтов:</b> ${this.stats.byReason.nonWeb.toLocaleString('ru-RU')}
   <i>(видеомонтаж, дизайн баннеров/логотипов, 3D, SMM, копирайтинг)</i>

2. <b>Старые заказы (> ${maxAgeHours} ч):</b> ${this.stats.byReason.oldLead.toLocaleString('ru-RU')}
   <i>(опубликованы более ${maxAgeHours * 60} минут назад)</i>

3. <b>Anti-RU блокировка:</b> ${this.stats.byReason.antiRu.toLocaleString('ru-RU')}
   <i>(страна РФ/РБ, оплата в рублях ₽/RUB, домены .ru/.by)</i>

4. <b>Дубликаты:</b> ${this.stats.byReason.duplicate.toLocaleString('ru-RU')}
   <i>(повторные посты, уже проверенные в прошлых циклах)</i>

━━━━━━━━━━━━━━━━━━━━
📡 <b>ОБРАБОТАНО ПО ПЛОЩАДКАМ:</b>
${sourceLines || '  • Пока нет данных'}

⏱ <b>Сессия бота:</b> ${uptimeStr}
🔄 <b>Последний скан:</b> ${lastScanStr}`;
  }
}

export const statsTracker = new StatsTracker();
