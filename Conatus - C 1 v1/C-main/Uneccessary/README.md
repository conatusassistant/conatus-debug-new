# Conatus: AI Execution Engine

## 🚨 APPLICATION STATUS: READY FOR TESTING & DEMONSTRATION 🚨

**The Conatus AI platform is now FULLY BUILT with all core components implemented.** The current focus is on testing the application and optimizing performance for a smooth user experience. No new features are being added at this stage.

Conatus is an AI execution engine that goes beyond traditional assistants by actively performing tasks rather than just suggesting them. The platform integrates multiple specialized AI models and connects with popular services to automate routine tasks, eliminate manual inputs, and provide a streamlined user experience.

## Current Status: Ready for Testing

All core components have been implemented and are ready for demonstration and testing:
- ✅ Authentication & User Management 
- ✅ LLM Router System
- ✅ Automation Engine 
- ✅ Adaptive Learning System
- ✅ Service Integration Framework
- ✅ End-to-End Testing Framework
- ✅ Performance Monitoring System
- ✅ Error Handling Infrastructure

Current priorities:
1. **UI/UX TESTING** - Test all user interfaces and flows
2. **PERFORMANCE VALIDATION** - Ensure optimal speed and responsiveness
3. **BUG FIXING** - Address any issues found during testing
4. **FINAL DOCUMENTATION** - Complete all necessary documentation

## Core Vision & Purpose

Conatus differentiates itself by:

1. **Active Execution, Not Just Assistance**: Conatus directly performs actions like booking rides, ordering food, and managing schedules, rather than simply providing information.

2. **Multi-LLM Intelligence**: The system intelligently routes queries between specialized AI models based on query type, optimizing for:
   - **Accuracy**: Selecting the best model for specific tasks
   - **Speed**: Minimizing response time
   - **Cost**: Using efficient models for simpler tasks
   - **Capability**: Leveraging specialized models for domain-specific requests

3. **Adaptive Learning**: Conatus learns user patterns and preferences to proactively suggest and perform relevant actions based on:
   - Time-based patterns
   - Location awareness
   - User preferences
   - Historical interactions

4. **Seamless Service Integration**: Connects with popular apps and services through a unified authentication system, eliminating the need for multiple logins and API configurations.

## Quick Demo & Testing Guide

To test the application's UI/UX and core functionality:

1. **Set up the application** following the instructions in the "Running the Application" section below
2. **Create an account and log in** to access the three main tabs:
   - **Home**: Test the chat interface with different query types
   - **Library**: Create automation workflows with various triggers and actions
   - **Social**: Browse community templates and share your own
3. **Run the included test suite** to verify core functionality:
   ```bash
   npm run test:integration
   ```
4. **Generate a performance report** to identify any optimization opportunities:
   ```bash
   npm run report:performance
   ```

## Setting Up and Running the Application

### Local Development Setup

1. **Prerequisites**:
   - Node.js 18 or later
   - npm or yarn
   - Supabase account
   - AWS account (for deployment)

2. **Clone and Install**:
   ```bash
   git clone https://github.com/conatusassistant/C.git
   cd C
   npm install
   ```

3. **Environment Setup**:
   ```bash
   # Copy the example environment file
   cp web/.env.example web/.env.local
   
   # Set up required environment variables
   # - NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
   # - NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```

4. **Database Setup**:
   - Create a Supabase project
   - Run the SQL migrations from `supabase/migrations/`
   - Update your environment variables with the Supabase URL and anon key

5. **Running the Application**:
   ```bash
   # Start the web frontend
   npm run dev:web
   
   # Start the backend in another terminal (if testing serverless functions locally)
   npm run dev:backend
   ```

### Testing the Application

1. **Run Integration Tests**:
   ```bash
   npm run test:integration
   ```

2. **Test Core User Flows**:
   - Create an account and log in
   - Test the chat interface with different query types
   - Create and manage automations
   - Verify adaptive learning suggestions
   - Test social template browsing and sharing

3. **Performance Testing**:
   ```bash
   # Generate performance report
   npm run report:performance
   ```

## Tech Stack

### Frontend
- **Framework**: Next.js 13+ with App Router
- **Language**: TypeScript
- **Styling**: TailwindCSS
- **State Management**: React Context for global state, React Query for server state
- **Performance Monitoring**: Custom performance utilities

### Backend
- **Compute**: AWS Lambda serverless functions
- **API Gateway**: REST endpoints with authentication
- **Database**: Supabase PostgreSQL
- **Authentication**: Supabase Auth
- **Caching**: Redis
- **Storage**: AWS S3

