export type Paginated<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  hasNextPage: boolean;
};

export type Role = { id: string; name: string };
export type Permission = { id: string; name: string };

export type AdminUser = {
  id: string;
  email: string;
  emailVerified: boolean | null;
  isActive: boolean | null;
  createdAt: string | null;
};

export type AdminUserOption = { id: string; email: string };

export type Employee = {
  id: string;
  userId: string | null;
  name: string;
  phone: string | null;
  roleId: string | null;
  isActive: boolean | null;
  createdAt: string | null;
};

export type Client = {
  id: string;
  name: string;
  identification: string;
  email: string | null;
  phone: string | null;
  city: string | null;
  isActive: boolean | null;
  createdAt: string | null;
};

export type RolePermission = {
  roleId: string | null;
  permissionId: string | null;
};
