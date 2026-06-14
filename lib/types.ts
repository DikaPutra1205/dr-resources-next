// All TypeScript types for the DR Resources app

export type ResourceType = 'food' | 'wood' | 'stone' | 'gold';
export const RESOURCES: ResourceType[] = ['food', 'wood', 'stone', 'gold'];

export type AccountType = 'main' | 'farm';
export type UserRole = 'admin' | 'user';

// ─── Database types (match Supabase schema) ───────────────────────────────────

export interface Profile {
  id: string;        // same as auth.users.id
  name: string;
  email: string;
  role: UserRole;
  last_active_at: string;
  created_at: string;
}

export interface Kingdom {
  id: number;
  name: string;
  color_hex: string;
  created_at: string;
}

export interface GameAccount {
  id: number;
  user_id: string;
  kingdom_id: number | null;
  name: string;
  type: AccountType;
  trading_post_level: number;
  storehouse_level: number;
  notes: string | null;
  created_at: string;
  // Relations (joined)
  kingdom?: Kingdom | string | null;
  profile?: Profile;
  resource_stock?: ResourceStock;
}

export interface ResourceStock {
  id: number;
  game_account_id: number;
  food: number;
  wood: number;
  stone: number;
  gold: number;
  updated_at: string;
}

export interface TradingPostConfig {
  level: number;
  tax_rate: number;
  capacity_per_trip: number;
}

export interface StorehouseConfig {
  level: number;
  food_protection: number;
  wood_protection: number;
  stone_protection: number;
  gold_protection: number;
}

export interface ResourcePrice {
  id: number;
  kingdom_id: number | null;
  resource: ResourceType;
  price_per_million: number;
}

export interface Transaction {
  id: number;
  created_by: string;
  to_name: string;
  notes: string | null;
  sent_at: string;
  kingdom: string | null;
  total_food_sent: number;
  total_wood_sent: number;
  total_stone_sent: number;
  total_gold_sent: number;
  total_food_received: number;
  total_wood_received: number;
  total_stone_received: number;
  total_gold_received: number;
  total_estimated_value: number;
  image_url: string | null;
  created_at: string;
  // Relations
  creator?: Profile;
  contributions?: TransactionContribution[];
}

export interface TransactionContribution {
  id: number;
  transaction_id: number;
  game_account_id: number;
  food_sent: number;
  wood_sent: number;
  stone_sent: number;
  gold_sent: number;
  food_received: number;
  wood_received: number;
  stone_received: number;
  gold_received: number;
  tax_rate: number;
  total_trips: number;
  trip_details: TripDetail[] | null;
  // Relations
  game_account?: GameAccount;
}

export interface TripDetail {
  trip: number;
  resources: {
    food?: { sent: number; received: number };
    wood?: { sent: number; received: number };
    stone?: { sent: number; received: number };
    gold?: { sent: number; received: number };
  };
}

// ─── Calculator types ─────────────────────────────────────────────────────────

export interface ResourceData {
  stock: number;
  protection: number;
  sendable_gross: number;
  sendable_net: number;
  required_gross: number;
  required_net: number;
  trips: number;
}

export interface AccountCalcData {
  account: GameAccount;
  tax_rate: number;
  capacity_per_trip: number;
  resources: Record<ResourceType, ResourceData>;
}

export interface CalcTotals {
  food_sent: number;
  food_received: number;
  wood_sent: number;
  wood_received: number;
  stone_sent: number;
  stone_received: number;
  gold_sent: number;
  gold_received: number;
  total_trips: number;
  estimated_value: number;
  tax_rate: number;
  has_insufficient_stock: boolean;
}

export interface ResourcePrices {
  food: number;
  wood: number;
  stone: number;
  gold: number;
}

// ─── UI helpers ───────────────────────────────────────────────────────────────

export interface ResourceColors {
  food: string;
  wood: string;
  stone: string;
  gold: string;
}
