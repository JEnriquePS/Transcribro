# ADR-005: Design Tokens semánticos con soporte Dark/Light Mode

## Estado

Propuesto

## Contexto

El frontend de Transcribro usa colores primitivos de Tailwind directamente en ~12 archivos de componentes (e.g., `bg-gray-900`, `text-cyan-400`, `border-gray-700`). Actualmente es dark-only sin abstracción de colores.

Problemas identificados:

1. **Sin capa semántica** — cambiar la paleta requiere editar ~60+ clases en 12 archivos
2. **Dark-only** — no hay soporte para light mode ni respeta `prefers-color-scheme`
3. **Contraste no verificable** — sin tokens semánticos, no se puede garantizar contraste WCAG en ambos modos
4. **Colores inconsistentes** — se usan variantes arbitrarias del mismo concepto (e.g., `gray-400`, `gray-500`, `gray-600` para "texto secundario")

### Inventario de colores actual

| Concepto | Clases usadas (dark-only) |
|----------|--------------------------|
| Fondo base | `bg-gray-950`, `bg-gray-900` |
| Fondo elevado (cards) | `bg-gray-800`, `bg-gray-800/50` |
| Texto primario | `text-gray-100`, `text-gray-200` |
| Texto secundario | `text-gray-400`, `text-gray-500` |
| Texto muted | `text-gray-600` |
| Acento primario | `cyan-400`, `cyan-500` |
| Borders | `border-gray-700`, `border-gray-800` |
| Success | `green-400`, `green-500` |
| Error | `red-400`, `red-500` |
| Warning | `amber-400` |
| Info/Extracting | `blue-400`, `blue-500` |
| Formatting | `indigo-400`, `indigo-500` |

### Stack

- Tailwind CSS v4 con config CSS-first (`@import "tailwindcss"`)
- Plugin `@tailwindcss/vite`
- Sin `tailwind.config.*` — usa defaults de v4

## Decisión

Implementar **design tokens semánticos** usando Tailwind v4 `@theme` con soporte nativo de dark/light mode.

### Estrategia

1. **Capa de tokens en CSS** — definir tokens semánticos en `index.css` usando `@theme` (genera utilities) y CSS custom properties
2. **Dos temas** — light (default, sigue `prefers-color-scheme`) y dark, con toggle manual persistido en `localStorage`
3. **Migración de clases** — reemplazar primitivos (`bg-gray-900`) con semánticos (`bg-surface`) en todos los componentes
4. **Tailwind `dark:` variant** — usar class strategy para dark mode con toggle manual

### Tokens semánticos propuestos

```
Surface:        surface, surface-elevated, surface-overlay
Text:           text-primary, text-secondary, text-muted
Border:         border-default, border-subtle
Accent:         accent, accent-hover, accent-muted
Feedback:       success, error, warning, info
Status:         status-pending, status-extracting, status-transcribing, status-formatting
```

### Implementación

```css
/* index.css */
@import "tailwindcss";

@theme {
  --color-surface: var(--surface);
  --color-surface-elevated: var(--surface-elevated);
  --color-text-primary: var(--text-primary);
  --color-accent: var(--accent);
  /* ... */
}

:root {
  --surface: theme(colors.white);
  --surface-elevated: theme(colors.gray.50);
  --text-primary: theme(colors.gray.900);
  --accent: theme(colors.cyan.600);
  /* ... */
}

.dark {
  --surface: theme(colors.gray.950);
  --surface-elevated: theme(colors.gray.800);
  --text-primary: theme(colors.gray.100);
  --accent: theme(colors.cyan.400);
  /* ... */
}
```

### Toggle de tema

- Componente `ThemeToggle` en el header
- Lee `prefers-color-scheme` como default
- Override manual persistido en `localStorage` key `theme`
- Aplica clase `dark` en `<html>` element

## Consecuencias

### Se facilita

- **Tematización** — cambiar toda la paleta editando solo `index.css`
- **Accesibilidad** — tokens garantizan contraste correcto en ambos modos
- **Consistencia** — un solo lugar define qué es "texto secundario" o "fondo elevado"
- **Preferencia del usuario** — respeta `prefers-color-scheme` del sistema operativo
- **Mantenimiento** — agregar nuevos componentes referencia tokens, no colores arbitrarios

### Se dificulta

- **Migración inicial** — hay que reemplazar ~60+ clases en 12 archivos
- **Complejidad CSS** — `index.css` pasa de 1 línea a ~50-60 líneas
- **Verificación dual** — cada cambio visual debe probarse en ambos modos

### Mitigación

- La migración se hace archivo por archivo, es mecánica y de bajo riesgo
- El archivo CSS sigue siendo pequeño (~60 líneas)
- Los tokens actúan como contrato: si el contraste es correcto en la definición, es correcto en todo componente que los use
