// ============================================================
// CARD TYPES
// ============================================================

export enum Suit {
  Hearts = 'hearts',
  Diamonds = 'diamonds',
  Clubs = 'clubs',
  Spades = 'spades',
}

export enum Rank {
  Two = '2',
  Three = '3',
  Four = '4',
  Five = '5',
  Six = '6',
  Seven = '7',
  Eight = '8',
  Nine = '9',
  Ten = '10',
  Jack = 'J',
  Queen = 'Q',
  King = 'K',
  Ace = 'A',
}

export interface Card {
  suit: Suit;
  rank: Rank;
  /** Numeric value for comparison (6=6, 7=7 ... J=11, Q=12, K=13, A=14) */
  value: number;
}

/** A pair on the table: attack card + optional defense card */
export interface TablePair {
  attack: Card;
  defense: Card | null;
}

// ============================================================
// GAME CONFIG / SETTINGS
// ============================================================

export enum GameMode {
  Podkidnoy = 'podkidnoy',
  Perevodnoy = 'perevodnoy',
}

export enum DeckSize {
  Small = 24,
  Medium = 36,
  Full = 52,
}

export enum ThrowInRule {
  Neighbors = 'neighbors',
  All = 'all',
}

export interface GameSettings {
  mode: GameMode;
  deckSize: DeckSize;
  maxPlayers: 2 | 3 | 4 | 5 | 6;
  stake: number;
  throwInRule: ThrowInRule;
  allowDraw: boolean;
  turnTimerSeconds: 15 | 30 | 60 | 90;
  isPrivate: boolean;
  password?: string;
}

// ============================================================
// GAME STATE
// ============================================================

export enum GameStatus {
  Waiting = 'waiting',
  Playing = 'playing',
  Finished = 'finished',
}

export enum PlayerRole {
  Attacker = 'attacker',
  Defender = 'defender',
  CoAttacker = 'co_attacker',
  Spectator = 'spectator',
}

export enum GameResult {
  Win = 'win',
  Lose = 'lose',
  Draw = 'draw',
}

export interface PlayerState {
  userId: string;
  visibleCards: Card[];
  cardCount: number;
  role: PlayerRole;
  isOut: boolean;
  position: number;
  avatarUrl: string;
  username: string;
  rating: number;
}

/** Full game state sent to a specific player (hides other players' cards) */
export interface GameState {
  gameId: string;
  status: GameStatus;
  settings: GameSettings;
  players: PlayerState[];
  myHand: Card[];
  table: TablePair[];
  trumpCard: Card | null;
  trumpSuit: Suit;
  deckRemaining: number;
  currentAttackerId: string;
  currentDefenderId: string;
  turnStartedAt: number;
  turnTimerSeconds: number;
  discardPileCount: number;
  /** True when defender has announced they'll take — attackers may still throw in */
  defenderIsTaking: boolean;
}

// ============================================================
// GAME ACTIONS
// ============================================================

export enum GameActionType {
  Attack = 'attack',
  Defend = 'defend',
  Take = 'take',
  Pass = 'pass',
  Transfer = 'transfer',
  Surrender = 'surrender',
}

export interface GameAction {
  type: GameActionType;
  card?: Card;
  /** For defend — index of the table pair to defend against */
  targetPairIndex?: number;
}

export interface GameActionResult {
  success: boolean;
  error?: string;
  newState?: Partial<GameState>;
}

// ============================================================
// GAME END
// ============================================================

export interface GameEndResult {
  gameId: string;
  winnerId: string | null;
  loserId: string;
  isDraw: boolean;
  players: Array<{
    userId: string;
    result: GameResult;
    starsPayout: number;
    nmnhEarned: number;
    ratingChange: number;
    newRating: number;
  }>;
  questProgress: QuestProgressUpdate[];
}

// ============================================================
// USER / AUTH
// ============================================================

export interface User {
  id: string;
  telegramId: number;
  username: string;
  firstName: string;
  lastName?: string;
  avatarUrl: string;
  starsBalance: number;
  nmnhBalance: number;
  rating: number;
  level: number;
  vipUntil: string | null;
  referralCode: string;
  createdAt: string;
}

export interface UserProfile extends User {
  stats: UserStats;
  equippedItems: EquippedItems;
}

export interface UserStats {
  gamesPlayed: number;
  gamesWon: number;
  gamesLost: number;
  gamesDraw: number;
  winRate: number;
  longestStreak: number;
  currentStreak: number;
  totalStarsWon: number;
  totalNmnhEarned: number;
  favoriteMode: GameMode;
}

export interface EquippedItems {
  cardBack: string | null;
  tableTheme: string | null;
  avatarFrame: string | null;
  emojiPack: string | null;
  winEffect: string | null;
}

// ============================================================
// MARKETPLACE
// ============================================================

