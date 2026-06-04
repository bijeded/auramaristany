# Handoff: Aura Maristany — Plataforma web (coach de salud, mujeres 40+)

## Overview
Aura Maristany es una plataforma para una coach de salud integral cuyo público son mujeres de 40 años o más. Tiene **dos productos** en una sola base:

1. **Portal de la clienta** (mobile-first, 375–390px): la clienta abre la app cada día para ver su entrenamiento, registrar su progreso, ver su evolución, leer mensajes de Aura y gestionar su cuenta.
2. **Panel de administración** (desktop-first, ~1080–1280px): Aura gestiona su negocio — ingresos, clientas, contenido de los programas (CMS), mensajes y el cuestionario de onboarding.

Este bundle contiene un **prototipo interactivo de alta fidelidad** con las **17 pantallas** del producto, navegable y funcional (marcar ejercicios, llenar campos, cambiar de pestañas, abrir modales, etc.).

## About the Design Files
Los archivos de este bundle son **referencias de diseño hechas en HTML/React-sin-build (Babel en el navegador)** — prototipos que muestran la apariencia y el comportamiento deseados, **no código de producción para copiar tal cual**.

La tarea es **recrear estos diseños en el entorno de la base de código destino** (el brief original asume Next.js + React + Stripe + un editor tipo Tiptap, pero usa lo que el proyecto ya tenga) siguiendo sus patrones y librerías establecidas. Si aún no existe un entorno, elige el framework más apropiado (se recomienda **Next.js + React**, con **Recharts** para gráficas y **Stripe** para pagos/portal de cliente).

El prototipo NO usa Recharts (las gráficas están dibujadas a mano en SVG para no depender de librerías); en producción **sí conviene usar Recharts**.

## Fidelity
**Alta fidelidad (hi-fi).** Colores, tipografía, espaciados, radios, sombras, estados y micro-interacciones son finales. Recrea la UI fiel al pixel usando las librerías y patrones de la base de código destino. Las imágenes (fotos lifestyle, thumbnails de video, foto de Aura) están como **placeholders rayados con etiqueta** — la clienta/Aura subirá las reales.

---

## Design Tokens

### Colores
| Token | Hex | Uso |
|---|---|---|
| Primario (rosa polvo) | `#eddbd8` | Fondos suaves, cards cálidas, acentos |
| Rosa soft | `#f6ecea` | Fondos de pantallas de auth |
| Rosa deep | `#e0c8c3` | Tracks de progreso sobre rosa, bordes |
| Secundario (lavanda) | `#9982f4` | Botones de acción, acentos, activos, badges |
| Lavanda dark | `#7a63d4` | Hover de botones, texto sobre lavanda-tint |
| Lavanda tint | `rgba(153,130,244,0.10)` | Fondos de selección/badges |
| Negro | `#1a1a1a` | Texto principal, sidebar admin |
| Blanco | `#ffffff` | Fondos base |
| Gris claro | `#f5f5f5` | Fondos alternos, separadores, inputs de notas |
| Gris línea | `#ececec` | Bordes sutiles |
| Gris texto | `#6b6b6b` | Texto secundario |
| Gris suave | `#9a9a9a` | Placeholders, texto terciario |
| Error | `#e05c5c` | Errores, pago fallido / past_due |
| Éxito | `#4caf7d` (deep `#3a9468`) | Confirmaciones, checks, estados "activa" |
| Amarillo (por vencer) | `#e0a23c` | Estado "por vencer" |
| Marrón texto sobre rosa | `#5e3d38` / `#8a5a52` / `#a87b73` | Texto/labels sobre fondos rosa |

### Tipografía
- **Encabezados y botones:** `Oswald` (weights 400/500/600/700). Botones usan 500; títulos 600.
- **Texto, labels, navegación:** `Hind` (weights 300/400/500/600/700).
- Escala usada: display 34–38px, h1 27px, h2 21px, h3 17px, body 16px, small 13.5px, tiny 11.5px. Eyebrow: Oswald 12px, uppercase, letter-spacing 1.4px, color lavanda-dark.

