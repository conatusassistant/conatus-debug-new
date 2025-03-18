# Conatus AI Execution Platform Development Prompt

I'm continuing development of the Conatus AI execution platform. Begin by analyzing the GitHub repository at https://github.com/conatusassistant/C and follow these precise instructions:

## STEP 1: REPOSITORY ANALYSIS SEQUENCE (MANDATORY)
Follow this exact sequence to understand the codebase:

1. First, fetch and read the README.md file to understand:
   - Project purpose and architecture
   - Core system components
   - Technology stack
   - Current implementation status
   - Development priorities
   - Existing code patterns

2. Next, read the HANDOFF.md file to understand:
   - Specific development progress
   - Established patterns and guidelines
   - Implementation principles
   - Component patterns
   - Next priorities and pending implementations
   - Verification checklist requirements

3. Scan the complete repository structure:
   - List all directories and files with GitHub API
   - Map the entire structure to understand organization
   - Note naming conventions and patterns
   - Identify core components versus utilities

4. Examine these key implementation files:
   - web/app/layout.tsx - Root layout with providers
   - web/app/(app)/layout.tsx - Protected app layout with navigation
   - web/app/(app)/home/page.tsx - Chat interface with LLM Router
   - web/context/AuthContext.tsx - Authentication pattern
   - web/context/LLMRouterContext.tsx - LLM routing implementation
   - web/lib/modelSimulation.ts - Model simulation logic
   - web/app/(app)/library/page.tsx - Automation list implementation
   - web/app/(app)/social/page.tsx - Community features
   - backend/serverless.yml - Lambda configuration
   - supabase/migrations/*.sql - Database schema

5. Analyze code patterns:
   - Component composition patterns
   - State management approach
   - TypeScript typing conventions
   - Error handling strategy
   - Responsive design implementation

## STEP 2: MY CURRENT DEVELOPMENT FOCUS

[Describe your current implementation goal here, such as: "Today I want to implement the backend Lambda function for processing queries and connecting to actual AI model APIs."]

## STEP 3: IMPLEMENTATION GUIDELINES

When implementing new features, follow these strict guidelines:

### Code Structure
- Use PascalCase for component names
- Use camelCase for function names
- Use UPPER_SNAKE_CASE for constants
- Define interfaces and types before implementation
- Use JSDoc comments for public APIs
- Follow established file naming conventions
- Maintain consistent file structure

### Component Architecture
- Define props interface at the top
- Initialize hooks after props
- Define helper functions next
- Return JSX statement at the end
- Use semantic HTML elements
- Implement responsive design (mobile-first)
- Handle loading and error states
- Provide empty state guidance

### State Management
- Use React Context for global state
- Use local state for component-specific state
- Implement optimistic updates for better UX
- Handle state initialization properly
- Consider caching strategies for performance

### TypeScript Implementation
- Create proper interfaces for all data structures
- Avoid using 'any' type completely
- Use type guards for runtime safety
- Implement generics with proper constraints
- Extend existing types rather than duplicating

### Error Handling
- Use try/catch blocks for async operations
- Provide user-friendly error messages
- Create error recovery mechanisms
- Log errors for debugging
- Handle edge cases explicitly

## STEP 4: SPECIFIC IMPLEMENTATION REQUEST

Based on your analysis of the codebase, please:

1. Outline your implementation approach, including:
   - Component structure plan
   - Data flow architecture
   - State management strategy
   - API interaction patterns
   - Potential challenges and solutions

2. Provide TypeScript interfaces and types for all new components

3. Implement the requested feature with:
   - Detailed comments explaining complex logic
   - Proper error handling
   - Responsive design consideration
   - Performance optimization
   - Accessibility support

4. Explain how your implementation:
   - Integrates with existing components
   - Follows established patterns
   - Handles edge cases
   - Could be extended in the future

Remember to maintain consistency with the existing codebase and follow all established patterns. Do not introduce new patterns or approaches unless absolutely necessary.

## STEP 5: VERIFICATION
Before finalizing your implementation, verify it meets these criteria:

- ✓ Follows all established code patterns
- ✓ Maintains consistent styling and UX
- ✓ Uses proper TypeScript typing
- ✓ Implements appropriate error handling
- ✓ Functions correctly across all device sizes
- ✓ Optimizes for performance
- ✓ Handles all potential edge cases
- ✓ Integrates seamlessly with existing components
- ✓ Provides proper documentation
- ✓ Is prepared for future backend integration

I need a detailed, production-ready implementation that perfectly matches the existing project patterns and can be directly integrated into the codebase.
