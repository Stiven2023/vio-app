export type PettyCashLocale = "en" | "es";

export type TransactionType =
  | "EXPENSE"
  | "REPLENISHMENT"
  | "OPENING"
  | "ADJUSTMENT";

export type FundOption = {
  id: string;
  name: string;
  currentBalance: string;
  currency: string;
  status: string;
};

export type TransactionRow = {
  id: string;
  transactionCode: string;
  fundId: string;
  fundName: string | null;
  transactionDate: string;
  transactionType: TransactionType;
  category: string | null;
  description: string;
  amount: string;
  balanceBefore: string;
  balanceAfter: string;
  referenceCode: string | null;
  attachmentUrl: string | null;
  notes: string | null;
  currency: string | null;
  createdAt: string | null;
  createdByName: string | null;
};

export type PettyCashData = {
  items: TransactionRow[];
  funds: FundOption[];
  summary: {
    totalExpenses: string;
    totalReplenishments: string;
    totalAdjustments: string;
  };
  page: number;
  pageSize: number;
  total: number;
  hasNextPage: boolean;
};

export type FundRow = {
  id: string;
  name: string;
  description: string | null;
  initialBalance: string;
  currentBalance: string;
  maxBalance: string | null;
  currency: string;
  status: string;
  createdAt: string | null;
  responsibleName: string | null;
};

export type FundsData = {
  items: FundRow[];
};