### Espaciado, radios y sombras
- Radios: inputs `8px`, cards `12px`, contenedores grandes `16px`, modales `18px`, pills `999px`.
- Padding de card estándar: `24px`.
- Sombras (muy suaves): `--shadow-soft: 0 1px 2px rgba(26,26,26,.04), 0 6px 18px rgba(26,26,26,.05)`; card `0 1px 3px rgba(26,26,26,.05), 0 10px 30px rgba(26,26,26,.06)`; pop/modal `0 12px 40px rgba(26,26,26,.16)`.
- Altura mínima de botones **48px** (hit target accesible). Áreas táctiles ≥ 44×44.
- Transiciones 150–300ms ease.

### Componentes base (ver `aura/styles.css` y `aura/components.jsx`)
- **Botones:** primario (fondo lavanda, texto blanco, Oswald 500), secundario (borde lavanda, texto lavanda, fondo transparente), ghost, dark, success, danger-text, link. Variantes `-lg`, `-sm`, `-block`.
- **Inputs:** borde gris, fondo blanco, focus = borde lavanda + ring `0 0 0 3px lavanda-tint`. Ícono opcional centrado verticalmente a la izquierda; toggle de mostrar/ocultar en contraseñas. **Labels siempre visibles** (no solo placeholder).
- **Badges de estado:** Activa (verde), Vencida/Pago fallido (rojo), Por vencer (amarillo), Cancelada (gris), lavanda, rosa, borrador/publicado.
- **Avatar:** circular, iniciales como fallback sobre fondo rosa (o lavanda para Aura).
- **Checkbox redondo** (ejercicios): vacío = borde rosa-deep; marcado = fondo lavanda + check blanco, con animación de escala.
- **Placeholder de imagen** (`.img-ph`): fondo rosa-soft con rayas diagonales lavanda al 7% + etiqueta monoespaciada en minúsculas (ej. "mujer 40+ activa · lifestyle").
- **Skeleton loaders** (shimmer) — usar en lugar de spinners para estados de carga.
- **Toast:** aparece arriba centrado, fondo verde éxito, texto blanco, 2.6s. Copy que celebra ("¡Guardado! Sigue así 💜").

---

## Reglas de dominio IMPORTANTES (decisiones del cliente)
Estas reglas se ajustaron con la clienta y **deben respetarse**:

1. **Un video por ejercicio.** Cada ejercicio del día tiene su propio video de demostración (además de videos generales del día como calentamiento y estiramiento). Hay "varios videos por día".
2. **Captura por serie.** Cada ejercicio se registra **una fila por serie**: si son 3 series, hay 3 filas de captura de **reps** y **peso utilizado (kg)**. No hay campo de "nota" en la captura.
3. **Nunca se registra el cuerpo.** Jamás se mide peso corporal ni medidas (cintura/cadera). La pantalla de Progreso solo mide **desempeño**: entrenamientos completados, racha, repeticiones totales y la progresión del **peso que levanta** por ejercicio. **Sí** existen **fotos de progreso** (con filtros Frente/Lado/Espalda) — eso se conserva.
4. **Lista de ejercicios = estilo "Tarjetas".** Cada ejercicio es una tarjeta propia con número, checkbox redondo, badges de series×reps y descanso, nota del coach (guía, no captura), video y tabla de captura por serie. (Es la única variante; se exploraron otras pero esta es la elegida.)
5. **Copy:** cálido, en primera persona ("Mi progreso", "Mis notas"), celebra los logros, sin tecnicismos. **Evitar la palabra "bienestar".**
6. **Logo:** sobre fondos claros/rosa usar el logo **en negro** (versión monocromática). Mantenerlo a la misma altura fija arriba en todas las pantallas de auth.

---

## Screens / Views

