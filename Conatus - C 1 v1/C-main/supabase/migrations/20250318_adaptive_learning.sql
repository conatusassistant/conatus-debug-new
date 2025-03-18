-- Migration for Adaptive Learning System tables
-- March 18, 2025

-- Create user_events table to store user behavior
CREATE TABLE IF NOT EXISTS public.user_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  device_info JSONB DEFAULT '{}',
  location_info JSONB DEFAULT '{}',
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create behavior_patterns table to store detected patterns
CREATE TABLE IF NOT EXISTS public.behavior_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pattern_type TEXT NOT NULL CHECK (pattern_type IN ('time', 'location', 'sequence', 'frequency')),
  pattern_data JSONB NOT NULL,
  confidence FLOAT NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  occurrences INTEGER NOT NULL DEFAULT 1,
  first_detected TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_updated TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create suggestions table to store generated suggestions
CREATE TABLE IF NOT EXISTS public.suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('automation', 'action', 'reminder', 'connection', 'feature')),
  category TEXT NOT NULL CHECK (category IN ('productivity', 'communication', 'transportation', 'food', 'entertainment', 'system')),
  source JSONB NOT NULL,
  relevance_score FLOAT NOT NULL CHECK (relevance_score >= 0 AND relevance_score <= 1),
  relevance_factors JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ,
  action_params JSONB DEFAULT '{}',
  dismissed BOOLEAN NOT NULL DEFAULT false,
  implemented BOOLEAN NOT NULL DEFAULT false,
  feedback_provided BOOLEAN NOT NULL DEFAULT false
);

-- Create suggestion_feedback table to store user feedback
CREATE TABLE IF NOT EXISTS public.suggestion_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  suggestion_id UUID NOT NULL REFERENCES public.suggestions(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  relevant BOOLEAN NOT NULL,
  helpful BOOLEAN,
  reason_if_irrelevant TEXT CHECK (reason_if_irrelevant IN ('timing', 'category', 'frequency', 'not_interested', 'other')),
  comment TEXT,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create user_preferences table to store suggestion preferences
CREATE TABLE IF NOT EXISTS public.user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT true,
  categories_enabled JSONB NOT NULL DEFAULT '{"productivity": true, "communication": true, "transportation": true, "food": true, "entertainment": true, "system": true}',
  min_relevance_threshold FLOAT NOT NULL DEFAULT 0.6 CHECK (min_relevance_threshold >= 0 AND min_relevance_threshold <= 1),
  max_suggestions_per_day INTEGER NOT NULL DEFAULT 10,
  max_suggestions_visible INTEGER NOT NULL DEFAULT 3,
  suggestions_display_mode TEXT NOT NULL DEFAULT 'both' CHECK (suggestions_display_mode IN ('banner', 'inline', 'both')),
  sensitivity_level TEXT NOT NULL DEFAULT 'medium' CHECK (sensitivity_level IN ('low', 'medium', 'high')),
  disabled_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes for optimized queries
CREATE INDEX IF NOT EXISTS idx_user_events_user_id ON public.user_events(user_id);
CREATE INDEX IF NOT EXISTS idx_user_events_event_type ON public.user_events(event_type);
CREATE INDEX IF NOT EXISTS idx_user_events_timestamp ON public.user_events(timestamp);

CREATE INDEX IF NOT EXISTS idx_behavior_patterns_user_id ON public.behavior_patterns(user_id);
CREATE INDEX IF NOT EXISTS idx_behavior_patterns_pattern_type ON public.behavior_patterns(pattern_type);

CREATE INDEX IF NOT EXISTS idx_suggestions_user_id ON public.suggestions(user_id);
CREATE INDEX IF NOT EXISTS idx_suggestions_relevance ON public.suggestions(relevance_score DESC);
CREATE INDEX IF NOT EXISTS idx_suggestions_created_at ON public.suggestions(created_at);
CREATE INDEX IF NOT EXISTS idx_suggestions_expires_at ON public.suggestions(expires_at);
CREATE INDEX IF NOT EXISTS idx_suggestions_type ON public.suggestions(type);
CREATE INDEX IF NOT EXISTS idx_suggestions_category ON public.suggestions(category);
CREATE INDEX IF NOT EXISTS idx_suggestions_status ON public.suggestions(dismissed, implemented);

-- Row-level security policies
-- User events table policies
ALTER TABLE public.user_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_events_insert_policy ON public.user_events
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY user_events_select_policy ON public.user_events
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Behavior patterns table policies
ALTER TABLE public.behavior_patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY behavior_patterns_select_policy ON public.behavior_patterns
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Suggestions table policies
ALTER TABLE public.suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY suggestions_select_policy ON public.suggestions
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY suggestions_update_policy ON public.suggestions
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- Suggestion feedback table policies
ALTER TABLE public.suggestion_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY suggestion_feedback_insert_policy ON public.suggestion_feedback
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY suggestion_feedback_select_policy ON public.suggestion_feedback
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- User preferences table policies
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY user_preferences_select_policy ON public.user_preferences
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY user_preferences_insert_policy ON public.user_preferences
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY user_preferences_update_policy ON public.user_preferences
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- Create a function to auto-dismiss expired suggestions
CREATE OR REPLACE FUNCTION auto_dismiss_expired_suggestions() RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.suggestions
  SET dismissed = true
  WHERE expires_at < NOW() AND dismissed = false;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger to run the function periodically
CREATE TRIGGER trigger_auto_dismiss_expired_suggestions
  AFTER INSERT OR UPDATE ON public.suggestions
  EXECUTE FUNCTION auto_dismiss_expired_suggestions();

-- Create a function to handle user_id validation
CREATE OR REPLACE FUNCTION validate_user_id() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS NULL OR NOT EXISTS (SELECT 1 FROM auth.users WHERE id = NEW.user_id) THEN
    RAISE EXCEPTION 'Invalid user_id';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers for user_id validation
CREATE TRIGGER trigger_validate_user_id_in_events
  BEFORE INSERT OR UPDATE ON public.user_events
  FOR EACH ROW
  EXECUTE FUNCTION validate_user_id();

CREATE TRIGGER trigger_validate_user_id_in_patterns
  BEFORE INSERT OR UPDATE ON public.behavior_patterns
  FOR EACH ROW
  EXECUTE FUNCTION validate_user_id();

CREATE TRIGGER trigger_validate_user_id_in_suggestions
  BEFORE INSERT OR UPDATE ON public.suggestions
  FOR EACH ROW
  EXECUTE FUNCTION validate_user_id();

CREATE TRIGGER trigger_validate_user_id_in_preferences
  BEFORE INSERT OR UPDATE ON public.user_preferences
  FOR EACH ROW
  EXECUTE FUNCTION validate_user_id();

-- Grant appropriate permissions
GRANT SELECT, INSERT ON public.user_events TO authenticated;
GRANT SELECT ON public.behavior_patterns TO authenticated;
GRANT SELECT, UPDATE ON public.suggestions TO authenticated;
GRANT SELECT, INSERT ON public.suggestion_feedback TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.user_preferences TO authenticated;
