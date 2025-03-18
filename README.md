# Conatus AI Debug Repository

This repository contains the Conatus AI Execution Platform code for debugging purposes. Each Claude session will use this repository as the central reference point for debugging progress and next steps.

## For Each New Claude Session

Copy and paste this exact prompt at the beginning of each new Claude session:

```
I'm working on debugging the Conatus AI Execution Platform. Please help me continue the debugging process by:

1. Checking the latest state of the repository at https://github.com/conatusassistant/conatus-debug
2. Reading the DEBUG_LOG.md file to understand what's been fixed and what still needs fixing
3. Reading any error messages I provide
4. Giving me step-by-step solutions to resolve the current issues
5. IMPORTANT: Update the DEBUG_LOG.md file after each major fix or when identifying new issues
6. IMPORTANT: Also update this README.md if any process changes are needed for future sessions

Current errors/issues I'm seeing:
[Paste your error messages or describe the current problem here]
```

## Development Status Tracking

For a detailed log of debugging progress, issues addressed, and pending tasks, see the [DEBUG_LOG.md](./DEBUG_LOG.md) file.

## Current Issues

The project is facing several issues that need to be addressed:

1. **React Query v5 Compatibility**: The `AdaptiveLearningContext` component is using React Query syntax that's incompatible with v5.
2. **Supabase Environment Variables**: Issues with Supabase environment variables not being recognized.
3. **Module Resolution**: Problems with certain Node.js modules not being found (buffer-util, utf-8-validate).

## Project Structure

The Conatus AI Execution Platform consists of:

- Next.js 13+ frontend with App Router
- TypeScript for type safety
- TailwindCSS for styling
- React Context for global state management
- Supabase for authentication and database

## Key Files to Focus On

- `web/app/layout.tsx` - Root layout with providers
- `web/context/AdaptiveLearningContext.tsx` - The context with React Query issues
- `web/lib/hooks/useSuggestions.ts` - React Query hooks with compatibility issues
- `web/lib/supabase/client.ts` - Supabase client configuration

## Getting Started Locally

1. Ensure you have Node.js 16+ installed
2. Install dependencies: `npm install`
3. Create a `.env.local` file with Supabase credentials
4. Start the development server: `npm run dev`

## Log Update Guidelines

When updating the DEBUG_LOG.md file:

1. Add a timestamp for each update session
2. Mark resolved issues with "✅ FIXED" status
3. Add new issues with details about error messages and affected files
4. Update "Next Steps" section with remaining tasks
5. Document any workarounds or solutions implemented
6. Include code samples for key fixes

This ensures each Claude session builds on the previous debugging progress.