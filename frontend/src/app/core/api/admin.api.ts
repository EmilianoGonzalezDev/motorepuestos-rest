import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  CategoryAdmin,
  CategoryOption,
  Dashboard,
  OrderDetail,
  OrderStatus,
  OrderSummary,
  Paged,
  ProductAdminDetail,
  ProductListResponse,
  ProductSortBy,
  Settings,
  SortDirection,
  UpsertProduct,
  UserAdmin,
  UserRole,
} from '../models/api.models';
import { toParams } from '../http/http-utils';

export interface ProductListQuery {
  page?: number;
  pageSize?: number;
  search?: string | null;
  categoryId?: number | null;
  status?: 'All' | 'Active' | 'Inactive';
  lowStockOnly?: boolean;
  sortBy?: ProductSortBy;
  sortDir?: SortDirection;
}

export interface AdminOrdersQuery {
  page?: number;
  pageSize?: number;
  statuses?: OrderStatus[];
  search?: string | null;
  from?: string | null;
  to?: string | null;
}

/** Back-office endpoints (Admin / SuperAdmin). */
@Injectable({ providedIn: 'root' })
export class AdminApi {
  private readonly http = inject(HttpClient);

  // Dashboard & settings
  dashboard(days = 30): Observable<Dashboard> {
    return this.http.get<Dashboard>('/api/dashboard', { params: { days } });
  }

  settings(): Observable<Settings> {
    return this.http.get<Settings>('/api/settings');
  }

  updateSettings(settings: Settings): Observable<Settings> {
    return this.http.put<Settings>('/api/settings', settings);
  }

  // Categories
  categories(query: { page?: number; pageSize?: number; search?: string | null; isActive?: boolean | null }): Observable<Paged<CategoryAdmin>> {
    return this.http.get<Paged<CategoryAdmin>>('/api/categories', { params: toParams(query) });
  }

  categoryOptions(includeId?: number | null): Observable<CategoryOption[]> {
    return this.http.get<CategoryOption[]>('/api/categories/options', { params: toParams({ includeId }) });
  }

  categoryNameAvailable(name: string, excludeId?: number | null): Observable<{ available: boolean }> {
    return this.http.get<{ available: boolean }>('/api/categories/name-availability', { params: toParams({ name, excludeId }) });
  }

  createCategory(name: string): Observable<CategoryAdmin> {
    return this.http.post<CategoryAdmin>('/api/categories', { name });
  }

  updateCategory(id: number, name: string): Observable<CategoryAdmin> {
    return this.http.put<CategoryAdmin>(`/api/categories/${id}`, { name });
  }

  setCategoryStatus(id: number, isActive: boolean): Observable<void> {
    return this.http.patch<void>(`/api/categories/${id}/status`, { isActive });
  }

  // Products
  products(query: ProductListQuery): Observable<ProductListResponse> {
    return this.http.get<ProductListResponse>('/api/products', { params: toParams(query) });
  }

  product(id: number): Observable<ProductAdminDetail> {
    return this.http.get<ProductAdminDetail>(`/api/products/${id}`);
  }

  createProduct(product: UpsertProduct): Observable<ProductAdminDetail> {
    return this.http.post<ProductAdminDetail>('/api/products', product);
  }

  updateProduct(id: number, product: UpsertProduct): Observable<ProductAdminDetail> {
    return this.http.put<ProductAdminDetail>(`/api/products/${id}`, product);
  }

  setProductStatus(id: number, isActive: boolean): Observable<void> {
    return this.http.patch<void>(`/api/products/${id}/status`, { isActive });
  }

  setProductStock(id: number, stock: number): Observable<void> {
    return this.http.patch<void>(`/api/products/${id}/stock`, { stock });
  }

  uploadProductImage(id: number, file: File): Observable<{ imageUrl: string | null }> {
    const form = new FormData();
    form.append('file', file);
    return this.http.put<{ imageUrl: string | null }>(`/api/products/${id}/image`, form);
  }

  deleteProductImage(id: number): Observable<void> {
    return this.http.delete<void>(`/api/products/${id}/image`);
  }

  // Orders
  orders(query: AdminOrdersQuery): Observable<Paged<OrderSummary>> {
    return this.http.get<Paged<OrderSummary>>('/api/orders', { params: toParams(query) });
  }

  order(id: number): Observable<OrderDetail> {
    return this.http.get<OrderDetail>(`/api/orders/${id}`);
  }

  changeOrderStatus(id: number, status: OrderStatus, note: string | null): Observable<OrderDetail> {
    return this.http.patch<OrderDetail>(`/api/orders/${id}/status`, { status, note });
  }

  exportOrders(query: AdminOrdersQuery): Observable<Blob> {
    return this.http.get('/api/orders/export', { params: toParams(query), responseType: 'blob' });
  }

  // Users
  users(query: { page?: number; pageSize?: number; search?: string | null; role?: UserRole | null }): Observable<Paged<UserAdmin>> {
    return this.http.get<Paged<UserAdmin>>('/api/users', { params: toParams(query) });
  }

  createAdmin(fullName: string, email: string, password: string): Observable<UserAdmin> {
    return this.http.post<UserAdmin>('/api/users/admins', { fullName, email, password });
  }

  setUserStatus(id: number, isActive: boolean): Observable<void> {
    return this.http.patch<void>(`/api/users/${id}/status`, { isActive });
  }
}