### Flujo de cliente (público)
1. **Checkout / Programa** (`/checkout/[variantSlug]`) — Una columna, fondo rosa-soft. Logo negro arriba, hero del programa (nombre Oswald grande + subtítulo), imagen lifestyle full-width con gradiente, card de resumen (calendario "6 meses", nivel, "Ejercicios · Alimentación · Hábitos", "acceso nuevo cada día", precio "MX$799 / mes"), testimonial en card rosa, CTA "Comenzar ahora" → registro, footer mínimo. **Estado de error**: si falta prerequisito, card roja con candado y "Ver mis programas activos".
2. **Login** (`/auth/login`) — Card centrada. Título "Bienvenida de vuelta", inputs correo (ícono sobre) y contraseña (ícono candado + toggle), link "¿Olvidaste tu contraseña?", botón "Ingresar", separador "o", link a registro. **Estado de error**: banner rojo "Correo o contraseña incorrectos."
3. **Registro** (`/auth/register`) — Nombre, correo, contraseña (8+), confirmar, checkbox de términos (botón deshabilitado hasta aceptar), "Crear mi cuenta". **Estado de éxito**: ícono de sobre animado, "¡Ya casi! Revisa tu correo", "Reenviar correo".
4. **Recuperar contraseña** (`/auth/reset-password`) — 3 pasos: (1) solicitar enlace por correo; (2) confirmación "Revisa tu correo" con sobre+check verde; (3) nueva contraseña (desde el enlace del email).
5. **Onboarding / Cuestionario** (`/onboarding/questionnaire`) — Wizard, una pregunta por pantalla, barra de progreso "Pregunta X de N". Pantalla de bienvenida (foto de Aura, "¡Hola! Soy Aura"). Tipos de pregunta: selección única (cards seleccionables), selección múltiple ("Puedes elegir varias"), número (input grande + unidad, teclado numérico), texto libre (textarea, opcional). Pantalla final con corazón y "Ver mi programa de hoy →".

### Portal de la clienta (suscripción activa) — bottom tab nav (Hoy / Progreso / Mensajes / Mi Cuenta)
6. **Hoy** (`/portal/today`) — **La pantalla más importante.** Scroll vertical continuo. Top bar (logo "Aura", fecha, avatar). Banner de progreso del programa (Día X de 180 + barra + badge programa·nivel). Título del día (Oswald grande) + tag de tipo (Entrenamiento/Descanso/Evaluación) + duración. Bloques de contenido en orden: texto enriquecido, video YouTube (thumbnail + play → carga iframe con `rel=0&modestbranding=1&iv_load_policy=3`), **lista de ejercicios (Tarjetas)**, PDF adjunto, video de estiramiento. Cada **ejercicio**: checkbox redondo (al marcar, atenúa la tarjeta y tacha el nombre), badges series×reps y descanso, nota del coach, **video del ejercicio**, **captura por serie** (filas reps + peso). Banner de celebración al completar todo. Campo de notas generales. Botón de guardado **sticky abajo** (auto-guardado con debounce 2s; verde "✓ Progreso del día guardado" cuando está guardado). **Estados:** día de descanso (card rosa con luna, sin ejercicios), contenido no disponible (reloj), suscripción vencida/past_due (banner rojo arriba + overlay semitransparente sobre el contenido).
7. **Mi Progreso** (`/portal/history`) — Pestañas **Desempeño** y **Fotos**. *Desempeño:* 3 stat cards (Entrenamientos 11/12, Días de racha, Reps totales); gráfica de línea "Peso que levantas" con selector de ejercicio (pills) y de período (1 mes / 3 meses / Todo); historial de entrenamientos. **NO** hay peso corporal ni medidas. *Fotos:* filtros Todas/Frente/Lado/Espalda, grid 3 columnas con fecha, visor full-screen con flechas; estado vacío con "+ Agregar foto".
8. **Mensajes** (`/portal/messages`) — Solo lectura. Lista (no leído = fondo blanco + punto lavanda + negrita; leído = fondo gris). Detalle: asunto, "De: Aura Maristany" + fecha, cuerpo con saltos de línea. Estado vacío.
9. **Mi Cuenta** (`/portal/settings`) — Avatar grande con botón de cámara, nombre, correo, "Editar perfil" (modal). Card "Mi programa" (programa+variante, inicio, estado, Mes X de 6 + mini barra). Card "Pago y suscripción" (próximo cobro, método de pago, "Gestionar suscripción y pagos →" = Stripe Customer Portal). "Cambiar contraseña" (modal). "Cerrar sesión" en rojo.

