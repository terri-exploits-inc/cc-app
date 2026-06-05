-- Accounts Table
CREATE TABLE IF NOT EXISTS public.accounts (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    avatarbase64 TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Currencies Table
CREATE TABLE IF NOT EXISTS public.currencies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    icon TEXT NOT NULL,
    animicon TEXT,
    creatorid TEXT NOT NULL REFERENCES public.accounts(id),
    totalminted NUMERIC DEFAULT 0,
    totalgoldspent NUMERIC DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Community Votes Table
CREATE TABLE IF NOT EXISTS public.community_votes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    goldperusdnumber NUMERIC NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Balances Table (Tracks who owns how much of each currency)
CREATE TABLE IF NOT EXISTS public.balances (
    account_id TEXT REFERENCES public.accounts(id),
    currency_id TEXT REFERENCES public.currencies(id),
    amount NUMERIC DEFAULT 0,
    PRIMARY KEY (account_id, currency_id)
);

-- Enable RLS and create open policies for all tables
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anonymous access" ON public.accounts FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.currencies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anonymous access" ON public.currencies FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.community_votes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anonymous access" ON public.community_votes FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.balances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow anonymous access" ON public.balances FOR ALL USING (true) WITH CHECK (true);
