-- database/migrations/01_initial_schema.sql

-- Enable RLS (Row-Level Security)
alter table if exists public.users enable row level security;
alter table if exists public.conversations enable row level security;
alter table if exists public.messages enable row level security;
alter table if exists public.automations enable row level security;
alter table if exists public.automation_executions enable row level security;
alter table if exists public.service_connections enable row level security;
alter table if exists public.social_posts enable row level security;
alter table if exists public.social_votes enable row level security;
alter table if exists public.social_comments enable row level security;
alter table if exists public.user_settings enable row level security;
alter table if exists public.token_usage enable row level security;
alter table if exists public.notifications enable row level security;

-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pg_trgm"; -- For text search improvements

-- User profile extension to auth.users
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique,
  display_name text,
  avatar_url text,
  bio text,
  is_verified boolean default false,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Create a trigger to create user profile when a new auth user is created
create or replace function public.handle_new_user() 
returns trigger as $$
begin
  insert into public.users (id, username, display_name)
  values (new.id, 'user_' || substr(new.id::text, 1, 8), 'New User');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- User Settings
create table if not exists public.user_settings (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.users(id) on delete cascade,
  theme text default 'light',
  language text default 'en',
  timezone text default 'UTC',
  notification_preferences jsonb default '{"email": true, "push": true, "digest": "daily"}'::jsonb,
  preferred_model_tier text default 'balanced', -- budget, balanced, premium
  cost_optimization_level text default 'balanced', -- minimal, balanced, aggressive
  monthly_budget decimal(10, 2) default null,
  budget_alert_threshold decimal(5, 2) default 0.8, -- 80% by default
  auto_archive_conversations boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id)
);

-- Conversations and Messages
create table if not exists public.conversations (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.users(id) on delete cascade not null,
  title text,
  label_ids text[] default array[]::text[],
  archived boolean default false,
  pinned boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  last_message_at timestamptz default now()
);