### Panel de administración — sidebar nav (Dashboard / Clientes / Contenido / Mensajes / Onboarding)
10. **Dashboard** (`/admin/dashboard`) — 4 KPI cards (MRR con % vs mes anterior, suscripciones activas, renuevan esta semana, pago fallido en rojo). Gráfica de barras "Ingresos por mes" (en prod: Recharts). Distribución: clientes por programa (barras horizontales) + ingresos por programa (donut). Tabla de pagos recientes con badge de estado.
11. **Clientes** (`/admin/clients`) — Header con contador y búsqueda. Filtros (chips de programa y de estado). Tabla (desktop) / cards (mobile): avatar+nombre, badge programa·variante, inscripción, próximo cobro, badge de estado, "Ver". Paginación. Estado vacío con "Limpiar filtros".
12. **Detalle de cliente** (`/admin/clients/[id]`) — Header (avatar, nombre, correo, badge estado). Pestañas: **Resumen** (datos del programa + mini barra + "Enviar mensaje"), **Onboarding** (preguntas y respuestas), **Progreso** (calendario de entrenamientos: completo/parcial/sin registro — NO datos corporales), **Fotos** (grid), **Pagos** (tabla de facturas), **Mensajes** (historial + "Nuevo mensaje").
13. **Contenido (overview)** (`/admin/content`) — 3 cards de programa (CuarentaMás, CuarentaMás Extra, Strong & Fit) con stats, barra de contenido publicado y alertas ("⚠ Serie 9 sin publicar").
14. **Contenido (programa)** (`/admin/content/[programId]`) — CuarentaMás: tabs de variante + **grid 6 meses × 30 días** (celdas: publicado/borrador/vacío) que abren el editor. Extra/Strong & Fit: **timeline de series** con progreso y "Editar →" que despliega la lista de días.
15. **Editor de día (CMS)** (`/admin/content/.../days/[dayId]`) — **La pantalla más compleja.** 2 columnas (editor 58% / preview 40%). Top bar: volver, "Día 12", badge Borrador/Publicado, "Guardado hace 5 seg", botones Guardar / Publicar(/Despublicar). Campos: título (Oswald), duración, tipo de día (pills). **Bloques** reordenables con handle de drag y botón eliminar: Texto (toolbar B/I/H2/H3/listas, contentEditable), Video YouTube (URL + thumbnail + título), PDF (drag&drop + etiqueta), Imagen (drag&drop), **Ejercicios** (por ejercicio: nombre, series×reps×descanso, **URL de video del ejercicio**, nota "registrará reps y peso en cada serie"; "+ Agregar ejercicio"). Paleta para insertar bloques. Preview en vivo del portal de la clienta.
16. **Mensajes (admin)** (`/admin/messages`) — Tabs Enviados/Borradores. Lista con ícono individual/broadcast, destinatario, asunto, "X leídos de Y". Modal "Nuevo mensaje": tipo individual/broadcast, selector de destinatarios (autocomplete o por programa con checkboxes y conteo), asunto, cuerpo, "Guardar borrador"/"Enviar ahora" → confirmación.
17. **Configuración de onboarding** (`/admin/onboarding-settings`) — Lista de preguntas reordenables (handle, editar, eliminar) con badge de tipo y "Obligatoria: Sí/No". Modal crear/editar (texto, tipo, opciones dinámicas para selección, toggle obligatoria). Nota: el cuestionario se muestra una sola vez tras el primer pago.

---

## Interactions & Behavior
- **Navegación cliente:** bottom tab fija (Hoy/Progreso/Mensajes/Mi Cuenta), tab activo en lavanda con línea indicadora arriba; badge rojo de no leídos en Mensajes.
- **Navegación admin:** sidebar oscura fija (desktop), hamburguesa en tablet/mobile.
- **Hoy:** marcar checkbox atenúa la tarjeta (opacity ~.55) y tacha el nombre; al completar todos, banner de celebración. Auto-guardado con debounce 2s; el botón sticky pasa a verde. Videos cargan el iframe solo al hacer tap (lazy).
- **Onboarding:** botón "Siguiente" deshabilitado hasta responder preguntas obligatorias; barra de progreso animada.
- **Formularios:** validación visible (banner/borde rojo). Términos obligatorios para registrar.
- **Modales/Drawers:** overlay con blur; modales centrados (pop-in), drawers desde abajo (sheet-up). Confirmación destructiva en "Enviar a N clientes".
- **Transiciones:** 200–300ms ease. **Importante:** el estado base visible debe ser el final; animar *desde* oculto (no dejar contenido en opacity:0 por fill-mode) para que impresión/PDF/reduced-motion muestren contenido.
- **Estados por pantalla:** normal, carga (skeleton, no spinner), vacío, error. El brief pide los 4 en cada pantalla.

