# Instructions for Uploading Large Project Files

Since the entire codebase is too large to upload at once via the GitHub web interface, let's break it down into manageable chunks. Follow these steps:

## Step 1: Create Directory Structure First

Create the basic directory structure before uploading files:

1. Go to https://github.com/conatusassistant/conatus-debug
2. Create directories one by one by clicking "Add file" > "Create new file"
3. Enter a path like `web/app/` in the name field and add a simple README.md in each folder
4. Commit each change

## Step 2: Upload Key Files in Batches

Upload files in these priority batches:

### Batch 1: Critical Configuration Files
- package.json
- next.config.js
- tailwind.config.js
- tsconfig.json
- .env.example (if it exists)

### Batch 2: Core Context Files
- web/context/AuthContext.tsx
- web/context/LLMRouterContext.tsx
- web/context/AdaptiveLearningContext.tsx

### Batch 3: React Query Hooks
- web/lib/hooks/useSuggestions.ts
- web/lib/hooks/useQuery.ts (if exists)
- Any other files in the hooks directory

### Batch 4: Supabase Related Files
- web/lib/supabase/client.ts
- web/lib/supabase/types.ts (if exists)
- web/lib/api/index.ts

### Batch 5: Layout Files
- web/app/layout.tsx
- web/app/(app)/layout.tsx
- web/app/(auth)/layout.tsx

### Batch 6: Page Components
- web/app/page.tsx
- web/app/(app)/home/page.tsx
- web/app/(app)/library/page.tsx
- web/app/(app)/social/page.tsx

## Step 3: Upload Additional Files as Needed

As we work through debugging, we can request additional files as needed. For each error or issue we encounter, we might need to see more related files.

## Alternative Approach: Share Only Error Files

If uploading all files is too cumbersome, we can take a different approach:

1. Focus on uploading just the files mentioned in error messages
2. Share error messages including file paths
3. Upload the specific files needed to fix those errors

## Using Git Command Line (If Possible)

If you have Git installed locally, that would be the easiest way to upload all files:

```bash
cd C:\Users\omymy\Downloads\Conatus - C 1\C-main\web
git init
git remote add origin https://github.com/conatusassistant/conatus-debug.git
git add .
git commit -m "Initial project files"
git push -u origin main
```

This would upload all files at once, but would require Git to be installed and configured on your machine.