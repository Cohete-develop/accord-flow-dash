CREATE TABLE public.content_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(company_id, name)
);
CREATE INDEX idx_content_types_company ON public.content_types(company_id);
ALTER TABLE public.content_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view content_types by company" ON public.content_types
  FOR SELECT TO authenticated USING (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Users insert content_types with company" ON public.content_types
  FOR INSERT TO authenticated WITH CHECK (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Users update content_types by company" ON public.content_types
  FOR UPDATE TO authenticated USING (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Users delete content_types by company" ON public.content_types
  FOR DELETE TO authenticated USING (company_id = get_user_company_id(auth.uid()));
CREATE POLICY "Super admin full access content_types" ON public.content_types
  FOR ALL USING (has_role(auth.uid(), 'super_admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'super_admin'::app_role));

CREATE TRIGGER update_content_types_updated_at
  BEFORE UPDATE ON public.content_types
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.content_types (company_id, name, sort_order)
SELECT c.id, t.name, t.sort_order FROM public.companies c
CROSS JOIN (VALUES ('Reel', 1), ('Story', 2), ('Collab', 3), ('UGC', 4)) AS t(name, sort_order)
ON CONFLICT (company_id, name) DO NOTHING;