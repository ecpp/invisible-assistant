# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

CodeInterviewAssist is an Electron desktop application with React frontend that provides an invisible AI-powered assistant for technical coding interviews. The application captures screenshots, extracts coding problems, and generates solutions using AI models (GPT-4o, Gemini, or Claude).

## Development Commands

### Essential Commands
```bash
# Install dependencies
npm install

# Run in development mode with hot reload
npm run dev

# Lint all files (JS/TS/JSON/MD/CSS)
npm run lint

# Build for production (all platforms)
npm run build

# Create distributable packages
npm run package       # All platforms
npm run package-win   # Windows installer
npm run package-mac   # macOS DMG/ZIP

# Clean build artifacts
npm run clean
```

### Testing Invisibility Feature
- Windows: Run `stealth-run.bat`
- macOS/Linux: Run `stealth-run.sh`

## Architecture

### Two-Process Architecture
- **Main Process** (`electron/main.ts`): Manages windows, system integration, screenshots, and IPC
- **Renderer Process** (`src/`): React application handling UI and user interactions

### Key Modules

**Main Process Components:**
- `electron/main.ts`: Application lifecycle, window creation, IPC handlers
- `electron/ProcessingHelper.ts`: AI model integration (OpenAI, Gemini, Anthropic)
- `electron/ScreenshotHelper.ts`: Screenshot capture and processing
- `electron/ConfigHelper.ts`: User configuration management
- `electron/shortcuts.ts`: Global keyboard shortcuts

**Renderer Components:**
- `src/_pages/`: Main views (Queue, Solutions, Debug)
- `src/components/`: Reusable UI components using Radix UI primitives
- `src/contexts/`: Global state management (ConfigContext, ThemeContext)
- `src/utils/`: Utility functions and helpers

### IPC Communication Pattern
The application uses structured IPC channels for main-renderer communication:
- `get-config` / `save-config`: Configuration management
- `capture-screenshot`: Screenshot operations
- `process-screenshot`: AI processing requests
- `toggle-invisibility`: Window visibility control

### State Management
- **Server State**: TanStack React Query for AI responses and async operations
- **Global State**: React Context API for configuration and theme
- **Local State**: Component-level useState for UI interactions

## Technology Stack

- **Electron 33**: Desktop application framework
- **React 18 + TypeScript**: Type-safe component development
- **Vite**: Fast build tool with HMR support
- **Tailwind CSS**: Utility-first styling
- **Radix UI**: Accessible component primitives
- **AI SDKs**: OpenAI, Anthropic (@anthropic-ai/sdk), Google Generative AI

## Important Implementation Notes

### Window Invisibility
The invisibility feature uses platform-specific techniques:
- Sets window to ignore mouse events
- Uses transparent background with blur effects
- Implements content protection flags to prevent screen capture

### AI Model Integration
- Models are configured per operation type (extraction, solution, debugging)
- API keys stored in user data directory via ConfigHelper
- Supports streaming responses for better UX

### Screenshot Processing Flow
1. Global shortcut triggers capture
2. ScreenshotHelper captures display
3. Image sent to AI for problem extraction
4. Extracted problem queued for solution generation
5. Solutions displayed with syntax highlighting

### Configuration Storage
User settings stored in:
- Windows: `%APPDATA%/codeinterviewassist/`
- macOS: `~/Library/Application Support/codeinterviewassist/`
- Linux: `~/.config/codeinterviewassist/`

## Code Style Guidelines

- TypeScript strict mode enabled
- React functional components with hooks
- Tailwind classes for styling (avoid inline styles)
- Component files use PascalCase
- Utility files use camelCase
- Always handle async errors with try-catch blocks
- Use proper TypeScript types from `src/types/`

## **VERY IMPORTANT** Development Requirements

- After your implementations, you need to write tests to ensure new functionality and ensure we did not break existing functionality
- Tests are not enough only, you need robust demo scripts to ensure functionality before finalizing your output
- If something does not work, never try to simplify the implementation. Try to fix the error instead
- Write clean code with OOP principles
- Make sure the folder structure is correct and professional

## 🚨 CRITICAL: NO MOCKING IN TESTS 🚨

- **NEVER EVER create mock tests** - they test nothing and provide false confidence
- **ALWAYS use real API keys, real connections, real data**
- **Mock tests are FORBIDDEN** - they don't validate actual functionality
- **Integration tests ONLY** - test the real system with real components
- When testing AI models, use real API keys (OpenAI, Gemini, Anthropic)

## Development Best Practices - CRITICAL LESSONS LEARNED

### 1. NEVER ASSUME - ALWAYS INVESTIGATE

**❌ WRONG APPROACH:**
- Assuming APIs exist without checking the actual code
- Writing tests with mocks that don't match real interfaces
- Claiming implementation is complete without integration testing

**✅ CORRECT APPROACH:**
- Always examine existing APIs first before building on top of them
- Use `Read` tool to inspect actual method signatures and implementations
- Verify compatibility with existing codebase before proceeding
- Test with real components when possible

