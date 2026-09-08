import axios from 'axios';
import { LearningStorage } from '../evolution/learning-storage.js';
import { AnalyzedLead } from '../types.js';

export class TelegramNotifier {
  private botToken: string;
  private chatId: string;

  constructor() {
    this.botToken = process.env.TELEGRAM_BOT_TOKEN || '';
    this.chatId = process.env.TELEGRAM_CHAT_ID || '';
  }

  public async sendLead(lead: AnalyzedLead): Promise<boolean> {
    if (!this.botToken || !this.chatId) {
      console.error('[Telegram] Не задан TELEGRAM_BOT_TOKEN или TELEGRAM_CHAT_ID');
      return false;
    }

    const message = this.formatLeadHtml(lead);
    const shortId = LearningStorage.getShortId(lead.id);

    try {
      await this.sendWithRetry({
        chat_id: this.chatId,
        text: message,
        parse_mode: 'HTML',
        disable_web_page_preview: false,
        reply_markup: {
          inline_keyboard: [
            [
              {
                text: '🔗 Открыть заказ на ' + lead.source,
                url: lead.url
              }
            ],
            [
              {
                text: '🔥 Топ заказ (В базу)',
                callback_data: `fb_g:${shortId}`
              },
              {
                text: '💩 Не то / Спам',
                callback_data: `fb_b:${shortId}`
              }
            ],
            [
              {
                text: '📊 Статистика',
                callback_data: 'get_stats'
              },
              {
                text: '🧠 Самообучение',
                callback_data: 'run_evolve'
              }
            ]
          ]
        }
      });
      return true;
    } catch (error: any) {
      console.warn('[Telegram] Ошибка HTML отправки, пробую резервный plain text:', error?.response?.data || error.message);
      try {
        const plainText = this.formatLeadPlain(lead);
        await this.sendWithRetry({
          chat_id: this.chatId,
          text: plainText,
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔗 Открыть заказ', url: lead.url }],
              [{ text: '📊 Статистика фильтрации', callback_data: 'get_stats' }]
            ]
          }
        });
        return true;
      } catch (fallbackError) {
        console.error('[Telegram] Ошибка резервной отправки:', fallbackError);
        return false;
      }
    }
  }

  public async sendAlert(text: string): Promise<boolean> {
    if (!this.botToken || !this.chatId) return false;
    try {
      await this.sendWithRetry({
        chat_id: this.chatId,
        text,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '📊 Статистика фильтрации', callback_data: 'get_stats' },
              { text: '🔄 Сканировать сейчас', callback_data: 'run_scan' }
            ]
          ]
        }
      });
      return true;
    } catch {
      return false;
    }
  }

  private async sendWithRetry(payload: any, maxRetries = 4): Promise<any> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await axios.post(`https://api.telegram.org/bot${this.botToken}/sendMessage`, payload);
      } catch (err: any) {
        if (err?.response?.status === 429) {
          const retryAfter = (err.response.data?.parameters?.retry_after || 3) + 2;
          console.warn(`[Telegram] 429 Too Many Requests, пауза на ${retryAfter}с...`);
          await new Promise(r => setTimeout(r, retryAfter * 1000));
          continue;
        }
        if (attempt === maxRetries) throw err;
      }
    }
  }

  private escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  private formatLeadHtml(lead: AnalyzedLead): string {
    const title = this.escapeHtml(lead.title);
    const budget = this.escapeHtml(lead.budget || 'Не указан');
    const country = lead.country ? ` | 🌍 ${this.escapeHtml(lead.country)}` : '';
    const stack = lead.stackMatches.map(s => `<code>${this.escapeHtml(s)}</code>`).join(' ');
    const summary = this.escapeHtml(lead.summary);
    const pitch = this.escapeHtml(lead.pitch);
    const description = this.escapeHtml(lead.description);
    const url = this.escapeHtml(lead.url);

    const summaryLabel = lead.language === 'en' 
      ? '📋 <b>Краткая суть заказа (перевод на русский):</b>' 
      : '📋 <b>Краткая суть заказа:</b>';

    return `🎯 <b>[${lead.source}] ${title}</b>

⭐️ <b>Релевантность:</b> ${lead.score}/10
📌 <b>Тип:</b> ${lead.projectType}
💰 <b>Бюджет:</b> ${budget}${country}
🛠 <b>Стек:</b> ${stack}

${summaryLabel}
${summary}

💡 <b>Индивидуальный отклик под клиента (на языке заказа):</b>
<blockquote>${pitch}</blockquote>

📄 <b>Оригинальный текст заказа:</b>
<blockquote>${description}</blockquote>

🔗 <b>Ссылка на заказ:</b> <a href="${url}">${url}</a>`;
  }

  private formatLeadPlain(lead: AnalyzedLead): string {
    return `🎯 [${lead.source}] ${lead.title}

Релевантность: ${lead.score}/10
Тип: ${lead.projectType}
Бюджет: ${lead.budget || 'Не указан'}
Стек: ${lead.stackMatches.join(', ')}

Краткая суть заказа (перевод):
${lead.summary}

Индивидуальный отклик:
${lead.pitch}

Оригинальный текст:
${lead.description}

Ссылка на заказ:
${lead.url}`;
  }
}

export const telegramNotifier = new TelegramNotifier();
