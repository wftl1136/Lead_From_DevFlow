import { GoogleGenAI } from '@google/genai';
import { SOURCES_CONFIG } from '../../config/sources.config.js';
import { learningStorage } from '../evolution/learning-storage.js';
import { AnalyzedLead, RawLead } from '../types.js';

export class LeadAnalyzer {
  private ai: GoogleGenAI | null = null;
  private hasApiKey: boolean = false;

  constructor() {
    this.initAi();
  }

  private initAi() {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey && apiKey.trim() !== '') {
      this.ai = new GoogleGenAI({ apiKey });
      this.hasApiKey = true;
    } else {
      this.ai = null;
      this.hasApiKey = false;
    }
  }

  public async analyze(lead: RawLead): Promise<AnalyzedLead> {
    // Проверяем наличие ключа в процессе (если был добавлен в .env)
    if (!this.hasApiKey && process.env.GEMINI_API_KEY) {
      this.initAi();
    }

    let result: AnalyzedLead;
    if (this.hasApiKey && this.ai) {
      try {
        result = await this.analyzeWithGemini(lead);
      } catch (error) {
        console.warn(`[AI Analyzer] Ошибка вызова Gemini API для "${lead.title.slice(0, 30)}":`, error);
        result = this.analyzeWithSmartHeuristics(lead);
      }
    } else {
      result = this.analyzeWithSmartHeuristics(lead);
    }

    // Сохраняем в кэш обучения для интерактивной обратной связи (RLHF)
    learningStorage.cacheRecentLead(result);
    return result;
  }

  /**
   * Анализ с помощью нейросети Google Gemini (глубокая персонализация, перевод и уникальный питч)
   */
  private async analyzeWithGemini(lead: RawLead): Promise<AnalyzedLead> {
    const goldExamples = learningStorage.getGoldExamples([], 2);
    let fewShotSection = '';
    if (goldExamples.length > 0) {
      fewShotSection = `\n\nЭТАЛОННЫЕ ПРИМЕРЫ ПИТЧЕЙ, ОДОБРЕННЫХ РАЗРАБОТЧИКОМ (Используй их стиль и тон):
${goldExamples.map((ex, i) => `[Пример ${i + 1}] Задача: "${ex.summary}" -> Отклик: "${ex.pitch}"`).join('\n')}`;
    }

    const prompt = `Ты — профессиональный ИИ-ассистент опытного веб-разработчика из Украины (3+ года опыта).
Стек разработчика:
- WordPress, WooCommerce, HTML5, CSS3, JavaScript, TypeScript, React, Node.js, Next.js, Elementor, ACF Pro, Gutenberg, Tailwind, REST API, верстка по Figma, багфиксы, ускорение сайтов (PageSpeed).${fewShotSection}

Проанализируй этот заказ на разработку/доработку:
Платформа: ${lead.source}
Заголовок: ${lead.title}
Описание: ${lead.description}
Бюджет: ${lead.budget || 'Не указан'}
Страна клиента: ${lead.country || 'Не указана'}

ТРЕБОВАНИЯ К ОТВЕТУ:
1. "summary": Краткая суть задачи (2-3 предложения) СТРОГО НА РУССКОМ ЯЗЫКЕ. Если заказ на английском языке — обязательно переведи суть проблемы клиента на понятный русский язык!
2. "pitch": Напиши УНИКАЛЬНЫЙ, персонализированный отклик под ЭТОГО конкретного клиента:
   - СТРОГО на языке клиента! (Если заказ на английском — пиши на безупречном деловом английском. Если на украинском/русском — пиши на украинском).
   - НИКАКИХ шаблонных клише ("Hello, I am interested in your project").
   - С первых слов прямо сошлись на проблему клиента из текста (например: "I see your WooCommerce checkout is slowing down after the update...", "Regarding the Next.js API integration...", "Щодо доопрацювання вашого інтернет-магазину на WordPress...").
   - Укажи, как твой 3+ года опыт решает эту проблему, и предложи конкретное решение или первый шаг.
3. "score": Оценка релевантности от 1 до 10.
4. "projectType": одно из ["Сайт с нуля", "Доработка / Багфикс", "Редизайн", "API / Интеграция", "Оптимизация скорости", "Другое"].
5. "stackMatches": массив технологий, упомянутых в задаче.
6. "language": "en" или "ua".

Верни СТРОГИЙ JSON без лишнего текста:
{
  "summary": "Краткая суть на русском (с переводом)",
  "pitch": "Уникальный персонализированный отклик на языке клиента",
  "score": 9,
  "projectType": "Доработка / Багфикс",
  "stackMatches": ["WordPress", "Next.js"],
  "language": "en"
}`;

    const modelsToTry = [
      process.env.GEMINI_MODEL || 'gemini-3.6-flash',
      'gemini-2.5-flash-lite',
      'gemini-2.0-flash'
    ];

    let response = null;
    let lastError = null;

    for (const model of modelsToTry) {
      try {
        response = await this.ai!.models.generateContent({
          model,
          contents: prompt,
          config: {
            responseMimeType: 'application/json'
          }
        });
        if (response) break;
      } catch (err: any) {
        lastError = err;
        const msg = String(err?.message || '');
        if (msg.includes('404') || msg.includes('not found') || msg.includes('is no longer available')) {
          console.warn(`[AI Analyzer] Модель ${model} недоступна, пробуем альтернативную...`);
          continue;
        }
        throw err;
      }
    }

    if (!response) {
      throw lastError || new Error('Все модели Gemini вернули ошибку');
    }

    const text = response.text || '{}';
    const parsed = JSON.parse(text);

    return {
      ...lead,
      score: typeof parsed.score === 'number' ? parsed.score : 8,
      stackMatches: Array.isArray(parsed.stackMatches) && parsed.stackMatches.length > 0 ? parsed.stackMatches : ['Web Development'],
      projectType: parsed.projectType || 'Доработка / Багфикс',
      summary: parsed.summary || lead.title,
      pitch: parsed.pitch || this.generateDynamicPitch(lead, this.isCyrillic(lead.description) ? 'ua' : 'en'),
      language: parsed.language || (this.isCyrillic(lead.description) ? 'ua' : 'en'),
      reason: 'Gemini AI персональный анализ'
    };
  }

  /**
   * Умный динамический генератор отклика и перевода (когда API-ключ еще не задан)
   */
  private analyzeWithSmartHeuristics(lead: RawLead): AnalyzedLead {
    const rawText = `${lead.title} ${lead.description}`;
    const textLower = rawText.toLowerCase();
    const isUa = this.isCyrillic(rawText);
    const lang = isUa ? 'ua' : 'en';

    // 1. Поиск конкретных технологий
    const matches: string[] = [];
    const skills = [
      'Next.js', 'WordPress', 'WooCommerce', 'React', 'TypeScript', 'Node.js',
      'Elementor', 'ACF Pro', 'Tailwind', 'HTML5', 'CSS3', 'REST API', 'Figma'
    ];

    for (const skill of skills) {
      if (textLower.includes(skill.toLowerCase())) {
        matches.push(skill);
      }
    }

    // 2. Определение типа
    let projectType: AnalyzedLead['projectType'] = 'Доработка / Багфикс';
    if (textLower.includes('from scratch') || textLower.includes('new website') || textLower.includes('під ключ') || textLower.includes('под ключ') || textLower.includes('створен')) {
      projectType = 'Сайт с нуля';
    } else if (textLower.includes('redesign') || textLower.includes('редизайн')) {
      projectType = 'Редизайн';
    } else if (textLower.includes('speed') || textLower.includes('pagespeed') || textLower.includes('швидк')) {
      projectType = 'Оптимизация скорости';
    } else if (textLower.includes('api') || textLower.includes('integration') || textLower.includes('інтеграц')) {
      projectType = 'API / Интеграция';
    }

    // 3. Формирование перевода и краткой сути
    let summary = '';
    if (!isUa) {
      // Англоязычный лид - переводим суть на русский
      summary = this.translateEnglishSummary(lead.title, lead.description, matches, projectType);
    } else {
      // Украино/русскоязычный лид
      summary = lead.title.replace(/^\[[^\]]+\]\s*/, '').trim();
      if (lead.description && lead.description.length > 20 && lead.description !== lead.title) {
        summary += `. Детали: ${lead.description.slice(0, 140)}...`;
      }
    }

    // 4. Генерация УНИКАЛЬНОГО отклика под задачу лида на его языке
    const pitch = this.generateDynamicPitch(lead, lang, matches, projectType);

    return {
      ...lead,
      score: matches.length > 0 ? 8 + Math.min(matches.length, 2) : 7,
      stackMatches: matches.length > 0 ? matches : ['Веб-разработка', 'Frontend / Backend'],
      projectType,
      summary,
      pitch,
      language: lang,
      reason: `Стек: ${matches.join(', ')}. Тип: ${projectType}`
    };
  }

  /**
   * Формирует перевод англоязычной сути задачи на русский
   */
  private translateEnglishSummary(title: string, desc: string, stack: string[], type: string): string {
    const combined = `${title} ${desc}`.toLowerCase();
    const stackStr = stack.length > 0 ? stack.join(', ') : 'веб-разработке';

    if (combined.includes('fix') || combined.includes('issue') || combined.includes('bug') || combined.includes('broken')) {
      return `Клиенту требуется устранить неполадки/ошибки в работе сайта (${stackStr}). Задача включает аудит проблемы и внесение исправлений.`;
    }
    if (combined.includes('speed') || combined.includes('slow') || combined.includes('optimize') || combined.includes('performance')) {
      return `Клиент ищет специалиста для оптимизации скорости загрузки сайта (PageSpeed / Core Web Vitals) на базе ${stackStr}.`;
    }
    if (combined.includes('build') || combined.includes('create') || combined.includes('new website') || combined.includes('landing')) {
      return `Клиенту требуется разработка нового сайта / лендинга с нуля с использованием ${stackStr}.`;
    }
    if (combined.includes('hiring') || combined.includes('developer needed') || combined.includes('looking for')) {
      return `Заказчик открыл поиск веб-разработчика со знанием ${stackStr} для работы над проектом (${type.toLowerCase()}).`;
    }

    return `Задача по направлению "${type}" с использованием ${stackStr}: ${title.slice(0, 100)}`;
  }

  /**
   * Генерация персонализированного отклика с обращением к деталям заказа
   */
  private generateDynamicPitch(lead: RawLead, lang: 'en' | 'ua', stack: string[] = ['WordPress', 'React'], type: string = 'Разработка'): string {
    const cleanTitle = lead.title.replace(/^\[[^\]]+\]\s*/, '').replace(/[@_]/g, '').trim().slice(0, 60);
    const stackName = stack[0] || 'WordPress & React';

    if (lang === 'ua') {
      if (type.includes('Багфикс') || type.includes('Доработка')) {
        return `Вітаю! Побачив ваше завдання щодо "${cleanTitle}". Маю понад 3 роки щоденного досвіду роботи з ${stackName} та усунення подібних проблем. Можу переглянути код/адмінку та оперативно реалізувати всі необхідні доопрацювання з чистим результатом. Коли вам зручно вийти на зв'язок?`;
      }
      if (type.includes('С нуля')) {
        return `Вітаю! Ознайомився з вашим проєктом створення сайту ("${cleanTitle}"). Розробляю веб-сайти понад 3 роки (стек: ${stack.join(', ')}), роблю швидку адаптивну верстку, зручну панель керування та оптимізацію під мобільні пристрої. Готовий оцінити терміни та запропонувати оптимальне рішення!`;
      }
      return `Вітаю! Маю 3+ роки комерційного досвіду у веб-розробці (${stack.join(', ')}). Готовий взятися за ваш проєкт "${cleanTitle}", гарантую якісний код без затримок. Буду радий обговорити деталі!`;
    }

    // Англоязычный персонализированный отклик
    if (type.includes('Багфикс') || type.includes('Доработка')) {
      return `Hi! I noticed your post regarding "${cleanTitle}". With 3+ years of hands-on experience in ${stackName}, I regularly handle these types of fixes and optimizations without breaking existing site functionality. I'm ready to inspect the details and get this resolved for you right away.`;
    }
    if (type.includes('С нуля')) {
      return `Hi! I reviewed your project for building a new website ("${cleanTitle}"). I've been developing clean, responsive websites using ${stack.join(', ')} for over 3 years. I focus on high page speed, clean architecture, and easy-to-manage structure. Let's discuss your timeline and kick off!`;
    }
    return `Hi! I have 3+ years of professional fullstack web experience specializing in ${stack.join(', ')}. I'm confident I can help you with "${cleanTitle}" efficiently and to a high standard. Let's connect to go over the specifics!`;
  }

  private isCyrillic(str: string): boolean {
    return /[а-яіїєґА-ЯІЇЄҐ]/.test(str);
  }
}

export const leadAnalyzer = new LeadAnalyzer();
