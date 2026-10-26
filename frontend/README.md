# MotoRepuestos Web (Angular)

SPA de la tienda y del backoffice. Ver el [README principal](../README.md) para la arquitectura completa.

```bash
npm install
npm start          # http://localhost:4200  (proxy a la API en :5080, ver proxy.conf.json)
npm run build:prod # build de producción en dist/
npx ng test        # specs con Vitest
```

- Angular 21 · componentes standalone · signals · zoneless · lazy loading por feature
- Tailwind CSS v4 (tokens de diseño en `src/styles.css`) · íconos Lucide
- Sin librerías de UI ni de gráficos: modal, toasts, paginación, editor rico y gráficos SVG son propios
- Estado en memoria: `AuthService` (JWT en memoria + refresh por cookie HttpOnly), `CartStore`, `FavoritesStore`
