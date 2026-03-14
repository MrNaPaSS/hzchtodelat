const API_BASE = '/api';

interface RequestOptions {
  method?: string;
  body?: unknown;
  headers?: Record<string, string>;
}

class ApiClient {
  private token: string | null = null;

  setToken(token: string): void {
    this.token = token;
  }

  clearToken(): void {
    this.token = null;
  }

  private async request<T>(endpoint: string, options: RequestOptions = {}): Promise<T> {
    const { method = 'GET', body, headers = {} } = options;

    const requestHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...headers,
    };

    if (this.token) {
      requestHeaders['Authorization'] = `Bearer ${this.token}`;
    }

    const response = await fetch(`${API_BASE}${endpoint}`, {
      method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : undefined,
    });

    const text = await response.text();
    let data;
    try {
      data = text ? JSON.parse(text) : { success: true, data: null };
    } catch (e) {
      throw new ApiError(response.status, 'PARSE_ERROR', 'Invalid JSON response from server');
    }

    if (!response.ok || !data.success) {
      const error = data.error || { code: 'UNKNOWN', message: 'Unknown error' };
      throw new ApiError(response.status, error.code, error.message);
    }

    return data.data;
  }

  // ─── Auth ──────────────────────────────────────────

  async authenticate(initData: string) {
    return this.request<{ token: string; user: any }>('/auth/telegram', {
      method: 'POST',
      body: { initData },
    });
  }

  // ─── Users ─────────────────────────────────────────

  async getMe() {
    return this.request<any>('/users/me');
  }

  async getUser(id: string) {
    return this.request<any>(`/users/${id}`);
  }

  async getLeaderboard(period = 'all', limit = 100) {
    return this.request<any[]>(`/users/leaderboard?period=${period}&limit=${limit}`);
  }

  // ─── Games ─────────────────────────────────────────

  async createGame(settings: any) {
    return this.request<{ gameId: string; password?: string }>('/games', {
      method: 'POST',
      body: settings,
    });
  }

  async listGames() {
    return this.request<any[]>('/games');
  }

  async joinGame(gameId: string, password?: string) {
    return this.request<{ gameId: string }>(`/games/${gameId}/join`, {
      method: 'POST',
      body: password ? { password } : {},
    });
  }

  async quickMatch(settings?: Partial<any>) {
    return this.request<{ gameId: string }>('/games/quick', {
      method: 'POST',
      body: settings || {},
    });
  }

  async playWithBot() {
    return this.request<{ gameId: string }>('/games/bot', {
      method: 'POST',
    });
  }

  // ─── Marketplace ───────────────────────────────────

  async getMarketplace() {
    return this.request<any[]>('/marketplace');
  }

  async buyItem(itemId: string) {
    return this.request<any>(`/marketplace/${itemId}/buy`, { method: 'POST' });
  }

  async getInventory() {
    return this.request<any[]>('/inventory');
  }

  async equipItem(itemId: string) {
    return this.request<any>(`/inventory/${itemId}/equip`, { method: 'POST' });
  }

  // ─── Quests ────────────────────────────────────────

  async getQuests() {
    return this.request<any[]>('/quests');
  }

  async claimQuest(questId: string) {
    return this.request<any>(`/quests/${questId}/claim`, { method: 'POST' });
  }

  // ─── Wallet ────────────────────────────────────────

  async getWallet() {
    return this.request<any>('/wallet');
  }

  async getTransactions() {
    return this.request<any[]>('/wallet/transactions');
  }

  async createDeposit(amount: number) {
    return this.request<any>('/wallet/deposit', {
      method: 'POST',
      body: { amount },
    });
  }

  async exchangeNmnh(amount: number) {
    return this.request<any>('/wallet/exchange', {
      method: 'POST',
      body: { amount },
    });
  }

  async buyNmnh(amountNmnh: number) {
    return this.request<any>('/wallet/buy-nmnh', {
      method: 'POST',
      body: { amountNmnh },
    });
  }
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const api = new ApiClient();
