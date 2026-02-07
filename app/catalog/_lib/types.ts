export type Paginated<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  hasNextPage: boolean;
};

export type Category = {
  id: string;
  name: string;
};

export type Product = {
  id: string;
  name: string;
  description: string | null;
  categoryId: string | null;
  isActive: boolean | null;
  createdAt: string | null;
};

export type ProductPrice = {
  id: string;
  productId: string | null;
  referenceCode: string;
  priceCOP: string | null;
  priceUSD: string | null;
  startDate: string | null;
  endDate: string | null;
  isActive: boolean | null;
};
