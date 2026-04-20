CREATE TABLE public.product_families (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, name)
);

CREATE INDEX idx_product_families_company ON public.product_families(company_id);

ALTER TABLE public.product_families ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view product_families by company" ON public.product_families
  FOR SELECT TO authenticated
  USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users insert product_families with company" ON public.product_families
  FOR INSERT TO authenticated
  WITH CHECK (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users update product_families by company" ON public.product_families
  FOR UPDATE TO authenticated
  USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Users delete product_families by company" ON public.product_families
  FOR DELETE TO authenticated
  USING (company_id = get_user_company_id(auth.uid()));

CREATE POLICY "Super admin full access product_families" ON public.product_families
  FOR ALL
  USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER update_product_families_updated_at
  BEFORE UPDATE ON public.product_families
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.product_families (company_id, name, sort_order)
SELECT c.id, f.name, f.sort_order
FROM public.companies c
CROSS JOIN (VALUES 
  ('Lubricantes', 1), ('Llantas', 2), ('Transmisión', 3), 
  ('Frenos', 4), ('Luces/Iluminación', 5), ('Baterías', 6)
) AS f(name, sort_order)
WHERE lower(c.domain) LIKE 'grupojapani%'
ON CONFLICT (company_id, name) DO NOTHING;

INSERT INTO public.product_families (company_id, name, sort_order)
SELECT c.id, f.name, f.sort_order
FROM public.companies c
CROSS JOIN (VALUES 
  ('Krups', 1), ('Moulinex', 2), ('Rowenta', 3), 
  ('Tefal', 4), ('WMF', 5), ('Calor', 6)
) AS f(name, sort_order)
WHERE lower(c.domain) = 'groupeseb.com'
ON CONFLICT (company_id, name) DO NOTHING;

INSERT INTO public.module_permissions (role, module, can_view, can_create, can_edit, can_delete) VALUES
  ('gerencia', 'product_families', true, true, true, true),
  ('coordinador_mercadeo', 'product_families', true, true, true, false),
  ('admin_contabilidad', 'product_families', false, false, false, false),
  ('analista', 'product_families', false, false, false, false)
ON CONFLICT DO NOTHING;