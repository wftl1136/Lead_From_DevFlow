import fs from 'node:fs';
import path from 'node:path';
import { AnalyzedLead } from '../types.js';

export interface FeedbackRecord {
  leadId: string;
  source: string;
  title: string;
  summary: string;
  pitch: string;
  stackMatches: string[];
  verdict: 'good' | 'bad';
  reason?: string;
  timestamp: string;
}

export interface GoldPitch {
  title: string;
  summary: string;
  pitch: string;
  stack: string[];
  language: string;
  savedAt: string;
}

export interface DiscoveredSource {
  name: string;
  url: string;
  type: 'rss' | 'reddit' | 'board';
  discoveredAt: string;
  active: boolean;
}

export class LearningStorage {
  private dataDir: string;
  private feedbackFile: string;
  private goldPitchesFile: string;
  private stopWordsFile: string;
  private sourcesFile: string;

  // Кэш в памяти
  private recentLeadsMap: Map<string, AnalyzedLead> = new Map();
  private dynamicStopWords: Set<string> = new Set();
  private goldPitches: GoldPitch[] = [];
  private dynamicSources: DiscoveredSource[] = [];

  constructor(dataDir: string = './data') {
    this.dataDir = dataDir;
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }

    this.feedbackFile = path.join(this.dataDir, 'learning_feedback.jsonl');
    this.goldPitchesFile = path.join(this.dataDir, 'gold_pitches.json');
    this.stopWordsFile = path.join(this.dataDir, 'dynamic_stop_words.json');
    this.sourcesFile = path.join(this.dataDir, 'dynamic_sources.json');

