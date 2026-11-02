# KPMG Comic

App para eventos que convierte la historia de una persona en KPMG en un cómic personalizado y lo imprime como fanzine plegable en A4.

**Flujo:** bienvenida → foto con la cámara → formulario → generación con Gemini (6 imágenes y 4 textos) → vista digital e impresión.

## Ejecutar en local

**Requisitos:** Node.js

1. Instala las dependencias: `npm install`
2. Copia `.env.example` a `.env` y rellena `GEMINI_API_KEY_1` (y `GEMINI_API_KEY_2` si tienes una segunda clave)
3. Arranca la app: `npm run dev`

La cámara solo funciona en `localhost` o con HTTPS.

## Comandos

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo en el puerto 3000 |
| `npm run build` | Compila el frontend en `dist/` |
| `npm run preview` | Sirve la compilación junto con la API (así corre en producción) |
| `npm test` | Pruebas del backend con Gemini simulado: no gastan créditos |
| `npm run typecheck` | Comprueba los tipos |

## Backend

La API son plugins de Vite (`server/apiPlugin.ts`), por lo que corre dentro de `vite` y `vite preview`.

| Endpoint | Uso |
| --- | --- |
| `POST /api/comic-generate` | Genera el cómic |
| `GET /api/health` | Comprobación de estado |
| `GET /api/metrics` | Métricas Prometheus. Requiere `METRICS_TOKEN` y la cabecera `Authorization: Bearer <token>` |

Todos los ajustes están documentados en `.env.example`.

### Cómo controla errores y gasto

- **Viñetas guardadas:** las imágenes generadas se guardan 30 minutos en memoria. Si falla una, al reintentar solo se paga la que falta.
- **Reintentos:** hasta 3 intentos por imagen, alternando claves. Un error de contenido o de petición no se repite, y un timeout solo se repite una vez porque puede haberse cobrado.
- **Claves en pausa:** una clave con límite alcanzado, sin cuota o inválida deja de usarse un tiempo.
- **Cola:** 4 cómics a la vez y hasta 20 en espera, 90 segundos como máximo. Quien cierra la página mientras espera no gasta nada.
- **Tope de gasto:** `MAX_IMAGE_CALLS_PER_HOUR` corta la generación en todo el servidor al llegar al límite.
- **Seguimiento:** `app_ai_calls_total` en `/api/metrics` y los eventos `comic.ai_call.failed` en `logs/usage.log`.

Estos contadores están en memoria y se pierden al reiniciar. Con varias instancias, cada una tendría los suyos.

## Impresión

La hoja se imprime en A4 horizontal y cubre todo el papel. En el diálogo de impresión hay que usar **márgenes: ninguno** y **escala 100 %**.

Solo una impresora con impresión sin bordes llega de verdad al borde del papel. Las demás dejan un pequeño margen blanco y pierden esos milímetros de dibujo, por eso los textos quedan a 6 mm o más del borde exterior.

## Pendiente

- **Fuente KPMG:** los títulos usan Arial o Arial Black porque el repositorio no incluye los archivos de la fuente. Hay que añadirlos en `public/fonts/` y declarar el `@font-face` en `index.css`.
