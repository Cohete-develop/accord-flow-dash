## Cómo está construido EngineXpert hoy

**Frontend** (`src/components/AIChatBubble.tsx`): burbuja flotante en la esquina inferior derecha que abre un panel de chat de 400×600px. Mantiene historial de mensajes en estado local (no persiste entre sesiones), envía cada mensaje vía `fetch` con streaming SSE al edge function, renderiza markdown con `react-markdown`. Reglas de formato ya optimizadas para chat angosto (cards en vez de tablas).

**Backend** (`supabase/functions/crm-assistant/index.ts`): edge function pública (sin `verify_jwt` en config.toml). Flujo:

1. Valida el JWT del caller con `getClaims`
2. Crea cliente Supabase autenticado con el token del usuario → todas las queries respetan RLS automáticamente (la empresa correcta sale sola, incluyendo impersonación de super admin)
3. **Carga en paralelo 4 tablas** (límite 200 filas cada una): `acuerdos`, `pagos`, `entregables`, `kpis`
4. Inyecta los 4 JSON crudos completos en un `systemPrompt` enorme
5. Llama al gateway de Lovable AI con `google/gemini-3-flash-preview` y stream activado
6. Devuelve el body de SSE directamente al frontend

**Modelo actual**: `google/gemini-3-flash-preview` (rápido, barato, contexto grande — ideal para meter mucha data cruda).

## Lo que NO ve hoy (Campaign Monitor)

EngineXpert no tiene acceso a ninguna de las 6 tablas de campañas pagadas:
- `ad_platform_connections` — qué cuentas de Google/Meta/TikTok/LinkedIn están conectadas
- `campaigns_sync` — campañas sincronizadas (nombre, presupuesto diario/total, fechas, plataforma, estado)
- `campaign_metrics` — métricas diarias y horarias por campaña (cost, impressions, clicks, ctr, conversions, conversion_value, cpc, cpa, roas)
- `campaign_keywords` — keywords con CPC, CTR, quality score (Google Ads)
- `campaign_alerts` y `alert_history` — alertas configuradas y disparadas

Por eso si le preguntas "¿cuál es mi mejor campaña por ROAS?" o "¿cómo va el gasto de Google Ads esta semana?" responde que no tiene esa información.

## Reto principal: tamaño del contexto

Los acuerdos/pagos/KPIs son decenas o cientos de filas. Pero `campaign_metrics` tiene **una fila por campaña por día** (y opcionalmente por hora). Una empresa con 10 campañas activas durante 90 días = 900 filas. Si metiéramos eso crudo al prompt, el contexto explotaría y la respuesta sería más lenta y cara.

La solución es **pre-agregar la data antes de mandarla al modelo**, igual que hace `AutoInsights.tsx` y `PeriodComparisonCard.tsx` en el frontend. El modelo recibe resúmenes inteligentes en vez de filas crudas.

## Plan de implementación (FASE 1 — base sólida)

### 1. Edge function `crm-assistant/index.ts` — agregar contexto de campañas

Después de cargar acuerdos/pagos/entregables/kpis, agregar en paralelo:

- `ad_platform_connections` (todas, sin límite — son pocas) → lista de plataformas conectadas
- `campaigns_sync` (todas, sin límite — son pocas) → catálogo de campañas
- `campaign_metrics` (últimos 90 días) → se agrega en código, NO se manda crudo
- `campaign_keywords` (top 50 por clicks, últimos 30 días) → se agrega
- `alert_history` (últimas 20 alertas no reconocidas) → para que pueda hablar de problemas activos

### 2. Pre-agregación en el edge function

Construir un objeto resumido de campañas con la lógica que ya existe en `src/components/campaign-monitor/utils.ts` y `AutoInsights.tsx`, replicada en Deno:

- **Por plataforma** (últimos 30 días): cost, clicks, impressions, conversions, ctr, cpc, cpa, roas
- **Por campaña** (últimos 30 días): nombre, plataforma, status, daily_budget, mismas métricas agregadas
- **Comparativa período actual vs anterior** (30d vs 30d previos): % de cambio en cost, clicks, ctr, conversions, roas
- **Top 5 keywords** por clicks con CPC/CTR/conversions
- **Bottom 5 keywords** por ROI
- **Pacing de presupuesto**: gasto total vs (daily_budget × días)
- **Alertas activas no reconocidas**: últimas 20 con métrica, threshold y campaña afectada

