-- 1. Agregar columna entregable_id a pagos
ALTER TABLE public.pagos
  ADD COLUMN IF NOT EXISTS entregable_id UUID NULL
    REFERENCES public.entregables(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pagos_entregable_id ON public.pagos(entregable_id);
CREATE INDEX IF NOT EXISTS idx_pagos_acuerdo_id ON public.pagos(acuerdo_id);

-- 2. RPC para crear pagos (y entregables) desde un acuerdo de forma atómica
CREATE OR REPLACE FUNCTION public.create_payments_from_agreement(
  _acuerdo_id UUID,
  _new_entregables JSONB,
  _new_pagos JSONB
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _company_id UUID;
  _user_id UUID := auth.uid();
  _expected_total NUMERIC;
  _influencer TEXT;
  _moneda TEXT;
  _sum_pagos NUMERIC := 0;
  _entregable_payload JSONB;
  _pago_payload JSONB;
  _new_entregable_id UUID;
  _entregable_id_map JSONB := '{}'::JSONB;
  _resolved_entregable_id UUID;
  _tmp_id TEXT;
  _created_entregables INT := 0;
  _created_pagos INT := 0;
BEGIN
  IF _user_id IS NULL THEN
    RAISE EXCEPTION 'No autenticado';
  END IF;

  -- Cargar acuerdo
  SELECT company_id, valor_total, influencer, moneda
    INTO _company_id, _expected_total, _influencer, _moneda
  FROM public.acuerdos WHERE id = _acuerdo_id;

  IF _company_id IS NULL THEN
    RAISE EXCEPTION 'Acuerdo no encontrado';
  END IF;

  IF _company_id <> public.get_user_company_id(_user_id) THEN
    RAISE EXCEPTION 'No tienes acceso a este acuerdo';
  END IF;

  -- Validar suma
  IF _new_pagos IS NOT NULL AND jsonb_array_length(_new_pagos) > 0 THEN
    SELECT COALESCE(SUM((p->>'monto')::NUMERIC), 0) INTO _sum_pagos
    FROM jsonb_array_elements(_new_pagos) p;
  END IF;

  IF _sum_pagos - _expected_total > 0.01 THEN
    RAISE EXCEPTION 'La suma de pagos (%) excede el valor del acuerdo (%)', _sum_pagos, _expected_total;
  END IF;

  -- Crear entregables nuevos
  IF _new_entregables IS NOT NULL AND jsonb_array_length(_new_entregables) > 0 THEN
    FOR _entregable_payload IN SELECT * FROM jsonb_array_elements(_new_entregables) LOOP
      INSERT INTO public.entregables (
        company_id, user_id, acuerdo_id, influencer, tipo_contenido,
        descripcion, fecha_programada, estado
      )
      VALUES (
        _company_id, _user_id, _acuerdo_id,
        COALESCE(_entregable_payload->>'influencer', _influencer),
        COALESCE(_entregable_payload->>'tipo_contenido', 'Reel'),
        COALESCE(_entregable_payload->>'descripcion', ''),
        NULLIF(_entregable_payload->>'fecha_programada', '')::DATE,
        'Pendiente'
      )
      RETURNING id INTO _new_entregable_id;

      _tmp_id := _entregable_payload->>'tmp_id';
      IF _tmp_id IS NOT NULL THEN
        _entregable_id_map := _entregable_id_map ||
          jsonb_build_object(_tmp_id, _new_entregable_id::TEXT);
      END IF;
      _created_entregables := _created_entregables + 1;
    END LOOP;
  END IF;

  -- Crear pagos
  IF _new_pagos IS NOT NULL THEN
    FOR _pago_payload IN SELECT * FROM jsonb_array_elements(_new_pagos) LOOP
      _resolved_entregable_id := NULL;

      -- entregable_id directo (uuid existente)
      IF _pago_payload ? 'entregable_id' AND _pago_payload->>'entregable_id' IS NOT NULL
         AND _pago_payload->>'entregable_id' <> '' THEN
        _resolved_entregable_id := (_pago_payload->>'entregable_id')::UUID;
      ELSIF _pago_payload ? 'entregable_tmp_id' AND _pago_payload->>'entregable_tmp_id' IS NOT NULL THEN
        _resolved_entregable_id := (_entregable_id_map->>(_pago_payload->>'entregable_tmp_id'))::UUID;
      END IF;

      INSERT INTO public.pagos (
        company_id, user_id, acuerdo_id, entregable_id, influencer, concepto,
        monto, moneda, fecha_pago, estado, metodo_pago, comprobante, notas
      )
      VALUES (
        _company_id, _user_id, _acuerdo_id, _resolved_entregable_id,
        COALESCE(_pago_payload->>'influencer', _influencer),
        COALESCE(_pago_payload->>'concepto', ''),
        (_pago_payload->>'monto')::NUMERIC,
        COALESCE(_pago_payload->>'moneda', _moneda, 'USD'),
        NULLIF(_pago_payload->>'fecha_pago', '')::DATE,
        COALESCE(_pago_payload->>'estado', 'Pendiente'),
        COALESCE(_pago_payload->>'metodo_pago', ''),
        COALESCE(_pago_payload->>'comprobante', ''),
        COALESCE(_pago_payload->>'notas', '')
      );
      _created_pagos := _created_pagos + 1;
    END LOOP;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'pagos_created', _created_pagos,
    'entregables_created', _created_entregables
  );
END;
$$;