### Testing & QA
- **End-to-End Testing**: Custom testing framework
- **Performance Monitoring**: Web Vitals tracking
- **Error Handling**: ErrorBoundary components and structured logging

## App Demonstration Checklist

### 1. Authentication Flow
- [ ] Sign up with email/password
- [ ] Log in with existing account
- [ ] Test password recovery flow
- [ ] Verify protected routes work properly

### 2. Home Tab & Chat Interface
- [ ] Send different types of queries:
  - [ ] Factual questions (routed to OpenAI)
  - [ ] Creative writing tasks (routed to Claude)
  - [ ] Research questions (routed to Perplexity)
  - [ ] Technical code queries (routed to DeepSeek)
- [ ] Check model selection indicator works
- [ ] Test manual model override
- [ ] Verify streaming responses work properly

### 3. Library Tab & Automation
- [ ] Create a new automation with time-based trigger
- [ ] Create an automation with event-based trigger
- [ ] Test the conditional logic builder
- [ ] Verify action configuration works:
  - [ ] Communication actions
  - [ ] Calendar actions
  - [ ] Transportation actions
  - [ ] Food delivery actions
- [ ] Test sequence building with multiple steps
- [ ] Activate and test automation execution
- [ ] Edit an existing automation
- [ ] Delete an automation

### 4. Social Tab & Community
- [ ] Browse community templates
- [ ] Filter templates by category
- [ ] View template details
- [ ] Import a template to your library
- [ ] Share one of your automations as a template
- [ ] Upvote/downvote templates

### 5. Adaptive Learning
- [ ] Verify suggestions appear based on usage patterns
- [ ] Interact with suggestion banner
- [ ] View suggestion details
- [ ] Accept or dismiss suggestions
- [ ] Check suggestion settings

### 6. Responsive Design
- [ ] Test on mobile viewport (320px)
- [ ] Test on tablet viewport (768px)
- [ ] Test on desktop viewport (1024px+)
- [ ] Verify navigation works on all screen sizes

## Remaining Tasks

The following specific tasks still need to be finalized:

1. **Complete UI/UX Testing**:
   - Run through all demonstration checklist items
   - Document any issues or inconsistencies
   - Verify responsive design across device sizes

2. **Component Optimization**:
   - Apply React.memo to appropriate components
   - Implement useMemo/useCallback for expensive operations
   - Optimize rendering paths to avoid unnecessary re-renders

3. **Final Documentation**:
   - Complete inline code documentation with JSDoc comments
   - Create user guide for the application
   - Document deployment procedures

## Architecture Overview

```
┌─────────────────────── USER LAYER ─────────────────────┐
│  Desktop Browser | Tablet | Mobile | Progressive Web App│
└─────────────────────────┬─────────────────────────────┘
                          │
┌─────────────────────────▼─────────────────────────────┐
│                   DELIVERY LAYER                       │
│        CloudFront CDN + S3 Static Hosting              │
└─────────────────────────┬─────────────────────────────┘
                          │
┌─────────────────────────▼─────────────────────────────┐
│                  API GATEWAY LAYER                     │
│                  AWS API Gateway                       │
└─────────┬─────────┬─────────┬───────────┬─────────────┘
          │         │         │           │
┌─────────▼─────────▼─────────▼───────────▼─────────────┐
│              SERVERLESS FUNCTION LAYER                 │
│  Query     Automation   Integration   Learning         │
│  Lambda    Lambda       Lambda        Lambda           │
└─────────┬─────────┬─────────┬───────────┬─────────────┘
          │         │         │           │
┌─────────▼─────────▼─────────▼───────────▼─────────────┐
│                   SERVICE LAYER                        │
│  LLM Router   Automation   OAuth/Service  Adaptive     │
│  Service      Engine       Connectors     Learning     │
└─────────┬─────────┬─────────┬───────────┬─────────────┘
          │         │         │           │
┌─────────▼─────────▼─────────▼───────────▼─────────────┐
│                     DATA LAYER                         │
│   Supabase         Redis        External APIs          │
│  (Auth/DB)        (Cache)       (LLMs, Services)       │
└─────────────────────────────────────────────────────────┘
```

## Latest Updates (March 18, 2025)

- ✅ Completed global API error handling with comprehensive retry logic
- ✅ Added performance reporting script with HTML report generation
- ✅ Updated project documentation to focus on testing and demonstration
- ✅ Enhanced error boundary components throughout the application

## License
[MIT](LICENSE)