    this.loadAll();
  }

  private loadAll(): void {
    // 1. Загрузка динамических стоп-слов
    try {
      if (fs.existsSync(this.stopWordsFile)) {
        const raw = fs.readFileSync(this.stopWordsFile, 'utf-8');
        const words = JSON.parse(raw);
        if (Array.isArray(words)) {
          this.dynamicStopWords = new Set(words.map(w => String(w).toLowerCase().trim()));
        }
      }
    } catch (err) {
      console.error('[LearningStorage] Ошибка загрузки стоп-слов:', err);
    }

    // 2. Загрузка золотых питчей
    try {
      if (fs.existsSync(this.goldPitchesFile)) {
        const raw = fs.readFileSync(this.goldPitchesFile, 'utf-8');
        const pitches = JSON.parse(raw);
        if (Array.isArray(pitches)) {
          this.goldPitches = pitches;
        }
      }
    } catch (err) {
      console.error('[LearningStorage] Ошибка загрузки золотых питчей:', err);
    }

    // 3. Загрузка динамических источников
    try {
      if (fs.existsSync(this.sourcesFile)) {
        const raw = fs.readFileSync(this.sourcesFile, 'utf-8');
        const sources = JSON.parse(raw);
        if (Array.isArray(sources)) {
          this.dynamicSources = sources;
        }
      }
    } catch (err) {
      console.error('[LearningStorage] Ошибка загрузки динамических источников:', err);
    }
  }

  public static getShortId(id: string): string {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = (hash << 5) - hash + id.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(36).slice(0, 10);
  }

  /**
   * Сохраняет лид во временный буфер, чтобы пользователь мог оценить его по ID в Telegram
   */
  public cacheRecentLead(lead: AnalyzedLead): string {
    const shortId = LearningStorage.getShortId(lead.id);
    this.recentLeadsMap.set(shortId, lead);
    this.recentLeadsMap.set(lead.id, lead);

    // Ограничиваем размер кэша последних 300 заказов
    if (this.recentLeadsMap.size > 600) {
      const firstKey = this.recentLeadsMap.keys().next().value;
      if (firstKey) this.recentLeadsMap.delete(firstKey);
    }
    return shortId;
  }

  public getLeadById(leadId: string): AnalyzedLead | undefined {
    return this.recentLeadsMap.get(leadId);
  }

  /**
   * Сохраняет обратную связь (RLHF) от пользователя
   */
  public recordFeedback(leadId: string, verdict: 'good' | 'bad', reason?: string): { success: boolean; lead?: AnalyzedLead } {
    const lead = this.getLeadById(leadId);
    const feedback: FeedbackRecord = {
      leadId,
      source: lead?.source || 'Unknown',
      title: lead?.title || 'Без названия',
      summary: lead?.summary || '',
      pitch: lead?.pitch || '',
      stackMatches: lead?.stackMatches || [],
      verdict,
      reason,
      timestamp: new Date().toISOString()
    };

    try {
      fs.appendFileSync(this.feedbackFile, JSON.stringify(feedback) + '\n', 'utf-8');

      if (verdict === 'good' && lead && lead.pitch) {
        // Добавляем в золотой фонд питчей
        this.addGoldPitch({
          title: lead.title,
          summary: lead.summary || lead.title,
          pitch: lead.pitch,
          stack: lead.stackMatches,
          language: lead.language || 'en',
          savedAt: new Date().toISOString()
        });
      } else if (verdict === 'bad' && lead) {
        // Автоматически извлекаем негативные сигналы
        this.extractNegativeSignals(lead, reason);
      }

      return { success: true, lead };
    } catch (err) {
      console.error('[LearningStorage] Ошибка записи feedback:', err);
      return { success: false, lead };
    }
  }

  /**
   * Добавляет идеальный питч в память Few-Shot
   */
  public addGoldPitch(pitch: GoldPitch): void {
    const exists = this.goldPitches.some(p => p.title === pitch.title || p.pitch === pitch.pitch);
    if (!exists) {
      this.goldPitches.unshift(pitch);
      if (this.goldPitches.length > 50) {
        this.goldPitches = this.goldPitches.slice(0, 50);
      }
      try {
        fs.writeFileSync(this.goldPitchesFile, JSON.stringify(this.goldPitches, null, 2), 'utf-8');
      } catch (err) {
        console.error('[LearningStorage] Ошибка сохранения gold_pitches:', err);
      }
    }
  }

  /**
   * Возвращает наиболее подходящие примеры золотых питчей под требуемый стек
   */
  public getGoldExamples(stack: string[] = [], limit: number = 2): GoldPitch[] {
    if (this.goldPitches.length === 0) return [];

    const stackLower = stack.map(s => s.toLowerCase());
    const scored = this.goldPitches.map(p => {
      let score = 0;
      for (const tech of p.stack) {
        if (stackLower.includes(tech.toLowerCase())) score += 2;
      }
      return { pitch: p, score };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, limit).map(s => s.pitch);
  }

  /**
   * Добавляет динамическое стоп-слово
   */
  public addDynamicStopWord(word: string): void {
    const clean = word.toLowerCase().trim();
    if (clean.length > 3 && !this.dynamicStopWords.has(clean)) {
      this.dynamicStopWords.add(clean);
      try {
        fs.writeFileSync(this.stopWordsFile, JSON.stringify(Array.from(this.dynamicStopWords), null, 2), 'utf-8');
        console.log(`🧠 [Self-Learning] Выучено новое стоп-слово: "${clean}"`);
      } catch (err) {
        console.error('[LearningStorage] Ошибка сохранения стоп-слов:', err);
      }
    }
  }

  public getDynamicStopWords(): string[] {
    return Array.from(this.dynamicStopWords);
  }

  /**
   * Добавляет найденный новый источник
   */
  public addDiscoveredSource(source: DiscoveredSource): boolean {
    const exists = this.dynamicSources.some(s => s.url === source.url);
    if (exists) return false;

    this.dynamicSources.push(source);
    try {
      fs.writeFileSync(this.sourcesFile, JSON.stringify(this.dynamicSources, null, 2), 'utf-8');
      console.log(`📡 [Discovery Engine] Добавлен новый проверенный источник: ${source.name} (${source.url})`);
      return true;
    } catch (err) {
      console.error('[LearningStorage] Ошибка сохранения источников:', err);
      return false;
    }
  }

  public getActiveDiscoveredSources(): DiscoveredSource[] {
    return this.dynamicSources.filter(s => s.active);
  }

  private extractNegativeSignals(lead: AnalyzedLead, explicitReason?: string): void {
    if (explicitReason) {
      this.addDynamicStopWord(explicitReason);
    }
    // Проверяем частые нерелевантные ключевые фразы в названии
    const titleLower = lead.title.toLowerCase();
    const suspectPhrases = [
      'монтаж', 'reels', 'shorts', 'tiktok', 'дизайн лого', '3d', 'blender',
      'копирайт', 'статьи', 'таргет', 'smm', 'озвучка', 'диктор', 'визитка', 'баннер'
    ];
    for (const phrase of suspectPhrases) {
      if (titleLower.includes(phrase)) {
        this.addDynamicStopWord(phrase);
      }
    }
  }
}

export const learningStorage = new LearningStorage();
