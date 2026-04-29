## Objetivo

Mejorar `generate-demo-data` con (1) selector de cantidad small/medium/large, (2) datos de Campaign Monitor mucho más realistas (granularidad horaria, keywords, alertas), y (3) UX en el frontend que pregunte preset y advierta gating por plan. `clear-demo-data` ya está OK.

---

## Backend — `supabase/functions/generate-demo-data/index.ts`

### 1. Parsear preset

- Leer body: `const { preset: rawPreset } = await req.json().catch(() => ({}));`
- Validar contra `PRESETS = { small, medium, large }`. Si inválido o ausente → `medium` + `console.warn`.
- Constante `PRESETS` exactamente como especificada por el usuario.

### 2. Influencers (15)

- Reemplazar array `INFLUENCERS` de 5 a 15 entradas con nombres latinos variados, handles realistas, seguidores 50K–500K.
- Usar `INFLUENCERS.slice(0, preset.acuerdos)` para construir acuerdos.
- Pagos: mantener 3/acuerdo. Entregables: mantener 2/acuerdo. KPIs: el `while` actual (objetivo 20) se conserva pero se escala a `Math.max(20, 2 * acuerdos)` para que crezca con el preset.

### 3. Campaign Monitor (gated por plan `pro`/`enterprise`)

Mantengo el check existente. Dentro:

- **Conexión**: una sola fila en `ad_platform_connections` (igual que hoy).
- **Campañas**: insertar `preset.campaigns` filas ciclando `CAMPAIGN_TEMPLATES` (6 templates). Cada una con `status="active"`, `currency="COP"`, `start_date=sixMonthsAgo`, `total_budget = daily_budget * 30`, `external_campaign_id = "GADS-" + i.toString().padStart(3,"0")`. Guardar `id`, `name`, `type` para uso posterior.

- **Métricas por hora**: por cada campaña, por cada uno de los últimos `preset.days_metrics` días, generar 24 filas (hora 0–23). Aplicar `getActivityFactor(hour, dayOfWeek)` exactamente como especificado. Fórmulas de impressions/clicks/conversions/cost/conversionValue exactamente como en el brief. Calcular ctr, cpc, cpa, roas con la lógica actual.

- **Inserts en lotes de 500**: helper local
  ```
  async function insertInChunks(table, rows, size = 500) {
    for (let i = 0; i < rows.length; i += size) {
      const { error } = await admin.from(table).insert(rows.slice(i, i + size));
      if (error) throw new Error(`Error insertando ${table}: ${error.message}`);
    }
  }
  ```
  Usarlo solo para `campaign_metrics` (donde el volumen importa). El resto de tablas ya entra en una sola call.

- **Keywords**: solo para campañas `type === "search" || "shopping"`. Generar `preset.keywords_per_campaign` por campaña.
  - Si `familiasNames.length > 0`: base = familias del tenant (ciclar). Si no, pool fijo `["zapatillas", "ropa deportiva", "mochilas", "audífonos", "smartwatch", "accesorios", "outlet", "ofertas"]`.
  - Concatenar con sufijo aleatorio de `KEYWORD_SUFFIXES`.
  - `match_type` aleatorio entre broad/phrase/exact, `quality_score` 5–10.
  - `date` = último día (hoy en YYYY-MM-DD).
  - Métricas: top-3 keywords reciben 10–30% del total agregado de la campaña, resto 1–5%. Calcular agregando los `metricsPayload` por `campaign_sync_id` antes de generar keywords.

- **Alertas**: insertar en `campaign_alerts` 3 filas (ciclar templates si hay menos de 3 campañas). Templates:
  ```
  [
    { metric: "ctr",  condition: "below", threshold: 1.5,  is_active: true },
    { metric: "cpc",  condition: "above", threshold: 3000, is_active: true },
    { metric: "roas", condition: "below", threshold: 2.0,  is_active: true },
  ]
  ```
  Campos requeridos según schema: `company_id`, `campaign_sync_id`, `metric`, `condition`, `threshold`, `created_by` (usar `creatorUserId`), `is_active`, `is_demo_data: true`. (El brief dice `enabled` pero el schema es `is_active` — uso `is_active`.)

