import { Card, Suit, Rank, DeckSize } from 'shared';

/**
 * Rank → numeric value lookup for card comparison.
 * From 2 to Ace.
 */
export const RANK_VALUES: Record<Rank, number> = {
  [Rank.Two]: 2,
  [Rank.Three]: 3,
  [Rank.Four]: 4,
  [Rank.Five]: 5,
  [Rank.Six]: 6,
  [Rank.Seven]: 7,
  [Rank.Eight]: 8,
  [Rank.Nine]: 9,
  [Rank.Ten]: 10,
  [Rank.Jack]: 11,
  [Rank.Queen]: 12,
  [Rank.King]: 13,
  [Rank.Ace]: 14,
};

/**
 * Minimum Rank based on selected deck size.
 */
export const DECK_MIN_RANK: Record<DeckSize, Rank> = {
  [DeckSize.Small]: Rank.Nine,   // 24 cards
  [DeckSize.Medium]: Rank.Six,   // 36 cards
  [DeckSize.Full]: Rank.Two,     // 52 cards
};

/**
 * Fast creation of a single Card Object.
 */
export function createCard(suit: Suit, rank: Rank): Card {
  return { suit, rank, value: RANK_VALUES[rank] };
}

/**
 * Generates a full unshuffled deck of the given size.
 */
export function generateSortedDeck(size: DeckSize): Card[] {
  const deck: Card[] = [];
  const minRank = DECK_MIN_RANK[size];
  const minValue = RANK_VALUES[minRank];

  const suits = Object.values(Suit);
  const ranks = Object.values(Rank);

  for (let s = 0; s < suits.length; s++) {
    for (let r = 0; r < ranks.length; r++) {
      const value = RANK_VALUES[ranks[r]];
      if (value >= minValue) {
        deck.push({ suit: suits[s], rank: ranks[r], value });
      }
    }
  }
  return deck;
}

/**
 * Robust Fisher-Yates shuffle (in-place).
 */
export function shuffleDeck(deck: Card[]): Card[] {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = deck[i];
    deck[i] = deck[j];
    deck[j] = temp;
  }
  return deck;
}

/**
 * Main Deck factory combining Generation + Shuffling.
 */
export function createDeck(size: DeckSize): Card[] {
  return shuffleDeck(generateSortedDeck(size));
}

/**
 * Validates if the `defense` card legally beats the `attack` card.
 */
export function canBeat(attack: Card, defense: Card, trumpSuit: Suit): boolean {
  if (defense.suit === trumpSuit) {
    if (attack.suit !== trumpSuit) return true; // Trump beats non-trump
    return defense.value > attack.value; // Higher trump beats lower trump
  }

  // Non-trump cannot beat trump
  if (attack.suit === trumpSuit) return false;

  // Same suit checks
  if (defense.suit === attack.suit) {
    return defense.value > attack.value;
  }

  return false;
}

/**
 * Extracts the single lowest valued trump card from a hand.
 * Returns null if the hand contains no trumps.
 */
export function findLowestTrump(hand: Card[], trumpSuit: Suit): Card | null {
  let lowest: Card | null = null;
  for (let i = 0; i < hand.length; i++) {
    const card = hand[i];
    if (card.suit === trumpSuit) {
      if (lowest === null || card.value < lowest.value) {
        lowest = card;
      }
    }
  }
  return lowest;
}

/**
 * O(N) check if a card matches the rank of ANY card already present on the table.
 * Crucial for the "Throw In" mechanics.
 */
export function canThrowIn(card: Card, tableCards: Card[]): boolean {
  for (let i = 0; i < tableCards.length; i++) {
    if (tableCards[i].rank === card.rank) return true;
  }
  return false;
}

/**
 * Extractor function that populates a destination array to avoid allocations.
 * Pass a pre-allocated array of length MAX_CARDS if calling in a hot loop.
 */
export function extractTableCards(table: { attack: Card; defense: Card | null }[], outArray: Card[]): void {
  outArray.length = 0; // Fast clear
  for (let i = 0; i < table.length; i++) {
    const pair = table[i];
    outArray.push(pair.attack);
    if (pair.defense) outArray.push(pair.defense);
  }
}

/**
 * Helper to get all table cards (allocates new array).
 */
export function getAllTableCards(table: { attack: Card; defense: Card | null }[]): Card[] {
  const cards: Card[] = [];
  extractTableCards(table, cards);
  return cards;
}

/**
 * Compares two cards for visual sorting.
 * Trumps always float to the right side of the hand.
 */
export function compareCards(a: Card, b: Card, trumpSuit: Suit): number {
  const aIsTrump = a.suit === trumpSuit;
  const bIsTrump = b.suit === trumpSuit;

  if (aIsTrump && !bIsTrump) return 1;
  if (!aIsTrump && bIsTrump) return -1;

  if (a.suit !== b.suit) {
    return a.suit < b.suit ? -1 : 1;
  }
  
  return a.value - b.value;
}

/**
 * Returns a newly sorted array of the provided hand.
 */
export function sortHand(hand: ReadonlyArray<Card>, trumpSuit: Suit): Card[] {
  return [...hand].sort((a, b) => compareCards(a, b, trumpSuit));
}

/**
 * Identical card check based on Suit and Rank.
 */
export function isSameCard(a: Card, b: Card): boolean {
  return a.suit === b.suit && a.rank === b.rank;
}

/**
 * Removes a single specific card from a hand safely, returning a new array.
 * Re-allocates but is safe for state mutation.
 */
export function removeCard(hand: ReadonlyArray<Card>, cardToRemove: Card): Card[] {
  const idx = hand.findIndex((c) => isSameCard(c, cardToRemove));
  if (idx === -1) return [...hand];
  return [...hand.slice(0, idx), ...hand.slice(idx + 1)];
}

