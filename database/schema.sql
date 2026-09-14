CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- =========================
-- USERS
-- =========================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(120) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    phone VARCHAR(30),
    password_hash TEXT NOT NULL,
    role VARCHAR(30) NOT NULL
        CHECK (role IN ('advertiser', 'screen_owner', 'admin')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- =========================
-- BUSINESSES
-- =========================

CREATE TABLE businesses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    category VARCHAR(100),
    address TEXT,
    city VARCHAR(100),
    area VARCHAR(100),
    phone VARCHAR(30),
    website TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- =========================
-- SCREENS
-- =========================

CREATE TABLE screens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,

    screen_id VARCHAR(50) UNIQUE NOT NULL,
    screen_name VARCHAR(150) NOT NULL,

    business_name VARCHAR(150) NOT NULL,
    business_category VARCHAR(100),

    address TEXT,
    city VARCHAR(100),
    area VARCHAR(100),

    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,

    screen_type VARCHAR(50),
    screen_size VARCHAR(50),

    operating_start TIME,
    operating_end TIME,

    available_ad_start TIME,
    available_ad_end TIME,

    price_per_week NUMERIC(10,2) DEFAULT 99,
    estimated_daily_plays INTEGER DEFAULT 100,

    status VARCHAR(30) DEFAULT 'pending'
        CHECK (status IN ('online', 'offline', 'pending', 'suspended')),

    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- =========================
-- ADVERTISEMENTS
-- =========================

CREATE TABLE advertisements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    advertiser_id UUID NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    title VARCHAR(150) NOT NULL,

    file_url TEXT,
    file_type VARCHAR(50),

    duration_seconds INTEGER DEFAULT 30,

    status VARCHAR(30) DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected')),

    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- =========================
-- CAMPAIGNS
-- =========================

CREATE TABLE campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    advertiser_id UUID NOT NULL
        REFERENCES users(id) ON DELETE CASCADE,

    advertisement_id UUID
        REFERENCES advertisements(id) ON DELETE SET NULL,

    business_id UUID
        REFERENCES businesses(id) ON DELETE SET NULL,

    name VARCHAR(150) NOT NULL,

    status VARCHAR(30) DEFAULT 'draft'
        CHECK (
            status IN (
                'draft',
                'pending',
                'active',
                'paused',
                'completed',
                'rejected'
            )
        ),

    start_date DATE,
    end_date DATE,

    budget NUMERIC(12,2) DEFAULT 0,

    target_city VARCHAR(100),
    target_area VARCHAR(100),
    radius_km NUMERIC(8,2),

    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- =========================
-- CAMPAIGN SCREENS
-- =========================

CREATE TABLE campaign_screens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    campaign_id UUID NOT NULL
        REFERENCES campaigns(id) ON DELETE CASCADE,

    screen_id UUID NOT NULL
        REFERENCES screens(id) ON DELETE CASCADE,

    price NUMERIC(10,2) DEFAULT 0,

    UNIQUE(campaign_id, screen_id)
);


-- =========================
-- PLAYBACK EVENTS
-- =========================

CREATE TABLE playback_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    advertisement_id UUID
        REFERENCES advertisements(id) ON DELETE SET NULL,

    campaign_id UUID
        REFERENCES campaigns(id) ON DELETE SET NULL,

    screen_id UUID
        REFERENCES screens(id) ON DELETE SET NULL,

    started_at TIMESTAMPTZ NOT NULL,

    ended_at TIMESTAMPTZ,

    duration_seconds INTEGER DEFAULT 0,

    status VARCHAR(30) DEFAULT 'verified'
        CHECK (status IN ('verified', 'failed')),

    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- =========================
-- PAYMENTS
-- =========================

CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    advertiser_id UUID
        REFERENCES users(id) ON DELETE CASCADE,

    campaign_id UUID
        REFERENCES campaigns(id) ON DELETE SET NULL,

    amount NUMERIC(12,2) NOT NULL,

    status VARCHAR(30) DEFAULT 'paid',

    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- =========================
-- SCREEN EARNINGS
-- =========================

CREATE TABLE screen_earnings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    screen_id UUID
        REFERENCES screens(id) ON DELETE CASCADE,

    campaign_id UUID
        REFERENCES campaigns(id) ON DELETE CASCADE,

    playback_event_id UUID
        REFERENCES playback_events(id) ON DELETE SET NULL,

    amount NUMERIC(10,2) DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW()
);


-- =========================
-- PAYOUTS
-- =========================

CREATE TABLE payouts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    owner_id UUID
        REFERENCES users(id) ON DELETE CASCADE,

    amount NUMERIC(12,2) NOT NULL,

    status VARCHAR(30) DEFAULT 'pending',

    created_at TIMESTAMPTZ DEFAULT NOW()
);