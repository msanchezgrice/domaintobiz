ALTER TABLE public.sites
ADD COLUMN IF NOT EXISTS deployed_url TEXT;

COMMENT ON COLUMN public.sites.deployed_url IS 'The final public URL where the generated site is hosted.'; 