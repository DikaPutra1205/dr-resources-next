import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ResourceType, ResourceColors } from './types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format number with thousand separator (dot) — Indonesian style */
export function fmt(n: number): string {
  if (!n && n !== 0) return '0';
  return Math.round(n).toLocaleString('id-ID');
}

/** Parse shorthand input: "200m" → 200_000_000, "150k" → 150_000, "1.5m" → 1_500_000 */
export function parseShorthand(value: string): number {
  if (!value || value.trim() === '') return 0;
  
  let val = value.toLowerCase().trim();
  
  // Convert Indonesian decimal comma to dot (e.g., "2,5" -> "2.5")
  val = val.replace(',', '.');
  
  // Count the dots to detect thousand separators
  const dotCount = (val.match(/\./g) || []).length;
  if (dotCount > 1) {
    // Multiple dots always indicate thousand separators (e.g., "2.500.000") -> strip all dots
    val = val.replace(/\./g, '');
  } else if (dotCount === 1) {
    // Single dot: if it's NOT a decimal dot (i.e. not followed by 1 or 2 digits and optional k/m suffix),
    // then it's a thousand separator, so strip it. This also handles intermediate typing states like "2.0000".
    if (!/\.\d{1,2}(?:\s*[km])?$/.test(val)) {
      val = val.replace('.', '');
    }
  }

  if (!isNaN(Number(val))) return Math.floor(Number(val));

  const match = val.match(/^([0-9.]+)\s*([km])$/);
  if (match) {
    const num = parseFloat(match[1]);
    return match[2] === 'k' ? Math.floor(num * 1_000) : Math.floor(num * 1_000_000);
  }
  // Strip non-numeric
  const clean = val.replace(/[^0-9]/g, '');
  return clean ? parseInt(clean, 10) : 0;
}

/** Format number while typing — adds dots as thousand separators */
export function formatInput(raw: string): string {
  const clean = raw.replace(/\D/g, '').replace(/^0+(?=\d)/, '');
  if (!clean) return '';
  return parseInt(clean, 10).toLocaleString('id-ID');
}

/** Get sendable gross and net for an account resource */
export function getSendable(stock: number, protection: number, taxRate: number) {
  const sendableGross = Math.max(0, stock - protection);
  const sendableNet = Math.floor(sendableGross / (1 + taxRate) + 1e-9);
  return { sendableGross, sendableNet };
}

export const RESOURCES: ResourceType[] = ['food', 'wood', 'stone', 'gold'];

export const RESOURCE_COLORS: ResourceColors = {
  food:  'emerald',
  wood:  'amber',
  stone: 'slate',
  gold:  'yellow',
};

export const RESOURCE_LABELS: Record<ResourceType, string> = {
  food:  'Food',
  wood:  'Wood',
  stone: 'Stone',
  gold:  'Gold',
};

export const RESOURCE_DOT: Record<ResourceType, string> = {
  food:  'bg-emerald-500',
  wood:  'bg-amber-500',
  stone: 'bg-slate-500',
  gold:  'bg-yellow-500',
};

export const RESOURCE_BORDER: Record<ResourceType, string> = {
  food:  'border-emerald-200 focus:border-emerald-500 focus:ring-emerald-500/20 bg-emerald-50/30',
  wood:  'border-amber-200 focus:border-amber-500 focus:ring-amber-500/20 bg-amber-50/30',
  stone: 'border-slate-200 focus:border-slate-500 focus:ring-slate-500/20 bg-slate-50/30',
  gold:  'border-yellow-200 focus:border-yellow-500 focus:ring-yellow-500/20 bg-yellow-50/30',
};

