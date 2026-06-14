import {
  AccountCalcData,
  CalcTotals,
  ResourceData,
  ResourcePrices,
  ResourceType,
} from './types';
import { RESOURCES, TRADING_POST_CONFIG, STOREHOUSE_CONFIG } from './utils';
import type { GameAccount } from './types';

const EMPTY_TOTALS = (): CalcTotals => ({
  food_sent: 0, food_received: 0,
  wood_sent: 0, wood_received: 0,
  stone_sent: 0, stone_received: 0,
  gold_sent: 0, gold_received: 0,
  total_trips: 0,
  estimated_value: 0,
  tax_rate: 0,
  has_insufficient_stock: false,
});

/** Build per-account resource data from raw accounts */
export function buildAccountData(accounts: GameAccount[]): AccountCalcData[] {
  return accounts.map(acc => {
    const tpLevel = acc.trading_post_level || 1;
    const shLevel = acc.storehouse_level || 1;
    
    const tpConfig = TRADING_POST_CONFIGS[tpLevel] || TRADING_POST_CONFIGS[1];
    const shConfig = STOREHOUSE_PROTECTION[shLevel] || STOREHOUSE_PROTECTION[1];
    
    const taxRate = tpConfig.tax;
    const capacityPerTrip = tpConfig.capacity;

    const resources: Record<ResourceType, ResourceData> = {} as any;
    
    for (const res of RESOURCES) {
      const stock = acc.resource_stock?.[res] ?? 0;
      const protection = shConfig[res];
      const sendableGross = Math.max(0, stock - protection);
      const sendableNet = Math.floor(sendableGross / (1 + taxRate));
      
      resources[res] = {
        stock,
        protection,
        sendable_gross: sendableGross,
        sendable_net: sendableNet,
        required_gross: 0,
        required_net: 0,
        trips: 0
      };
    }

    return {
      account: acc,
      tax_rate: taxRate,
      capacity_per_trip: capacityPerTrip,
      resources
    };
  });
}

/** Calculate trips for a net amount */
function calcTrips(net: number, capacityPerTrip: number): number {
  if (capacityPerTrip <= 0 || net <= 0) return 0;
  return Math.ceil(net / capacityPerTrip);
}

/** Sum totals from accountsData and compute derived fields */
function sumTotals(accountsData: AccountCalcData[], prices: ResourcePrices): CalcTotals {
  const totals = EMPTY_TOTALS();
  for (const accData of accountsData) {
    for (const res of RESOURCES) {
      totals[`${res}_sent`] += accData.resources[res].required_gross;
      totals[`${res}_received`] += accData.resources[res].required_net;
      totals.total_trips += accData.resources[res].trips;
    }
  }
  let totalSent = 0, totalRecv = 0;
  for (const res of RESOURCES) {
    totals.estimated_value += (totals[`${res}_received`] / 1_000_000) * prices[res];
    totalSent += totals[`${res}_sent`];
    totalRecv += totals[`${res}_received`];
  }
  if (totalSent > 0 && totalRecv > 0) {
    totals.tax_rate = Math.round(((totalSent - totalRecv) / totalRecv) * 100 * 100) / 100;
  }
  return totals;
}

// ─── Mode: Proportional (Single / Accounts) ──────────────────────────────────

export function calculateProportional(
  accounts: GameAccount[],
  targets: Record<ResourceType, number>,
  prices: ResourcePrices,
): { accountsData: AccountCalcData[]; totals: CalcTotals; warnings: string[] } {
  const accountsData = buildAccountData(accounts);
  const warnings: string[] = [];

  const totalSendableNet = { food: 0, wood: 0, stone: 0, gold: 0 } as Record<ResourceType, number>;
  for (const accData of accountsData) {
    for (const res of RESOURCES) {
      totalSendableNet[res] += accData.resources[res].sendable_net;
    }
  }

  for (const res of RESOURCES) {
    const target = targets[res];
    if (target <= 0) continue;

    const netCap = totalSendableNet[res];
    let scaling = 0;

    if (netCap <= 0) {
      warnings.push(`Stok ${res} yang aman dikirim adalah 0.`);
      continue;
    } else if (target > netCap) {
      scaling = 1.0;
      warnings.push(`Stok bersih gabungan untuk ${res} (${netCap.toLocaleString('id-ID')}) tidak mencukupi target (${target.toLocaleString('id-ID')})!`);
    } else {
      scaling = target / netCap;
    }

    for (const accData of accountsData) {
      const r = accData.resources[res];
      r.required_net = scaling >= 1.0
        ? r.sendable_net
        : Math.round(r.sendable_net * scaling);
      r.required_gross = Math.min(
        Math.ceil(r.required_net * (1 + accData.tax_rate)),
        r.sendable_gross
      );
      r.required_net = Math.floor(r.required_gross / (1 + accData.tax_rate));
      r.trips = calcTrips(r.required_net, accData.capacity_per_trip);
    }
  }

  return { accountsData, totals: sumTotals(accountsData, prices), warnings };
}

// ─── Game Configs (from Laravel Seeder) ──────────────────────────────────────