## State Management
- **Auth/sesión:** usuaria autenticada, rol (cliente/admin), estado de suscripción (`activa`/`past_due`/`vencida`/`por_vencer`/`cancelada`).
- **Hoy:** `checked` por ejercicio; `exVals[ejercicioId]` = **array por serie** `[{reps, peso}, …]`; `notas` del día; `saved` (auto-guardado debounced).
- **Onboarding:** `step` actual y `answers` por pregunta (string | número | array).
- **Progreso:** pestaña activa; ejercicio y período seleccionados para la gráfica.
- **Mensajes:** mensaje abierto (lista vs detalle en mobile).
- **Admin:** filtros y búsqueda de clientes; cliente y pestaña seleccionados; programa/serie/día seleccionados; bloques del editor (lista reordenable) y estado publicado/borrador; composición de mensaje (tipo, destinatarios).
- **Datos:** en producción, fetch por React Query/equivalente; Stripe para pagos y Customer Portal; almacenamiento de videos como URLs de YouTube; PDFs/imágenes/fotos en storage.

## Assets
- **Logo:** `aura/assets/logo.png` (incluido). Marca "am" + "Aura Maristany". En fondos claros usar la **versión en negro** (en el prototipo se logra con filtro `grayscale(1) brightness(0)`); idealmente exportar un SVG monocromo real.
- **Imágenes:** todas son **placeholders** (fotos lifestyle, foto de Aura, thumbnails de video, fotos de progreso). El cliente subirá las reales.
- **Iconos:** set propio line-style en SVG (`aura/icons.jsx`); en producción puede sustituirse por la librería de íconos del proyecto (estilo lineal, ~1.7px stroke).
- **Fuentes:** Oswald + Hind (Google Fonts).

## Files (referencia del prototipo)
- `index.html` — entrada; carga React 18 + Babel y todos los scripts. **El riel izquierdo gris es solo andamiaje de revisión** (navegador entre las 17 pantallas + toggles de estado); NO es parte del producto.
- `aura/styles.css` — design tokens y clases de componentes.
- `aura/icons.jsx` — set de íconos SVG (`window.Icon`).
- `aura/components.jsx` — primitivos compartidos: contexto/navegación, Logo, Avatar, StatusBadge, ImgPh, Track, CheckRound/CheckSq, Field, Sheet (modal/drawer), **Phone** (marco iPhone), **Browser** (marco desktop), BottomTabs, TypeTag, EmptyState, ToastHost, Sk (skeleton).
- `aura/data.js` — datos mock (clienta, día de hoy, ejercicios, progreso, mensajes, onboarding, y todo el bloque `admin`).
- `aura/client-today.jsx` — pantalla Hoy + lista de ejercicios "Tarjetas" + video por ejercicio + captura por serie + estados.
- `aura/client-auth.jsx` — Checkout, Login, Registro, Recuperar contraseña.
- `aura/client-onboarding.jsx` — wizard del cuestionario.
- `aura/client-progress.jsx` — Progreso (Desempeño + Fotos) y gráfica SVG.
- `aura/client-messages.jsx` — Mensajes (lista + detalle).
- `aura/client-settings.jsx` — Mi Cuenta + modales.
- `aura/admin-shell.jsx` — sidebar + AdminHeader + gráficas (barras, donut).
- `aura/admin-dashboard.jsx`, `aura/admin-clients.jsx`, `aura/admin-content.jsx`, `aura/admin-messages.jsx` — pantallas del panel admin (esta última incluye Mensajes y Configuración de onboarding).
- `aura/app.jsx` — shell de navegación, store y registro de pantallas.

## Cómo correr el prototipo
Abre `index.html` en un servidor estático (o el preview). Usa el riel izquierdo para saltar entre las 17 pantallas; en "Hoy" hay toggles para ver los estados especiales. La navegación in-app (tabs, botones, links) también funciona.
