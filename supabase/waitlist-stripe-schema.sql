-- =============================================
-- WAITLIST & STRIPE INTEGRATION SCHEMA
-- =============================================

-- Waitlist signups table
CREATE TABLE IF NOT EXISTS waitlist_signups (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    name TEXT,
    source TEXT, -- How they heard about us
    signed_up_at TIMESTAMPTZ DEFAULT NOW(),
    ip_address TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Newsletter signups table (separate from waitlist)
CREATE TABLE IF NOT EXISTS newsletter_signups (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    signed_up_at TIMESTAMPTZ DEFAULT NOW(),
    source TEXT DEFAULT 'newsletter', -- Source of signup
    ip_address TEXT,
    user_agent TEXT,
    active BOOLEAN DEFAULT true, -- For unsubscribes
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payment sessions table (track Stripe checkout sessions)
CREATE TABLE IF NOT EXISTS payment_sessions (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    stripe_session_id TEXT NOT NULL UNIQUE,
    plan TEXT NOT NULL, -- 'starter', 'pro'
    billing TEXT NOT NULL, -- 'monthly', 'yearly'
    amount INTEGER NOT NULL, -- Amount in cents
    user_id UUID,
    email TEXT,
    status TEXT DEFAULT 'pending', -- 'pending', 'completed', 'failed'
    stripe_customer_id TEXT,
    stripe_subscription_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);

-- Users table (extend existing or create new)
DO $$ 
BEGIN
    -- Check if users table exists, if not create it
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users') THEN
        CREATE TABLE users (
            id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
            email TEXT NOT NULL UNIQUE,
            name TEXT,
            created_at TIMESTAMPTZ DEFAULT NOW(),
            updated_at TIMESTAMPTZ DEFAULT NOW()
        );
    END IF;
END $$;

-- Add Stripe/subscription columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS plan TEXT DEFAULT 'free', -- 'free', 'starter', 'pro'
ADD COLUMN IF NOT EXISTS billing_cycle TEXT DEFAULT 'monthly', -- 'monthly', 'yearly'
ADD COLUMN IF NOT EXISTS subscription_status TEXT DEFAULT 'inactive', -- 'inactive', 'active', 'canceled', 'past_due'
ADD COLUMN IF NOT EXISTS trial_end TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS current_period_start TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_waitlist_email ON waitlist_signups(email);
CREATE INDEX IF NOT EXISTS idx_waitlist_created_at ON waitlist_signups(created_at);
CREATE INDEX IF NOT EXISTS idx_newsletter_email ON newsletter_signups(email);
CREATE INDEX IF NOT EXISTS idx_newsletter_created_at ON newsletter_signups(created_at);
CREATE INDEX IF NOT EXISTS idx_newsletter_active ON newsletter_signups(active);
CREATE INDEX IF NOT EXISTS idx_payment_sessions_stripe_id ON payment_sessions(stripe_session_id);
CREATE INDEX IF NOT EXISTS idx_payment_sessions_status ON payment_sessions(status);
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer ON users(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_users_subscription ON users(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_users_plan ON users(plan);

-- =============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =============================================

-- Enable RLS
ALTER TABLE waitlist_signups ENABLE ROW LEVEL SECURITY;
ALTER TABLE newsletter_signups ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Waitlist policies
CREATE POLICY "Waitlist signups are publicly insertable" ON waitlist_signups
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Service role can read all waitlist signups" ON waitlist_signups
    FOR SELECT USING (auth.role() = 'service_role');

-- Newsletter policies
CREATE POLICY "Newsletter signups are publicly insertable" ON newsletter_signups
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Service role can manage newsletter signups" ON newsletter_signups
    FOR ALL USING (auth.role() = 'service_role');

-- Payment sessions policies  
CREATE POLICY "Service role can manage payment sessions" ON payment_sessions
    FOR ALL USING (auth.role() = 'service_role');

-- Users policies
CREATE POLICY "Users can read their own data" ON users
    FOR SELECT USING (auth.uid()::text = id::text);

CREATE POLICY "Service role can manage all users" ON users
    FOR ALL USING (auth.role() = 'service_role');

-- =============================================
-- HELPFUL FUNCTIONS
-- =============================================

-- Function to get waitlist count
CREATE OR REPLACE FUNCTION get_waitlist_count()
RETURNS INTEGER
LANGUAGE sql
SECURITY DEFINER
AS $$
    SELECT COUNT(*)::INTEGER FROM waitlist_signups;
$$;

-- Function to check user plan limits
CREATE OR REPLACE FUNCTION check_user_plan_limit(user_email TEXT, plan_type TEXT DEFAULT NULL)
RETURNS TABLE (
    current_plan TEXT,
    sites_limit INTEGER,
    sites_used INTEGER,
    can_create_more BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_plan TEXT;
    sites_count INTEGER;
    plan_limit INTEGER;
BEGIN
    -- Get user's current plan
    SELECT users.plan INTO user_plan
    FROM users 
    WHERE users.email = user_email;
    
    -- Use provided plan_type or user's current plan
    user_plan := COALESCE(plan_type, user_plan, 'free');
    
    -- Count user's sites this month
    SELECT COUNT(*) INTO sites_count
    FROM site_jobs sj
    WHERE sj.domain IN (
        SELECT s.domain 
        FROM sites s 
        WHERE s.user_email = user_email
    )
    AND sj.created_at >= date_trunc('month', NOW());
    
    -- Set plan limits
    plan_limit := CASE user_plan
        WHEN 'free' THEN 0
        WHEN 'starter' THEN 2
        WHEN 'pro' THEN 10
        ELSE 0
    END;
    
    RETURN QUERY SELECT 
        user_plan,
        plan_limit,
        sites_count,
        (sites_count < plan_limit);
END;
$$;

-- Function to get user subscription info
CREATE OR REPLACE FUNCTION get_user_subscription_info(user_email TEXT)
RETURNS TABLE (
    plan TEXT,
    status TEXT,
    trial_end TIMESTAMPTZ,
    period_end TIMESTAMPTZ,
    sites_limit INTEGER,
    sites_used INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    user_record RECORD;
    sites_count INTEGER;
    plan_limit INTEGER;
BEGIN
    -- Get user subscription data
    SELECT * INTO user_record
    FROM users 
    WHERE users.email = user_email;
    
    -- Count sites this month
    SELECT COUNT(*) INTO sites_count
    FROM site_jobs sj
    WHERE sj.domain IN (
        SELECT s.domain 
        FROM sites s 
        WHERE s.user_email = user_email
    )
    AND sj.created_at >= date_trunc('month', NOW());
    
    -- Calculate plan limit
    plan_limit := CASE COALESCE(user_record.plan, 'free')
        WHEN 'free' THEN 0
        WHEN 'starter' THEN 2
        WHEN 'pro' THEN 10
        ELSE 0
    END;
    
    RETURN QUERY SELECT 
        COALESCE(user_record.plan, 'free'),
        COALESCE(user_record.subscription_status, 'inactive'),
        user_record.trial_end,
        user_record.current_period_end,
        plan_limit,
        sites_count;
END;
$$;

-- =============================================
-- GRANTS & PERMISSIONS
-- =============================================

-- Grant access to anon and authenticated users where appropriate
GRANT SELECT ON waitlist_signups TO anon;
GRANT INSERT ON waitlist_signups TO anon;
GRANT SELECT ON newsletter_signups TO anon;
GRANT INSERT ON newsletter_signups TO anon;

-- Grant service role full access
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- =============================================
-- SAMPLE DATA (for testing)
-- =============================================

-- Insert some sample waitlist signups for testing
-- INSERT INTO waitlist_signups (email, name, source) VALUES 
-- ('test1@example.com', 'Test User 1', 'social_media'),
-- ('test2@example.com', 'Test User 2', 'friend_referral'),
-- ('test3@example.com', 'Test User 3', 'search_engine')
-- ON CONFLICT (email) DO NOTHING;

COMMENT ON TABLE waitlist_signups IS 'Stores email signups for the product waitlist';
COMMENT ON TABLE payment_sessions IS 'Tracks Stripe checkout sessions and payment status';
COMMENT ON COLUMN users.plan IS 'User subscription plan: free, starter, pro';
COMMENT ON COLUMN users.subscription_status IS 'Stripe subscription status: inactive, active, canceled, past_due'; 