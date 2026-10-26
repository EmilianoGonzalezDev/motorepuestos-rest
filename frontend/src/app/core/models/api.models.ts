// Contracts of the MotoRepuestos REST API (mirrors the C# DTOs; enums travel as strings).

export interface Paged<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasPrevious: boolean;
  hasNext: boolean;
}

export interface ProblemDetails {
  type?: string;
  title?: string;
  status?: number;
  code?: string;
  errors?: Record<string, string[]>;
  traceId?: string;
}

// ---- Auth / users -------------------------------------------------------------------------
export type UserRole = 'Client' | 'Admin' | 'SuperAdmin';

export interface User {
  id: number;
  fullName: string;
  email: string;
  role: UserRole;
}

export interface AuthResponse {
  accessToken: string;
  expiresAt: string;
  user: User;
}

export interface UserAdmin extends User {
  isActive: boolean;
  createdAt: string;
  lastLoginAt: string | null;
  ordersCount: number;
}

// ---- Catalog ------------------------------------------------------------------------------
export interface CategoryRef {
  id: number;
  name: string;
}

export interface CatalogCategory extends CategoryRef {
  productCount: number;
}

export interface ProductCard {
  id: number;
  name: string;
  price: number;
  imageUrl: string | null;
  stock: number;
  isLowStock: boolean;
  isAvailable: boolean;
  category: CategoryRef;
}

export interface ProductDetail extends ProductCard {
  description: string;
}

export interface SearchSuggestion {
  id: number;
  name: string;
  price: number;
  imageUrl: string | null;
  categoryName: string;
}

export interface PriceRange {
  min: number;
  max: number;
}

export type CatalogSort = 'Newest' | 'PriceAsc' | 'PriceDesc' | 'NameAsc';

export interface CatalogQuery {
  page?: number;
  pageSize?: number;
  categoryId?: number | null;
  search?: string | null;
  minPrice?: number | null;
  maxPrice?: number | null;
  sort?: CatalogSort;
}

// ---- Cart ---------------------------------------------------------------------------------
export interface CartItem {
  productId: number;
  name: string;
  imageUrl: string | null;
  unitPrice: number;
  quantity: number;
  stock: number;
  isAvailable: boolean;
  exceedsStock: boolean;
  subtotal: number;
}

export interface Cart {
  items: CartItem[];
  totalQuantity: number;
  total: number;
  hasUnavailableItems: boolean;
  canCheckout: boolean;
}

// ---- Orders -------------------------------------------------------------------------------
export type OrderStatus = 'Pending' | 'Prepared' | 'Delivered' | 'Cancelled';
export type PaymentType = 'Store' | 'Card' | 'BankTransfer';

export interface OrderItem {
  productId: number;
  productName: string;
  imageUrl: string | null;
  unitPrice: number;
  quantity: number;
  subtotal: number;
}

export interface OrderCustomer {
  id: number;
  fullName: string;
  email: string;
}

export interface OrderSummary {
  id: number;
  createdAt: string;
  status: OrderStatus;
  paymentType: PaymentType;
  total: number;
  itemCount: number;
  customer: OrderCustomer;
  items: OrderItem[];
}

export interface OrderStatusChange {
  status: OrderStatus;
  changedAt: string;
  note: string | null;
  changedBy: string | null;
}

export interface OrderDetail extends OrderSummary {
  notes: string | null;
  history: OrderStatusChange[];
  allowedNextStatuses: OrderStatus[];
  canCancel: boolean;
}

// ---- Back office --------------------------------------------------------------------------
export interface CategoryAdmin {
  id: number;
  name: string;
  isActive: boolean;
  productCount: number;
  activeProductCount: number;
}

export interface CategoryOption {
  id: number;
  name: string;
  isActive: boolean;
}

export interface ProductAdmin {
  id: number;
  name: string;
  price: number;
  stock: number;
  isActive: boolean;
  isLowStock: boolean;
  imageUrl: string | null;
  categoryId: number;
  categoryName: string;
  categoryIsActive: boolean;
  updatedAt: string | null;
}

export interface ProductAdminDetail {
  id: number;
  name: string;
  description: string;
  price: number;
  stock: number;
  isActive: boolean;
  imageUrl: string | null;
  categoryId: number;
  categoryName: string;
  createdAt: string;
  updatedAt: string | null;
}

export interface ProductListResponse {
  products: Paged<ProductAdmin>;
  lowStockThreshold: number;
}

export type ProductSortBy = 'Name' | 'Price' | 'Stock' | 'Category' | 'UpdatedAt';
export type SortDirection = 'Asc' | 'Desc';

export interface UpsertProduct {
  categoryId: number;
  name: string;
  description: string;
  price: number;
  stock: number;
}

export interface DashboardKpis {
  revenueThisMonth: number;
  revenuePreviousMonth: number;
  ordersThisMonth: number;
  averageTicket: number;
  pendingOrders: number;
  preparedOrders: number;
  lowStockProducts: number;
  activeProducts: number;
  customers: number;
}

export interface Dashboard {
  kpis: DashboardKpis;
  salesByDay: { date: string; revenue: number; orders: number }[];
  topProducts: { productId: number; name: string; quantity: number; revenue: number }[];
  ordersByStatus: { status: OrderStatus; count: number }[];
  lowStock: { id: number; name: string; stock: number; imageUrl: string | null }[];
  recentOrders: { id: number; customerName: string; total: number; status: OrderStatus; createdAt: string }[];
  lowStockThreshold: number;
}

export interface Settings {
  lowStockThreshold: number;
}
