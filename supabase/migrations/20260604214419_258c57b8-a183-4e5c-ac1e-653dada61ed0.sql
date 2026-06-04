ALTER TABLE public.campaign_metrics ALTER COLUMN cpa DROP NOT NULL;
ALTER TABLE public.campaign_metrics ALTER COLUMN cpc DROP NOT NULL;
ALTER TABLE public.campaign_metrics ALTER COLUMN ctr DROP NOT NULL;
ALTER TABLE public.campaign_metrics ALTER COLUMN roas DROP NOT NULL;

COMMENT ON COLUMN public.campaign_metrics.cpa IS 'Cost per acquisition. NULL when conversions = 0 (not applicable).';
COMMENT ON COLUMN public.campaign_metrics.cpc IS 'Cost per click. NULL when clicks = 0 (not applicable).';
COMMENT ON COLUMN public.campaign_metrics.ctr IS 'Click-through rate. NULL when impressions = 0 (not applicable).';
COMMENT ON COLUMN public.campaign_metrics.roas IS 'Return on ad spend. NULL when cost = 0 (not applicable).';