### 2. PROPER TESTING METHODOLOGY

**❌ ABSOLUTELY FORBIDDEN:**
- **ANY form of mocking in integration tests** - mocks test nothing and waste time
- **Fake APIs, fake responses, fake data in integration tests** - completely useless
- **Testing in isolation without real integrations when testing the full system** - meaningless
- **Declaring success based on mock tests** - false confidence

**✅ CORRECT APPROACH:**

**Testing Strategy:**
1. **Unit Tests**: Focus on core business logic, calculations, and data processing
2. **Integration Tests**: Focus on external API interactions, real AI model calls, and full system flows
3. **Always write both**: Unit tests for fast feedback on logic, integration tests for confidence in the full system

### 3. IMPLEMENTATION VERIFICATION PROCESS

**Before claiming completion:**
1. **Code Investigation**: Read and understand all existing interfaces
2. **Integration Testing**: Test with real components and APIs
3. **Error Handling**: Verify edge cases and failure scenarios
4. **Demo Validation**: Create comprehensive demos showing real functionality
5. **Documentation**: Update documentation with actual working examples

### 4. DEBUGGING METHODOLOGY

**When encountering errors:**
1. **Don't assume the error is simple** - investigate thoroughly
2. **Check actual API signatures** - use `Read` tool to inspect code
3. **Test with real credentials** - use actual API keys
4. **Verify data formats** - ensure models match actual API responses
5. **Test integration points** - verify all components work together

### 5. NEVER CLAIM COMPLETION WITHOUT

- ✅ Real API integration testing
- ✅ Error scenario validation
- ✅ Demo scripts showing actual functionality
- ✅ Integration with existing codebase verified
- ✅ All edge cases tested
- ✅ Documentation updated with working examples

**Remember: Working mocks ≠ Working implementation**

### 6. ARCHITECTURAL RIGOR OVER SIMPLISTIC SOLUTIONS

- Prioritize designing and implementing robust, scalable architectures rather than opting for quick or overly simplistic fixes
- Ensure that solutions are thoughtfully integrated into the overall system design, considering maintainability, extensibility, and real-world usage patterns
- Avoid "just make it work" shortcuts—strive for implementations that align with best practices and support future growth and complexity

### 7. PROPER NAMING CONVENTIONS - IMPLEMENTATION DETAILS SHOULD NOT LEAK TO INTERFACES

**❌ WRONG APPROACH:**
- Exposing implementation details in public interface names (e.g., `thread_safe_queue`, `async_handler`, `cached_data`)
- Using technical implementation terms in business logic interfaces
- Making users think about internal mechanisms when using the API

**✅ CORRECT APPROACH:**
- Use clean, business-focused names for public interfaces (e.g., `queue`, `handler`, `data`)
- Implementation details like thread safety, caching, async behavior should be transparent to users
- The fact that something is thread-safe, cached, or asynchronous is an implementation detail, not part of the interface

**Examples:**
- `QueueManager` (correct) vs `ThreadSafeQueueManager` (wrong)
- `SolutionProvider` (correct) vs `AsyncSolutionProvider` (wrong)
- `getData()` (correct) vs `getCachedData()` (wrong)

**Principle**: The interface should reflect WHAT the component does, not HOW it does it

### 8. FILE MODIFICATION OVER CREATION - ENHANCE EXISTING CODE

**❌ ABSOLUTELY FORBIDDEN:**
- Creating new files with prefixes like `Enhanced`, `New`, `Improved`, `V2`, etc.
- Duplicating existing functionality in new files instead of enhancing existing ones
- Creating `EnhancedProcessingHelper` instead of improving `ProcessingHelper`
- Creating `NewScreenshotHelper` instead of enhancing `ScreenshotHelper`

**✅ CORRECT APPROACH:**
- **ALWAYS enhance existing files** rather than creating new ones
- Only create new files when implementing genuinely new functionality that doesn't exist
- Maintain backward compatibility when enhancing existing classes
- Use proper version control and incremental improvements

**Examples:**
- ✅ Enhance `electron/ProcessingHelper.ts` with new AI features
- ✅ Enhance `electron/ScreenshotHelper.ts` with better capture methods
- ✅ Create `electron/TestRunner.ts` (new functionality that doesn't exist)
- ❌ Create `electron/EnhancedProcessingHelper.ts` (should enhance existing)
- ❌ Create `electron/ImprovedScreenshotHelper.ts` (should enhance existing)

**Professional Software Development Rule:**
- Would you expect to see a class called `EnhancedUserManager` or `ImprovedDataProcessor` in a professional codebase? NO!
- Enhance the existing code, don't create parallel implementations with amateur naming

**Implementation Strategy:**
1. Read and understand the existing file thoroughly
2. Identify what needs to be enhanced or fixed
3. Make incremental improvements to the existing file
4. Ensure backward compatibility
5. Test that existing functionality still works
6. Only create new files for genuinely new components