UPDATE public.acuerdos
SET familia_producto = '{}'
WHERE company_id = (SELECT id FROM companies WHERE lower(domain) = 'groupeseb.com')
  AND familia_producto && ARRAY['Lubricantes', 'Llantas', 'Transmisión', 'Frenos', 'Luces/Iluminación', 'Baterías'];