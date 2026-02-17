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
  // --- CÓDIGO Y TIPO ---
  clientCode: string;
  clientType: string;
  // --- IDENTIFICACIÓN Y NOMBRE ---
  name: string;
  identificationType: string;
  identification: string;
  dv: string | null;
  branch: string | null;
  // --- INFORMACIÓN FISCAL Y CONTACTO ---
  taxRegime: string;
  contactName: string;
  email: string;
  // --- UBICACIÓN GEOGRÁFICA ---
  address: string;
  postalCode: string | null;
  country: string | null;
  department: string | null;
  city: string | null;
  // --- TELÉFONOS Y MARCACIÓN ---
  intlDialCode: string | null;
  mobile: string | null;
  fullMobile: string | null;
  localDialCode: string | null;
  landline: string | null;
  extension: string | null;
  fullLandline: string | null;
  // --- ESTADO Y CRÉDITO ---
  status: string | null;
  isActive: boolean | null;
  hasCredit: boolean | null;
  promissoryNoteNumber: string | null;
  promissoryNoteDate: string | null;
  createdAt: string | null;
};

export type RolePermission = {
  roleId: string | null;
  permissionId: string | null;
};