const TRADING_POST_CONFIGS: Record<number, { tax: number; capacity: number }> = {
  1: { tax: 0.35, capacity: 10000 },
  2: { tax: 0.34, capacity: 30000 },
  3: { tax: 0.33, capacity: 60000 },
  4: { tax: 0.32, capacity: 100000 },
  5: { tax: 0.31, capacity: 160000 },
  6: { tax: 0.30, capacity: 240000 },
  7: { tax: 0.29, capacity: 320000 },
  8: { tax: 0.28, capacity: 400000 },
  9: { tax: 0.27, capacity: 500000 },
  10: { tax: 0.26, capacity: 600000 },
  11: { tax: 0.25, capacity: 800000 },
  12: { tax: 0.24, capacity: 1000000 },
  13: { tax: 0.23, capacity: 1200000 },
  14: { tax: 0.22, capacity: 1400000 },
  15: { tax: 0.21, capacity: 1600000 },
  16: { tax: 0.20, capacity: 1800000 },
  17: { tax: 0.19, capacity: 2000000 },
  18: { tax: 0.18, capacity: 2200000 },
  19: { tax: 0.17, capacity: 2400000 },
  20: { tax: 0.16, capacity: 2600000 },
  21: { tax: 0.15, capacity: 2800000 },
  22: { tax: 0.14, capacity: 3000000 },
  23: { tax: 0.12, capacity: 3500000 },
  24: { tax: 0.10, capacity: 4000000 },
  25: { tax: 0.08, capacity: 10000000 },
};

const STOREHOUSE_PROTECTION: Record<number, Record<ResourceType, number>> = {
  1: { food: 300000, wood: 300000, stone: 225000, gold: 150000 },
  2: { food: 320000, wood: 320000, stone: 225000, gold: 160000 },
  3: { food: 350000, wood: 350000, stone: 262500, gold: 175000 },
  4: { food: 380000, wood: 380000, stone: 285000, gold: 190000 },
  5: { food: 410000, wood: 410000, stone: 307500, gold: 205000 },
  6: { food: 450000, wood: 450000, stone: 337500, gold: 225000 },
  7: { food: 500000, wood: 500000, stone: 375000, gold: 250000 },
  8: { food: 550000, wood: 550000, stone: 412500, gold: 275000 },
  9: { food: 600000, wood: 600000, stone: 450000, gold: 300000 },
  10: { food: 650000, wood: 650000, stone: 487500, gold: 325000 },
  11: { food: 700000, wood: 700000, stone: 525000, gold: 350000 },
  12: { food: 750000, wood: 750000, stone: 562500, gold: 375000 },
  13: { food: 800000, wood: 800000, stone: 600000, gold: 400000 },
  14: { food: 850000, wood: 850000, stone: 637500, gold: 425000 },
  15: { food: 900000, wood: 900000, stone: 675000, gold: 450000 },
  16: { food: 1000000, wood: 1000000, stone: 750000, gold: 500000 },
  17: { food: 1100000, wood: 1100000, stone: 825000, gold: 550000 },
  18: { food: 1200000, wood: 1200000, stone: 900000, gold: 600000 },
  19: { food: 1300000, wood: 1300000, stone: 975000, gold: 650000 },
  20: { food: 1400000, wood: 1400000, stone: 1050000, gold: 700000 },
  21: { food: 1500000, wood: 1500000, stone: 1125000, gold: 750000 },
  22: { food: 1600000, wood: 1600000, stone: 1200000, gold: 800000 },
  23: { food: 1800000, wood: 1800000, stone: 1350000, gold: 900000 },
  24: { food: 2000000, wood: 2000000, stone: 1500000, gold: 1000000 },
  25: { food: 2500000, wood: 2500000, stone: 2500000, gold: 2500000 },
};

// ─── Calculator Logic ─────────────────────────────────────────────────────────

