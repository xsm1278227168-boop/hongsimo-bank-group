export type UUID = string;

export interface Household {
  id: UUID;
  name: string;
  currency: string;
  invite_code: string;
  created_at: string;
}

export interface Member {
  household_id: UUID;
  user_id: UUID;
  display_name: string;
  joined_at: string;
}

export interface Category {
  id: UUID;
  household_id: UUID;
  name: string;
  sort_order: number;
  archived: boolean;
}

export type TxType = 'expense' | 'settlement';

export interface Transaction {
  id: UUID;
  household_id: UUID;
  type: TxType;
  occurred_on: string; // YYYY-MM-DD
  amount: number;
  currency: string;
  payer_id: UUID;
  payer_share: number;
  category: string | null;
  note: string | null;
  direction: 1 | -1;
  reverses_id: UUID | null;
  created_by: UUID;
  created_at: string;
}

/** Row shape of household_net(). creditor/debtor are null before the second member joins. */
export interface NetBalance {
  creditor: UUID | null;
  debtor: UUID | null;
  amount: number;
}

export interface MonthlyCategoryTotal {
  household_id: UUID;
  month: string; // YYYY-MM-DD, first of month
  category: string;
  total: number;
}

export interface MonthlyPersonTotal {
  household_id: UUID;
  month: string;
  user_id: UUID;
  display_name: string;
  paid: number;
  borne: number;
}
