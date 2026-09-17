-- Add bid_amount column to bids table if not exists
ALTER TABLE public.bids ADD COLUMN IF NOT EXISTS bid_amount NUMERIC(15, 2);