/** Trading Post config data (from GameConfigSeeder) */
export const TRADING_POST_CONFIG: Record<number, { tax_rate: number; capacity_per_trip: number }> = {
  1:  { tax_rate: 0.35, capacity_per_trip: 10_000 },
  2:  { tax_rate: 0.34, capacity_per_trip: 30_000 },
  3:  { tax_rate: 0.33, capacity_per_trip: 60_000 },
  4:  { tax_rate: 0.32, capacity_per_trip: 100_000 },
  5:  { tax_rate: 0.31, capacity_per_trip: 160_000 },
  6:  { tax_rate: 0.30, capacity_per_trip: 240_000 },
  7:  { tax_rate: 0.29, capacity_per_trip: 320_000 },
  8:  { tax_rate: 0.28, capacity_per_trip: 400_000 },
  9:  { tax_rate: 0.27, capacity_per_trip: 500_000 },
  10: { tax_rate: 0.26, capacity_per_trip: 600_000 },
  11: { tax_rate: 0.25, capacity_per_trip: 800_000 },
  12: { tax_rate: 0.24, capacity_per_trip: 1_000_000 },
  13: { tax_rate: 0.23, capacity_per_trip: 1_200_000 },
  14: { tax_rate: 0.22, capacity_per_trip: 1_400_000 },
  15: { tax_rate: 0.21, capacity_per_trip: 1_600_000 },
  16: { tax_rate: 0.20, capacity_per_trip: 1_800_000 },
  17: { tax_rate: 0.19, capacity_per_trip: 2_000_000 },
  18: { tax_rate: 0.18, capacity_per_trip: 2_200_000 },
  19: { tax_rate: 0.17, capacity_per_trip: 2_400_000 },
  20: { tax_rate: 0.16, capacity_per_trip: 2_600_000 },
  21: { tax_rate: 0.15, capacity_per_trip: 2_800_000 },
  22: { tax_rate: 0.14, capacity_per_trip: 3_000_000 },
  23: { tax_rate: 0.12, capacity_per_trip: 3_500_000 },
  24: { tax_rate: 0.10, capacity_per_trip: 4_000_000 },
  25: { tax_rate: 0.08, capacity_per_trip: 10_000_000 },
};

/** Storehouse protection config data (from GameConfigSeeder) */
export const STOREHOUSE_CONFIG: Record<number, { food: number; wood: number; stone: number; gold: number }> = {
  1:  { food: 300_000,   wood: 300_000,   stone: 225_000,   gold: 150_000 },
  2:  { food: 320_000,   wood: 320_000,   stone: 225_000,   gold: 160_000 },
  3:  { food: 350_000,   wood: 350_000,   stone: 262_500,   gold: 175_000 },
  4:  { food: 380_000,   wood: 380_000,   stone: 285_000,   gold: 190_000 },
  5:  { food: 410_000,   wood: 410_000,   stone: 307_500,   gold: 205_000 },
  6:  { food: 450_000,   wood: 450_000,   stone: 337_500,   gold: 225_000 },
  7:  { food: 500_000,   wood: 500_000,   stone: 375_000,   gold: 250_000 },
  8:  { food: 550_000,   wood: 550_000,   stone: 412_500,   gold: 275_000 },
  9:  { food: 600_000,   wood: 600_000,   stone: 450_000,   gold: 300_000 },
  10: { food: 650_000,   wood: 650_000,   stone: 487_500,   gold: 325_000 },
  11: { food: 700_000,   wood: 700_000,   stone: 525_000,   gold: 350_000 },
  12: { food: 750_000,   wood: 750_000,   stone: 562_500,   gold: 375_000 },
  13: { food: 800_000,   wood: 800_000,   stone: 600_000,   gold: 400_000 },
  14: { food: 850_000,   wood: 850_000,   stone: 637_500,   gold: 425_000 },
  15: { food: 900_000,   wood: 900_000,   stone: 675_000,   gold: 450_000 },
  16: { food: 1_000_000, wood: 1_000_000, stone: 750_000,   gold: 500_000 },
  17: { food: 1_100_000, wood: 1_100_000, stone: 825_000,   gold: 550_000 },
  18: { food: 1_200_000, wood: 1_200_000, stone: 900_000,   gold: 600_000 },
  19: { food: 1_300_000, wood: 1_300_000, stone: 975_000,   gold: 650_000 },
  20: { food: 1_400_000, wood: 1_400_000, stone: 1_050_000, gold: 700_000 },
  21: { food: 1_500_000, wood: 1_500_000, stone: 1_125_000, gold: 750_000 },
  22: { food: 1_600_000, wood: 1_600_000, stone: 1_200_000, gold: 800_000 },
  23: { food: 1_800_000, wood: 1_800_000, stone: 1_350_000, gold: 900_000 },
  24: { food: 2_000_000, wood: 2_000_000, stone: 1_500_000, gold: 1_000_000 },
  25: { food: 2_500_000, wood: 2_500_000, stone: 2_500_000, gold: 2_500_000 },
};