export enum MarketCategory {
  CardBacks = 'card_backs',
  TableThemes = 'table_themes',
  AvatarFrames = 'avatar_frames',
  EmojiPacks = 'emoji_packs',
  WinEffects = 'win_effects',
  Boosters = 'boosters',
  VipStatus = 'vip_status',
}

export interface MarketplaceItem {
  id: string;
  category: MarketCategory;
  name: string;
  description: string;
  priceStars: number;
  previewUrl: string;
  isLimited: boolean;
  availableUntil: string | null;
  isNew: boolean;
  discount: number | null;
}

export interface InventoryItem {
  item: MarketplaceItem;
  equipped: boolean;
  purchasedAt: string;
}

// ============================================================
// QUESTS / TASKS
// ============================================================

export enum QuestType {
  Daily = 'daily',
  Weekly = 'weekly',
  Achievement = 'achievement',
}

export enum QuestMetric {
  GamesPlayed = 'games_played',
  GamesWon = 'games_won',
  CardsDefended = 'cards_defended',
  EmojisSent = 'emojis_sent',
  PlayedMode = 'played_mode',
  WinStreak = 'win_streak',
  FriendInvited = 'friend_invited',
  ItemsCollected = 'items_collected',
  RatingReached = 'rating_reached',
  WinsWithoutTake = 'wins_without_take',
}

export interface Quest {
  id: string;
  type: QuestType;
  title: string;
  description: string;
  metric: QuestMetric;
  targetValue: number;
  rewardNmnh: number;
  icon: string;
}

export interface UserQuest {
  quest: Quest;
  progress: number;
  completed: boolean;
  claimed: boolean;
  resetsAt: string | null;
}

export interface QuestProgressUpdate {
  questId: string;
  newProgress: number;
  completed: boolean;
}

// ============================================================
// WALLET / TRANSACTIONS
// ============================================================

export enum TransactionType {
  Deposit = 'deposit',
  Withdrawal = 'withdrawal',
  Bet = 'bet',
  Win = 'win',
  Purchase = 'purchase',
  QuestReward = 'quest_reward',
  Referral = 'referral',
  DailyBonus = 'daily_bonus',
  Exchange = 'exchange',
}

export enum Currency {
  Stars = 'stars',
  NMNH = 'nmnh',
}

export enum TransactionStatus {
  Pending = 'pending',
  Completed = 'completed',
  Failed = 'failed',
}

export interface Transaction {
  id: string;
  type: TransactionType;
  currency: Currency;
  amount: number;
  status: TransactionStatus;
  referenceId: string | null;
  createdAt: string;
}

// ============================================================
// SOCIAL
// ============================================================

export enum FriendshipStatus {
  Pending = 'pending',
  Accepted = 'accepted',
}

export interface Friend {
  user: Pick<User, 'id' | 'telegramId' | 'username' | 'firstName' | 'avatarUrl' | 'rating'>;
  status: FriendshipStatus;
  isOnline: boolean;
}

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  firstName: string;
  avatarUrl: string;
  rating: number;
  gamesWon: number;
}

// ============================================================
// SOCKET EVENTS
// ============================================================

export interface ClientToServerEvents {
  'game:join': (data: { gameId: string }) => void;
  'game:action': (data: GameAction) => void;
  'game:emoji': (data: { emoji: string }) => void;
  'game:chat': (data: { message: string }) => void;
  'game:surrender': () => void;
  'matchmaking:join': (data: { settings: Partial<GameSettings> }) => void;
  'matchmaking:cancel': () => void;
}

export interface ServerToClientEvents {
  'game:state': (state: GameState) => void;
  'game:update': (update: Partial<GameState>) => void;
  'game:action_result': (result: GameActionResult) => void;
  'game:end': (result: GameEndResult) => void;
  'game:emoji': (data: { userId: string; emoji: string }) => void;
  'game:chat': (data: { userId: string; message: string; timestamp: number }) => void;
  'game:timer': (data: { remainingSeconds: number }) => void;
  'game:player_joined': (data: { player: PlayerState }) => void;
  'game:player_left': (data: { userId: string }) => void;
  'matchmaking:found': (data: { gameId: string }) => void;
  'matchmaking:searching': (data: { playersFound: number; required: number }) => void;
  'quest:progress': (data: QuestProgressUpdate) => void;
  'balance:update': (data: { starsBalance: number; nmnhBalance: number }) => void;
  'error': (data: { code: string; message: string }) => void;
}

// ============================================================
// API REQUEST / RESPONSE TYPES
// ============================================================

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CreateGameRequest {
  settings: GameSettings;
}

export interface JoinGameRequest {
  password?: string;
}

export interface QuickMatchRequest {
  settings: Partial<GameSettings>;
}

export interface DepositRequest {
  amount: number;
}

export interface ExchangeNmnhRequest {
  amount: number;
}

export interface PurchaseItemRequest {
  itemId: string;
}
