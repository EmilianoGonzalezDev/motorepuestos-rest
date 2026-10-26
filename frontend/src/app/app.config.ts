import { registerLocaleData } from '@angular/common';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import localeEsAr from '@angular/common/locales/es-AR';
import {
  ApplicationConfig,
  DEFAULT_CURRENCY_CODE,
  Injectable,
  LOCALE_ID,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { Title } from '@angular/platform-browser';
import {
  RouterStateSnapshot,
  TitleStrategy,
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
  withViewTransitions,
} from '@angular/router';
import { routes } from './app.routes';
import { AuthService } from './core/auth/auth.service';
import { CartStore } from './core/cart/cart.store';
import { FavoritesStore } from './core/favorites/favorites.store';
import { authInterceptor, errorToastInterceptor } from './core/http/interceptors';

registerLocaleData(localeEsAr);

/** "Catálogo | MotoRepuestos" */
@Injectable({ providedIn: 'root' })
class AppTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const title = this.buildTitle(snapshot);
    this.title.setTitle(title ? `${title} | MotoRepuestos` : 'MotoRepuestos | Repuestos y accesorios para tu moto');
  }
}

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(
      routes,
      withComponentInputBinding(),
      withViewTransitions(),
      withInMemoryScrolling({ scrollPositionRestoration: 'top', anchorScrolling: 'enabled' }),
    ),
    provideHttpClient(withFetch(), withInterceptors([authInterceptor, errorToastInterceptor])),
    { provide: TitleStrategy, useClass: AppTitleStrategy },
    { provide: LOCALE_ID, useValue: 'es-AR' },
    { provide: DEFAULT_CURRENCY_CODE, useValue: 'ARS' },
    provideAppInitializer(() => {
      // Stores subscribe to auth events, so they must exist before the session is restored.
      inject(CartStore);
      inject(FavoritesStore);
      return inject(AuthService).restoreSession();
    }),
  ],
};
