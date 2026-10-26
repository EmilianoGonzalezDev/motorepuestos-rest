import { HttpClient, HttpContext } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import {
  AuthResponse,
  Cart,
  CatalogCategory,
  CatalogQuery,
  DemoStatus,
  OrderDetail,
  OrderStatus,
  OrderSummary,
  Paged,
  PaymentType,
  PriceRange,
  ProductCard,
  ProductDetail,
  SearchSuggestion,
  User,
} from '../models/api.models';
import { toParams } from '../http/http-utils';

/** Public storefront endpoints (/api/catalog). */
@Injectable({ providedIn: 'root' })
export class CatalogApi {
  private readonly http = inject(HttpClient);

  categories(): Observable<CatalogCategory[]> {
    return this.http.get<CatalogCategory[]>('/api/catalog/categories');
  }

  products(query: CatalogQuery): Observable<Paged<ProductCard>> {
    return this.http.get<Paged<ProductCard>>('/api/catalog/products', { params: toParams(query) });
  }

  product(id: number): Observable<ProductDetail> {
    return this.http.get<ProductDetail>(`/api/catalog/products/${id}`);
  }

  related(id: number, take = 4): Observable<ProductCard[]> {
    return this.http.get<ProductCard[]>(`/api/catalog/products/${id}/related`, { params: { take } });
  }

  suggestions(q: string, take = 8): Observable<SearchSuggestion[]> {
    return this.http.get<SearchSuggestion[]>('/api/catalog/suggestions', { params: { q, take } });
  }

  priceRange(categoryId?: number | null): Observable<PriceRange> {
    return this.http.get<PriceRange>('/api/catalog/price-range', { params: toParams({ categoryId }) });
  }
}

/** Cart endpoints; the guest cart id header is added by the cart interceptor. */
@Injectable({ providedIn: 'root' })
export class CartApi {
  private readonly http = inject(HttpClient);

  get(): Observable<Cart> {
    return this.http.get<Cart>('/api/cart');
  }

  add(productId: number, quantity: number): Observable<Cart> {
    return this.http.post<Cart>('/api/cart/items', { productId, quantity });
  }

  update(productId: number, quantity: number): Observable<Cart> {
    return this.http.put<Cart>(`/api/cart/items/${productId}`, { quantity });
  }

  remove(productId: number): Observable<Cart> {
    return this.http.delete<Cart>(`/api/cart/items/${productId}`);
  }

  clear(): Observable<void> {
    return this.http.delete<void>('/api/cart');
  }

  merge(guestCartId: string): Observable<Cart> {
    return this.http.post<Cart>('/api/cart/merge', { guestCartId });
  }
}

@Injectable({ providedIn: 'root' })
export class OrdersApi {
  private readonly http = inject(HttpClient);

  place(paymentType: PaymentType, notes: string | null): Observable<OrderDetail> {
    return this.http.post<OrderDetail>('/api/orders', { paymentType, notes });
  }

  mine(page: number, pageSize: number, status?: OrderStatus | null): Observable<Paged<OrderSummary>> {
    return this.http.get<Paged<OrderSummary>>('/api/orders/mine', { params: toParams({ page, pageSize, status }) });
  }

  get(id: number): Observable<OrderDetail> {
    return this.http.get<OrderDetail>(`/api/orders/${id}`);
  }

  cancel(id: number, reason: string | null): Observable<OrderDetail> {
    return this.http.post<OrderDetail>(`/api/orders/${id}/cancel`, { reason });
  }
}

@Injectable({ providedIn: 'root' })
export class FavoritesApi {
  private readonly http = inject(HttpClient);

  list(): Observable<ProductCard[]> {
    return this.http.get<ProductCard[]>('/api/favorites');
  }

  ids(): Observable<number[]> {
    return this.http.get<number[]>('/api/favorites/ids');
  }

  add(productId: number): Observable<void> {
    return this.http.put<void>(`/api/favorites/${productId}`, null);
  }

  remove(productId: number): Observable<void> {
    return this.http.delete<void>(`/api/favorites/${productId}`);
  }
}

@Injectable({ providedIn: 'root' })
export class DemoApi {
  private readonly http = inject(HttpClient);

  status(context?: HttpContext): Observable<DemoStatus> {
    return this.http.get<DemoStatus>('/api/demo', { context });
  }
}

@Injectable({ providedIn: 'root' })
export class AuthApi {
  private readonly http = inject(HttpClient);

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>('/api/auth/login', { email, password }, { withCredentials: true });
  }

  register(fullName: string, email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>('/api/auth/register', { fullName, email, password }, { withCredentials: true });
  }

  refresh(): Observable<AuthResponse> {
    return this.http.post<AuthResponse>('/api/auth/refresh', null, { withCredentials: true });
  }

  logout(): Observable<void> {
    return this.http.post<void>('/api/auth/logout', null, { withCredentials: true });
  }

  profile(): Observable<User> {
    return this.http.get<User>('/api/account/profile');
  }

  updateProfile(fullName: string, email: string): Observable<User> {
    return this.http.put<User>('/api/account/profile', { fullName, email });
  }

  changePassword(currentPassword: string, newPassword: string): Observable<void> {
    return this.http.put<void>('/api/account/password', { currentPassword, newPassword }, { withCredentials: true });
  }
}