create table if not exists public.messages (
  id uuid primary key default uuid_generate_v4(),
  conversation_id uuid references public.conversations(id) on delete cascade not null,
  user_id uuid references public.users(id) on delete cascade not null,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  llm_provider text,
  llm_model text,
  token_count integer,
  prompt_tokens integer,
  completion_tokens integer,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

-- Add index for faster conversation lookup by user
create index if not exists idx_conversations_user_id on public.conversations(user_id);

-- Add index for faster message lookup by conversation
create index if not exists idx_messages_conversation_id on public.messages(conversation_id);

-- Add index for full-text search on message content
create index if not exists idx_messages_content_trgm on public.messages using gin (content gin_trgm_ops);

-- Add index for searching conversations by title
create index if not exists idx_conversations_title_trgm on public.conversations using gin (title gin_trgm_ops);

-- Automations 
create table if not exists public.automations (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.users(id) on delete cascade not null,
  name text not null,
  description text,
  workflow jsonb not null, -- Contains trigger and action
  enabled boolean default true,
  execution_count integer default 0,
  error_count integer default 0,
  last_executed_at timestamptz,
  last_error_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.automation_schedules (
  id uuid primary key default uuid_generate_v4(),
  automation_id uuid references public.automations(id) on delete cascade not null,
  scheduled_at timestamptz not null,
  trigger_data jsonb default '{}'::jsonb,
  status text default 'scheduled' check (status in ('scheduled', 'processing', 'completed', 'failed', 'skipped')),
  execution_id uuid,
  error text,
  created_at timestamptz default now(),
  executed_at timestamptz
);

create table if not exists public.automation_executions (
  id uuid primary key default uuid_generate_v4(),
  automation_id uuid references public.automations(id) on delete cascade not null,
  user_id uuid references public.users(id) on delete cascade not null,
  automation_type text not null,
  service text,
  parameters jsonb default '{}'::jsonb,
  status text not null check (status in ('success', 'failure', 'partial')),
  result jsonb,
  error_message text,
  executed_at timestamptz default now()
);

-- Add index for faster automation lookup by user
create index if not exists idx_automations_user_id on public.automations(user_id);

-- Add index for faster schedule lookup by time
create index if not exists idx_automation_schedules_time on public.automation_schedules(scheduled_at, status);

-- Add index for faster execution lookup
create index if not exists idx_automation_executions_automation_id on public.automation_executions(automation_id);
create index if not exists idx_automation_executions_user_id on public.automation_executions(user_id);

-- Service Connections
create table if not exists public.service_connections (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.users(id) on delete cascade not null,
  service_id text not null,
  service_name text not null,
  service_category text not null,
  is_active boolean default true,
  credentials jsonb default '{}'::jsonb, -- Encrypted access tokens etc.
  metadata jsonb default '{}'::jsonb, -- User info from the service
  last_used_at timestamptz,
  refresh_token_expires_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, service_id)
);

-- Add index for faster service connection lookup
create index if not exists idx_service_connections_user_id on public.service_connections(user_id);
create index if not exists idx_service_connections_service on public.service_connections(service_id, is_active);

-- Social Content
create table if not exists public.social_posts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.users(id) on delete cascade not null,
  title text not null,
  content text not null,
  type text default 'post' check (type in ('post', 'template', 'question')),
  automation_id uuid references public.automations(id) on delete set null,
  tags text[] default array[]::text[],
  view_count integer default 0,
  is_featured boolean default false,
  moderation_status text default 'approved' check (moderation_status in ('pending', 'approved', 'rejected')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.social_votes (
  id uuid primary key default uuid_generate_v4(),
  post_id uuid references public.social_posts(id) on delete cascade not null,
  user_id uuid references public.users(id) on delete cascade not null,
  vote_type text not null check (vote_type in ('upvote', 'downvote')),
  created_at timestamptz default now(),
  unique (post_id, user_id)
);

create table if not exists public.social_comments (
  id uuid primary key default uuid_generate_v4(),
  post_id uuid references public.social_posts(id) on delete cascade not null,
  user_id uuid references public.users(id) on delete cascade not null,
  parent_id uuid references public.social_comments(id) on delete cascade,
  content text not null,
  moderation_status text default 'approved' check (moderation_status in ('pending', 'approved', 'rejected')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Add indexes for social content lookups
create index if not exists idx_social_posts_user_id on public.social_posts(user_id);
create index if not exists idx_social_posts_type on public.social_posts(type, created_at);
create index if not exists idx_social_posts_tags on public.social_posts using gin (tags);
create index if not exists idx_social_posts_content_trgm on public.social_posts using gin (content gin_trgm_ops);

create index if not exists idx_social_votes_post_id on public.social_votes(post_id);
create index if not exists idx_social_votes_user_id on public.social_votes(user_id);

create index if not exists idx_social_comments_post_id on public.social_comments(post_id);
create index if not exists idx_social_comments_parent_id on public.social_comments(parent_id);

-- Token Usage Tracking
create table if not exists public.token_usage (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.users(id) on delete cascade not null,
  conversation_id uuid references public.conversations(id) on delete set null,
  message_id uuid references public.messages(id) on delete set null,
  provider text not null,
  model text not null,
  input_tokens integer not null,
  output_tokens integer not null,
  total_tokens integer not null,
  input_cost decimal(10, 6) not null,
  output_cost decimal(10, 6) not null,
  total_cost decimal(10, 6) not null,
  timestamp timestamptz default now()
);

-- Add indexes for token usage tracking
create index if not exists idx_token_usage_user_id on public.token_usage(user_id);
create index if not exists idx_token_usage_timestamp on public.token_usage(timestamp);
create index if not exists idx_token_usage_provider on public.token_usage(provider, model);

-- User Activity Tracking
create table if not exists public.user_activity (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.users(id) on delete cascade not null,
  session_id text not null,
  ip_address text,
  device_info jsonb default '{}'::jsonb,
  first_active timestamptz default now(),
  last_active timestamptz default now(),
  page_views integer default 1,
  query_count integer default 0,
  automation_count integer default 0,
  social_interactions integer default 0
);

-- Add index for user activity
create index if not exists idx_user_activity_user_id on public.user_activity(user_id);
create index if not exists idx_user_activity_last_active on public.user_activity(last_active);

-- Error Logging
create table if not exists public.error_logs (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.users(id) on delete set null,
  error_type text not null,
  error_message text not null,
  error_stack text,
  context jsonb default '{}'::jsonb,
  request_id text,
  path text,
  method text,
  status_code integer,
  timestamp timestamptz default now()
);

-- Add indexes for error logs
create index if not exists idx_error_logs_timestamp on public.error_logs(timestamp);
create index if not exists idx_error_logs_type on public.error_logs(error_type);
create index if not exists idx_error_logs_user_id on public.error_logs(user_id);

-- Notifications
create table if not exists public.notifications (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.users(id) on delete cascade not null,
  type text not null,
  title text not null,
  message text not null,
  link text,
  data jsonb default '{}'::jsonb,
  read boolean default false,
  created_at timestamptz default now()
);

-- Add indexes for notifications
create index if not exists idx_notifications_user_id on public.notifications(user_id, read);
create index if not exists idx_notifications_created_at on public.notifications(created_at);

-- RLS Policies

-- Users policies
create policy "Users can view their own profile"
  on public.users for select
  using (auth.uid() = id);

create policy "Users can update their own profile"
  on public.users for update
  using (auth.uid() = id);

-- User settings policies
create policy "Users can view their own settings"
  on public.user_settings for select
  using (auth.uid() = user_id);

create policy "Users can update their own settings"
  on public.user_settings for update
  using (auth.uid() = user_id);

create policy "System can insert default settings"
  on public.user_settings for insert
  with check (true);

-- Conversations policies
create policy "Users can view their own conversations"
  on public.conversations for select
  using (auth.uid() = user_id);

create policy "Users can insert their own conversations"
  on public.conversations for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own conversations"
  on public.conversations for update
  using (auth.uid() = user_id);

create policy "Users can delete their own conversations"
  on public.conversations for delete
  using (auth.uid() = user_id);

-- Messages policies
create policy "Users can view messages in their conversations"
  on public.messages for select
  using (
    exists (
      select 1 from public.conversations
      where conversations.id = messages.conversation_id
      and conversations.user_id = auth.uid()
    )
  );

create policy "Users can insert messages in their conversations"
  on public.messages for insert
  with check (
    exists (
      select 1 from public.conversations
      where conversations.id = messages.conversation_id
      and conversations.user_id = auth.uid()
    )
  );

-- Automations policies
create policy "Users can view their own automations"
  on public.automations for select
  using (auth.uid() = user_id);

create policy "Users can insert their own automations"
  on public.automations for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own automations"
  on public.automations for update
  using (auth.uid() = user_id);

create policy "Users can delete their own automations"
  on public.automations for delete
  using (auth.uid() = user_id);

-- Service connections policies
create policy "Users can view their own service connections"
  on public.service_connections for select
  using (auth.uid() = user_id);

create policy "Users can insert their own service connections"
  on public.service_connections for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own service connections"
  on public.service_connections for update
  using (auth.uid() = user_id);

create policy "Users can delete their own service connections"
  on public.service_connections for delete
  using (auth.uid() = user_id);

-- Social posts policies
create policy "Everyone can view approved social posts"
  on public.social_posts for select
  using (moderation_status = 'approved');

create policy "Users can view their own pending posts"
  on public.social_posts for select
  using (auth.uid() = user_id and moderation_status = 'pending');

create policy "Users can insert their own posts"
  on public.social_posts for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own posts"
  on public.social_posts for update
  using (auth.uid() = user_id);

create policy "Users can delete their own posts"
  on public.social_posts for delete
  using (auth.uid() = user_id);

-- Social votes policies
create policy "Everyone can view social votes"
  on public.social_votes for select
  using (true);

create policy "Users can insert their own votes"
  on public.social_votes for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own votes"
  on public.social_votes for update
  using (auth.uid() = user_id);

-- Social comments policies
create policy "Everyone can view approved comments"
  on public.social_comments for select
  using (moderation_status = 'approved');

create policy "Users can view their own pending comments"
  on public.social_comments for select
  using (auth.uid() = user_id and moderation_status = 'pending');

create policy "Users can insert their own comments"
  on public.social_comments for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own comments"
  on public.social_comments for update
  using (auth.uid() = user_id);

create policy "Users can delete their own comments"
  on public.social_comments for delete
  using (auth.uid() = user_id);

-- Token usage policies
create policy "Users can view their own token usage"
  on public.token_usage for select
  using (auth.uid() = user_id);

create policy "System can insert token usage"
  on public.token_usage for insert
  with check (true);

-- Notifications policies
create policy "Users can view their own notifications"
  on public.notifications for select
  using (auth.uid() = user_id);

create policy "Users can update their own notifications"
  on public.notifications for update
  using (auth.uid() = user_id);

create policy "System can insert notifications"
  on public.notifications for insert
  with check (true);

-- Functions to support query operations

-- Function to get conversation messages
create or replace function get_conversation_messages(
  conversation_id uuid,
  limit_val integer default 50,
  before_timestamp timestamptz default null
)
returns setof public.messages
language sql
security definer
set search_path = public
as $$
  select * from messages
  where conversation_id = get_conversation_messages.conversation_id
  and (before_timestamp is null or created_at < before_timestamp)
  order by created_at desc
  limit limit_val;
$$;

-- Function to search conversations
create or replace function search_conversations(
  search_query text,
  user_id_input uuid
)
returns table (
  conversation_id uuid,
  title text,
  snippet text,
  created_at timestamptz,
  updated_at timestamptz,
  message_count bigint
)
language sql
security definer
set search_path = public
as $$
  select 
    c.id as conversation_id,
    c.title,
    (
      select m.content
      from messages m
      where m.conversation_id = c.id 
      and m.content ilike '%' || search_query || '%'
      order by m.created_at desc
      limit 1
    ) as snippet,
    c.created_at,
    c.updated_at,
    (
      select count(*)
      from messages m
      where m.conversation_id = c.id
    ) as message_count
  from conversations c
  where c.user_id = user_id_input
  and (
    c.title ilike '%' || search_query || '%'
    or exists (
      select 1
      from messages m
      where m.conversation_id = c.id
      and m.content ilike '%' || search_query || '%'
    )
  )
  order by c.updated_at desc;
$$;

-- Function to get user's token usage summary
create or replace function get_user_token_usage_summary(
  user_id_input uuid,
  days_back integer default 30
)
returns table (
  provider text,
  model text,
  total_tokens bigint,
  total_cost numeric(10,6),
  day date,
  query_count bigint
)
language sql
security definer
set search_path = public
as $$
  select 
    provider,
    model,
    sum(total_tokens) as total_tokens,
    sum(total_cost) as total_cost,
    date_trunc('day', timestamp)::date as day,
    count(*) as query_count
  from token_usage
  where user_id = user_id_input
  and timestamp > (current_date - days_back::interval)
  group by provider, model, date_trunc('day', timestamp)::date
  order by day desc, total_tokens desc;
$$;

-- Function to update post vote count
create or replace function update_post_vote_count() 
returns trigger as $$
declare
  upvotes integer;
  downvotes integer;
begin
  -- Get upvote count
  select count(*) into upvotes
  from social_votes
  where post_id = NEW.post_id and vote_type = 'upvote';
  
  -- Get downvote count
  select count(*) into downvotes
  from social_votes
  where post_id = NEW.post_id and vote_type = 'downvote';
  
  -- Update the post's metadata with vote counts
  update social_posts
  set metadata = jsonb_set(
    coalesce(metadata, '{}'::jsonb),
    '{votes}',
    jsonb_build_object(
      'upvotes', upvotes,
      'downvotes', downvotes,
      'score', upvotes - downvotes
    )
  )
  where id = NEW.post_id;
  
  return NEW;
end;
$$ language plpgsql security definer;

-- Create trigger for vote counting
drop trigger if exists on_vote_change on public.social_votes;
create trigger on_vote_change
  after insert or update or delete on public.social_votes
  for each row execute procedure update_post_vote_count();

-- database/migrations/02_scheduled_tasks.sql
-- Tables for the scheduled tasks worker

-- Create a dedicated table for scheduled messages
create table if not exists public.scheduled_messages (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.users(id) on delete cascade not null,
  service text not null,
  recipient text not null,
  subject text, -- For email
  content text not null,
  scheduled_at timestamptz not null,
  access_token text, -- Encrypted token
  status text default 'scheduled' check (status in ('scheduled', 'processing', 'sent', 'retry', 'failed')),
  retry_count integer default 0,
  error text,
  executed_at timestamptz,
  result jsonb,
  created_at timestamptz default now()
);

-- Add index for scheduled messages
create index if not exists idx_scheduled_messages_status on public.scheduled_messages(status, scheduled_at);
create index if not exists idx_scheduled_messages_user_id on public.scheduled_messages(user_id);

-- Enable RLS for scheduled messages
alter table if exists public.scheduled_messages enable row level security;

-- RLS policies for scheduled messages
create policy "Users can view their own scheduled messages"
  on public.scheduled_messages for select
  using (auth.uid() = user_id);

create policy "Users can insert their own scheduled messages"
  on public.scheduled_messages for insert
  with check (auth.uid() = user_id);

create policy "System can update scheduled messages"
  on public.scheduled_messages for update
  using (true);

-- Create a dedicated cache table for geocoded addresses
create table if not exists public.geocode_cache (
  id uuid primary key default uuid_generate_v4(),
  address text not null,
  latitude numeric(10, 6) not null,
  longitude numeric(10, 6) not null,
  cached_at timestamptz default now(),
  unique (address)
);

-- Add index for geocode cache
create index if not exists idx_geocode_cache_address on public.geocode_cache(address);

-- Create a dedicated table for OAuth states
create table if not exists public.oauth_states (
  id uuid primary key default uuid_generate_v4(),
  state text unique not null,
  user_id uuid references public.users(id) on delete cascade not null,
  service text not null,
  redirect_uri text not null,
  created_at timestamptz default now(),
  expires_at timestamptz not null
);

-- Add index for OAuth states
create index if not exists idx_oauth_states_state on public.oauth_states(state);
create index if not exists idx_oauth_states_expiry on public.oauth_states(expires_at);

-- Create a dedicated table for user contacts
create table if not exists public.contacts (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references public.users(id) on delete cascade not null,
  name text not null,
  phone text,
  email text,
  service_id text, -- ID in the external service
  service text, -- Which service this contact is from
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique (user_id, service, service_id)
);

-- Add indexes for contacts
create index if not exists idx_contacts_user_id on public.contacts(user_id);
create index if not exists idx_contacts_name_trgm on public.contacts using gin (name gin_trgm_ops);
create index if not exists idx_contacts_service on public.contacts(service, user_id);

-- Enable RLS for contacts
alter table if exists public.contacts enable row level security;

-- RLS policies for contacts
create policy "Users can view their own contacts"
  on public.contacts for select
  using (auth.uid() = user_id);

create policy "Users can insert their own contacts"
  on public.contacts for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own contacts"
  on public.contacts for update
  using (auth.uid() = user_id);

create policy "Users can delete their own contacts"
  on public.contacts for delete
  using (auth.uid() = user_id);

-- database/migrations/03_archived_data.sql
-- Create tables for archived data to keep main tables lean

-- Archived conversations
create table if not exists public.archived_conversations (
  id uuid primary key,
  user_id uuid not null,
  title text,
  metadata jsonb default '{}'::jsonb,
  message_count integer,
  token_count integer,
  first_message_at timestamptz,
  last_message_at timestamptz,
  archived_at timestamptz default now()
);

-- Archived messages
create table if not exists public.archived_messages (
  id uuid primary key,
  conversation_id uuid not null,
  user_id uuid not null,
  role text not null,
  content text not null,
  llm_provider text,
  llm_model text,
  token_count integer,
  created_at timestamptz,
  archived_at timestamptz default now()
);

-- Add indexes for archived data
create index if not exists idx_archived_conversations_user_id on public.archived_conversations(user_id);
create index if not exists idx_archived_messages_conversation_id on public.archived_messages(conversation_id);

-- Enable RLS for archived data
alter table if exists public.archived_conversations enable row level security;
alter table if exists public.archived_messages enable row level security;

-- RLS policies for archived data
create policy "Users can view their own archived conversations"
  on public.archived_conversations for select
  using (auth.uid() = user_id);

create policy "Users can view messages from their archived conversations"
  on public.archived_messages for select
  using (
    exists (
      select 1 from public.archived_conversations
      where archived_conversations.id = archived_messages.conversation_id
      and archived_conversations.user_id = auth.uid()
    )
  );

-- Function to archive old conversations
create or replace function archive_old_conversations(
  days_threshold integer default 90,
  batch_size integer default 100
)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  conversations_archived integer := 0;
  conversation_record record;
begin
  -- Find old conversations to archive
  for conversation_record in (
    select c.id, c.user_id, c.title
    from conversations c
    where c.updated_at < now() - (days_threshold || ' days')::interval
    and not c.pinned -- Don't archive pinned conversations
    limit batch_size
  )
  loop
    -- Archive conversation metadata
    insert into archived_conversations (
      id, user_id, title, message_count, token_count, first_message_at, last_message_at
    )
    select 
      conversation_record.id,
      conversation_record.user_id,
      conversation_record.title,
      count(*),
      sum(token_count),
      min(created_at),
      max(created_at)
    from messages
    where conversation_id = conversation_record.id;
    
    -- Archive messages
    insert into archived_messages (
      id, conversation_id, user_id, role, content, llm_provider, llm_model, token_count, created_at
    )
    select 
      id, conversation_id, user_id, role, content, llm_provider, llm_model, token_count, created_at
    from messages
    where conversation_id = conversation_record.id;
    
    -- Delete original messages
    delete from messages where conversation_id = conversation_record.id;
    
    -- Delete original conversation
    delete from conversations where id = conversation_record.id;
    
    conversations_archived := conversations_archived + 1;
  end loop;

  return conversations_archived;
end;
$$;