export function calculateFairShare(
  accounts: GameAccount[],
  targets: Record<ResourceType, number>,
  prices: ResourcePrices,
): { accountsData: AccountCalcData[]; totals: CalcTotals; warnings: string[] } {
  const accountsData = buildAccountData(accounts);
  const warnings: string[] = [];

  const globalCapNet = { food: 0, wood: 0, stone: 0, gold: 0 } as Record<ResourceType, number>;
  for (const accData of accountsData) {
    for (const res of RESOURCES) globalCapNet[res] += accData.resources[res].sendable_net;
  }

  for (const res of RESOURCES) {
    const target = targets[res];
    if (target <= 0) continue;

    const cap = globalCapNet[res];
    if (cap <= 0) { warnings.push(`Kapasitas ${res} seluruh akun adalah 0.`); continue; }

    if (target > cap) {
      warnings.push(`Kapasitas bersih gabungan ${res} (${cap.toLocaleString('id-ID')}) tidak mencukupi target (${target.toLocaleString('id-ID')})!`);
      for (const accData of accountsData) {
        const r = accData.resources[res];
        r.required_gross = r.sendable_gross;
        r.required_net = r.sendable_net;
        r.trips = calcTrips(r.required_net, accData.capacity_per_trip);
      }
      continue;
    }

    // Fair-share: sort by sendable_net ASC, distribute equally
    const indices = accountsData.map((_, i) => i)
      .sort((a, b) => accountsData[a].resources[res].sendable_net - accountsData[b].resources[res].sendable_net);

    let remaining = target;
    let remainingAccounts = indices.length;
    const assignments = new Array(accountsData.length).fill(0);

    for (const idx of indices) {
      if (remainingAccounts <= 0 || remaining <= 0) break;
      const equalShare = remaining / remainingAccounts;
      const maxNet = accountsData[idx].resources[res].sendable_net;
      const contribution = Math.min(maxNet, equalShare);
      assignments[idx] = contribution;
      remaining -= contribution;
      remainingAccounts--;
    }

    accountsData.forEach((accData, idx) => {
      const netAssigned = Math.round(assignments[idx]);
      if (netAssigned <= 0) return;
      const grossNeeded = Math.min(
        Math.ceil(netAssigned * (1 + accData.tax_rate)),
        accData.resources[res].sendable_gross,
      );
      const netActual = Math.floor(grossNeeded / (1 + accData.tax_rate));
      accData.resources[res].required_gross = grossNeeded;
      accData.resources[res].required_net = netActual;
      accData.resources[res].trips = calcTrips(netActual, accData.capacity_per_trip);
    });
  }

  return { accountsData, totals: sumTotals(accountsData, prices), warnings };
}

// ─── Mode: Manual (input net → compute gross) ────────────────────────────────

export function calculateManual(
  accounts: GameAccount[],
  manualInputs: Record<string, Record<ResourceType, number>>, // accId → res → net value
  prices: ResourcePrices,
): { accountsData: AccountCalcData[]; totals: CalcTotals; warnings: string[] } {
  const accountsData = buildAccountData(accounts);
  const warnings: string[] = [];
  let hasInsufficient = false;

  for (const accData of accountsData) {
    const accKey = String(accData.account.id);
    for (const res of RESOURCES) {
      const netTarget = manualInputs[accKey]?.[res] ?? 0;
      const r = accData.resources[res];

      if (netTarget <= 0) continue;

      if (netTarget > r.sendable_net) {
        warnings.push(`Stok bersih ${res} di akun "${accData.account.name}" tidak mencukupi! Target net ${netTarget.toLocaleString('id-ID')}, stok aman bersih ${r.sendable_net.toLocaleString('id-ID')}.`);
        hasInsufficient = true;
        r.required_gross = r.sendable_gross;
        r.required_net = r.sendable_net;
      } else {
        const grossNeeded = Math.ceil(netTarget * (1 + accData.tax_rate));
        r.required_gross = Math.min(grossNeeded, r.sendable_gross);
        r.required_net = Math.floor(r.required_gross / (1 + accData.tax_rate));
      }
      r.trips = calcTrips(r.required_net, accData.capacity_per_trip);
    }
  }

  const totals = sumTotals(accountsData, prices);
  totals.has_insufficient_stock = hasInsufficient;
  return { accountsData, totals, warnings };
}

/** Calculate trip breakdown combining all resources. */
export function calculateTripBreakdown(
  capacity: number,
  taxRate: number,
  foodSent: number,
  woodSent: number,
  stoneSent: number,
  goldSent: number,
): any[] {
  if (capacity <= 0) {
    const resources: any = {};
    const sentMap = { food: foodSent, wood: woodSent, stone: stoneSent, gold: goldSent };
    for (const res of ['food', 'wood', 'stone', 'gold'] as const) {
      const sent = sentMap[res];
      if (sent > 0) {
        resources[res] = {
          sent,
          received: Math.floor(sent / (1 + taxRate)),
        };
      }
    }
    return [
      {
        trip: 1,
        resources,
      },
    ];
  }

  const netFood = foodSent / (1 + taxRate);
  const netWood = woodSent / (1 + taxRate);
  const netStone = stoneSent / (1 + taxRate);
  const netGold = goldSent / (1 + taxRate);

  const tripsFood = Math.ceil(netFood / capacity);
  const tripsWood = Math.ceil(netWood / capacity);
  const tripsStone = Math.ceil(netStone / capacity);
  const tripsGold = Math.ceil(netGold / capacity);

  const totalTrips = Math.max(tripsFood, tripsWood, tripsStone, tripsGold);
  const tripDetails: any[] = [];
  const grossCapacity = Math.round(capacity * (1 + taxRate));

  for (let t = 1; t <= totalTrips; t++) {
    const resources: any = {};
    const sentMap = { food: foodSent, wood: woodSent, stone: stoneSent, gold: goldSent };
    for (const res of ['food', 'wood', 'stone', 'gold'] as const) {
      const totalSent = sentMap[res];
      const sent = Math.min(grossCapacity, Math.max(0, totalSent - (t - 1) * grossCapacity));
      if (sent > 0) {
        resources[res] = {
          sent,
          received: Math.floor(sent / (1 + taxRate)),
        };
      }
    }
    if (Object.keys(resources).length > 0) {
      tripDetails.push({
        trip: t,
        resources,
      });
    }
  }

  return tripDetails;
}

