
-- Create acuerdos table
CREATE TABLE public.acuerdos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  influencer TEXT NOT NULL DEFAULT '',
  red_social TEXT[] NOT NULL DEFAULT '{}',
  seguidores INTEGER NOT NULL DEFAULT 0,
  plataforma TEXT NOT NULL DEFAULT '',
  tipo_contenido TEXT[] NOT NULL DEFAULT '{}',
  reels_pactados INTEGER NOT NULL DEFAULT 0,
  stories_pactadas INTEGER NOT NULL DEFAULT 0,
  fecha_inicio DATE,
  fecha_fin DATE,
  duracion_meses INTEGER NOT NULL DEFAULT 0,
  valor_mensual NUMERIC NOT NULL DEFAULT 0,
  valor_total NUMERIC NOT NULL DEFAULT 0,
  moneda TEXT NOT NULL DEFAULT 'USD',
  estado TEXT NOT NULL DEFAULT 'Activo',
  contacto TEXT NOT NULL DEFAULT '',
  notas TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.acuerdos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own acuerdos" ON public.acuerdos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own acuerdos" ON public.acuerdos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own acuerdos" ON public.acuerdos FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own acuerdos" ON public.acuerdos FOR DELETE USING (auth.uid() = user_id);

-- Create pagos table
CREATE TABLE public.pagos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  acuerdo_id UUID REFERENCES public.acuerdos(id) ON DELETE SET NULL,
  influencer TEXT NOT NULL DEFAULT '',
  concepto TEXT NOT NULL DEFAULT '',
  monto NUMERIC NOT NULL DEFAULT 0,
  moneda TEXT NOT NULL DEFAULT 'USD',
  fecha_pago DATE,
  fecha_vencimiento DATE,
  estado TEXT NOT NULL DEFAULT 'Pendiente',
  metodo_pago TEXT NOT NULL DEFAULT '',
  comprobante TEXT NOT NULL DEFAULT '',
  notas TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pagos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own pagos" ON public.pagos FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own pagos" ON public.pagos FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own pagos" ON public.pagos FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own pagos" ON public.pagos FOR DELETE USING (auth.uid() = user_id);

-- Create entregables table
CREATE TABLE public.entregables (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  acuerdo_id UUID REFERENCES public.acuerdos(id) ON DELETE SET NULL,
  influencer TEXT NOT NULL DEFAULT '',
  tipo_contenido TEXT NOT NULL DEFAULT 'Reel',
  descripcion TEXT NOT NULL DEFAULT '',
  fecha_programada DATE,
  fecha_entrega DATE,
  estado TEXT NOT NULL DEFAULT 'Pendiente',
  url_contenido TEXT NOT NULL DEFAULT '',
  notas TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.entregables ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own entregables" ON public.entregables FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own entregables" ON public.entregables FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own entregables" ON public.entregables FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own entregables" ON public.entregables FOR DELETE USING (auth.uid() = user_id);

-- Create kpis table
CREATE TABLE public.kpis (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  entregable_id UUID REFERENCES public.entregables(id) ON DELETE SET NULL,
  acuerdo_id UUID REFERENCES public.acuerdos(id) ON DELETE SET NULL,
  influencer TEXT NOT NULL DEFAULT '',
  alcance INTEGER NOT NULL DEFAULT 0,
  impresiones INTEGER NOT NULL DEFAULT 0,
  interacciones INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  engagement NUMERIC NOT NULL DEFAULT 0,
  cpr NUMERIC NOT NULL DEFAULT 0,
  cpc NUMERIC NOT NULL DEFAULT 0,
  periodo TEXT NOT NULL DEFAULT '',
  estado TEXT NOT NULL DEFAULT 'Pendiente',
  notas TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.kpis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own kpis" ON public.kpis FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own kpis" ON public.kpis FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own kpis" ON public.kpis FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own kpis" ON public.kpis FOR DELETE USING (auth.uid() = user_id);