- **Historial de alertas**: 5–10 filas (random) en `alert_history` distribuidas en últimos 7 días:
  - 60% sin `acknowledged_at`, 40% con `acknowledged_at` (timestamp posterior al trigger).
  - Campos: `company_id`, `campaign_sync_id` (de la alerta), `alert_id`, `triggered_at`, `metric_value` (valor que viola el threshold), `threshold_value`, `message` descriptivo (ej. `"CTR de Search Branded cayó a 0.83% (umbral 1.5%)"`), `is_demo_data: true`.

### 4. Summary y audit log

Extender el `summary` retornado y el `details` del `audit_log` con: `campaigns`, `campaign_metrics`, `campaign_keywords`, `campaign_alerts`, `alert_history`, `preset`. Para tenants Trial/Starter, esos campos van en 0.

---

## Frontend — `src/components/admin/DemoDataManager.tsx`

### Estado nuevo

- `tenantPlan: string | null` — leer plan del tenant impersonado (`companies.plan`) en el mismo `useEffect` que ya carga `impersonating`.
- `presetDialogOpen: boolean`.
- `selectedPreset: "small" | "medium" | "large"` — default `"medium"`.

### Reemplazar el AlertDialog actual de "Generar"

Cambiar a un `Dialog` (shadcn) con:

- Título: "Elegí el set de datos demo a generar".
- Si `tenantPlan` ∈ {`trial`, `starter`}: banner amarillo destacado:
  > ⚠️ Este tenant tiene plan **{plan}**. Solo se generarán datos de CRM (acuerdos, pagos, entregables, KPIs). El módulo Campaign Monitor no aplica a este plan.
- 3 cards seleccionables (RadioGroup o tarjetas clicables):
  - **Set chico** — 5 acuerdos, 2 campañas, 30 días métricas
  - **Set mediano** (badge "Recomendado", default seleccionado) — 10 acuerdos, 4 campañas, 60 días métricas
  - **Set grande** — 15 acuerdos, 6 campañas, 90 días métricas
  - Si plan trial/starter: ocultar la línea "X campañas, Y días métricas" en cada card (solo mostrar acuerdos).
- Botones: Cancelar / Generar.
- Botón "Generar" con loading state ("Generando… esto puede tardar 10–30s") deshabilitado mientras `working === true`.

### Llamada

```ts
supabase.functions.invoke('generate-demo-data', {
  body: { preset: selectedPreset },
});
```

### Toast de éxito

Construir mensaje según summary:

- Trial/Starter: `"Generados: N acuerdos, N pagos, N entregables, N KPIs"`.
- Pro/Enterprise: agrega `" · N métricas, N keywords, N alertas"` cuando esos campos > 0.

---

## `clear-demo-data`

Ya borra las 10 tablas en el orden correcto (verificado en el archivo). **No requiere cambios.**

---

## Detalles técnicos

- **Volumen máximo (preset large)**: 6 × 90 × 24 = 12 960 filas en `campaign_metrics`. Con chunks de 500 son 26 inserts. Edge function tiene límite de wall-time ~150s; insertar secuencialmente. Si llegara a ser lento, queda margen.
- **`days_metrics`**: iterar `for (let d = preset.days_metrics - 1; d >= 0; d--)` usando una fecha base `now` para que el último día sea hoy.
- **`hour` en `campaign_metrics`**: la columna existe y es `integer` nullable — perfecto para granularidad horaria.
- **Keywords de top vs bottom**: ordenar las keywords generadas, aplicar % decreciente al `clicks`/`cost`/`conversions` agregados de la campaña.
- **`alert_history.alert_id`**: usar el `id` retornado del insert de `campaign_alerts` (hacer `.select("id, campaign_sync_id, metric, threshold")`).
- **Constantes** (`PRESETS`, `INFLUENCERS`, `CAMPAIGN_TEMPLATES`, `KEYWORD_SUFFIXES`) declaradas dentro del handler o a nivel módulo (preferencia: módulo, son inmutables).
- **No tocar**: auditoría existente, gating super_admin + impersonación, dependencias.

---

## Validación post-deploy (manual por el usuario)

Como en el brief: generar `medium` en tenant Pro y verificar conteos vía SQL; chequear heatmap, keywords y alertas en UI; generar `small` en tenant Trial y confirmar 0 filas en tablas de Campaign Monitor; borrar demo del tenant Pro y confirmar 0 residuales.