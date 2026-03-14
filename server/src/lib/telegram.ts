import { config } from '../config/index.js';
import { logger } from './logger.js';

/**
 * Basic Telegram Bot API wrapper
 */
export class TelegramBot {
  private readonly baseUrl: string;

  constructor() {
    this.baseUrl = `https://api.telegram.org/bot${config.BOT_TOKEN}`;
  }

  private async callApi(method: string, body: any) {
    try {
      const response = await fetch(`${this.baseUrl}/${method}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await response.json() as any;
      if (!data.ok) {
        logger.error(`Telegram API error (${method}): ${data.description}`);
        return null;
      }
      return data.result;
    } catch (err) {
      logger.error(`Telegram API fetch error (${method}):`, err);
      return null;
    }
  }

  /**
   * Generates a Stars invoice link
   */
  async createStarsInvoiceLink(title: string, description: string, payload: string, amount: number) {
    return this.callApi('createInvoiceLink', {
      title,
      description,
      payload,
      currency: 'XTR', // Stars currency code
      prices: [{ label: title, amount }],
      provider_token: '', // Mandatory empty string for Stars
    });
  }

  /**
   * Sets the bot webhook
   */
  async setWebhook(url: string) {
    return this.callApi('setWebhook', { url });
  }
}

export const bot = new TelegramBot();