Mandar este resumen como JSON estructurado al prompt en vez de filas crudas. Resultado: ~3-5 KB en lugar de 100+ KB, y el modelo recibe data ya "interpretada".

### 3. Actualizar el `systemPrompt`

Agregar a las CAPACIDADES:
- Analizar campañas pagadas en Google Ads, Meta Ads, TikTok Ads, LinkedIn Ads
- Comparar rendimiento entre plataformas
- Detectar campañas que pierden dinero (ROAS bajo)
- Identificar oportunidades de escalar (ROAS alto)
- Recomendar pausas, cambios de creativo, redistribución de presupuesto
- Hablar de keywords ganadoras/perdedoras
- Reportar el estado del consumo de presupuesto

Agregar al CONTEXTO DE DATOS la nueva sección `CAMPAÑAS PAGADAS` con el resumen.

Aclarar en el prompt que **InfluXpert combina dos mundos**: marketing con influencers (orgánico/acuerdos) Y campañas pagadas en plataformas de ads. EngineXpert puede cruzar ambos (ej. "estás gastando 5K en Google Ads y 8K en influencers este mes").

### 4. Actualizar sugerencias en `AIChatBubble.tsx`

Agregar 2 chips de ejemplo nuevos en el estado vacío:
- "¿Cuál es mi campaña con mejor ROAS?"
- "¿Qué plataforma rinde mejor?"

### 5. Manejar empresas sin Campaign Monitor

Las empresas sin plan que incluya `campaign_monitor` simplemente no tendrán filas en esas tablas (RLS las bloquea o quedan vacías). El edge function debe:
- No fallar si los queries devuelven 0 filas
- Solo incluir la sección "CAMPAÑAS PAGADAS" en el prompt si hay al menos una conexión activa
- Si no hay datos de campañas, instruir al modelo a NO inventar y, si le preguntan, decir "este módulo no está activo en tu plan"

## Arquitectura técnica

```text
AIChatBubble (frontend)
        │  POST /crm-assistant  { messages }
        ▼
crm-assistant (edge function)
        │
        ├── valida JWT
        ├── crea cliente con token del usuario (RLS aplica → company_id correcto)
        │
        ├── carga en paralelo (Promise.all):
        │     • acuerdos / pagos / entregables / kpis  (igual que hoy)
        │     • ad_platform_connections                (NUEVO)
        │     • campaigns_sync                         (NUEVO)
        │     • campaign_metrics últimos 90d           (NUEVO)
        │     • campaign_keywords top 50 últimos 30d   (NUEVO)
        │     • alert_history no reconocidas           (NUEVO)
        │
        ├── PRE-AGREGA campañas en JS:
        │     • aggregateByPlatform()
        │     • aggregateByCampaign()
        │     • periodComparison() 30d vs 30d previos
        │     • topKeywords / bottomKeywords
        │     • budgetPacing
        │
        ├── construye systemPrompt con:
        │     CRM (crudo, como hoy) + CAMPAÑAS (resumen agregado)
        │
        └── stream a Lovable AI Gateway → SSE de vuelta al chat
```

## Lo que queda fuera de esta fase (futuras iteraciones)

Te lo dejo apuntado para cuando quieras avanzar:

- **Cruzar influencers vs ads**: "el ROI combinado de la campaña X considerando lo gastado en influencers + Google Ads del mismo periodo"
- **Function calling**: que el modelo pida data adicional bajo demanda en vez de mandarle todo siempre (más eficiente con muchas campañas)
- **Persistencia del historial**: guardar conversaciones en una tabla `ai_conversations` para retomar contexto entre sesiones
- **Acciones desde el chat**: que pueda crear alertas, pausar campañas, etc. (requiere herramientas con confirmación del usuario)
- **Cambiar de modelo a `gemini-2.5-pro` o `gpt-5-mini`** si la calidad de análisis no es suficiente con flash-preview

## Pregunta antes de implementar

Una sola decisión que cambia el alcance: ¿la **ventana de tiempo** por defecto que debe analizar EngineXpert para campañas son **30 días** (lo más común en ads, balance entre detalle y costo de tokens) o prefieres **90 días** (mejor para tendencias largas, más data en el contexto)? Default propuesto: agregar siempre los **últimos 30 días en detalle** y los **30 días anteriores solo para comparativa de cambio %** — eso es lo que muestra hoy `PeriodComparisonCard` y es el estándar de la industria.

Si confirmas (o me dices "como veas"), implemento la FASE 1 completa.