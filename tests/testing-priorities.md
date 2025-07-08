# Testing Priorities for SIM Frontend

## High Priority (Write These First)

### 1. Authentication Flow
- ✅ Login success/failure (already done)
- ✅ Token storage (already done)
- [ ] Token refresh mechanism
- [ ] Logout clearing all data
- [ ] Remember me functionality

### 2. Lookup Service (Core Feature)
```javascript
// Essential tests:
- Search query validation
- Results parsing
- Error handling for failed lookups
- WebSocket connection handling
- Reconnection logic
```

### 3. SQL Agent Service
```javascript
// Critical paths:
- Query submission
- Response parsing
- Error messages
- Connection state management
```

## Medium Priority

### 4. Form Validations
- Email format validation
- Required field checks
- Password strength requirements

### 5. State Management
- User profile updates
- Local storage persistence
- State cleanup on logout

## Low Priority (Nice to Have)

### 6. UI Feedback
- Loading states
- Success messages
- Animation triggers

### 7. Browser Compatibility
- Local storage availability
- WebSocket support detection

## Testing Strategy by File

```
src/app/core/static/js/
├── auth-api.js          ✅ [8/10 tests needed]
├── lookup-service.js    ⚠️  [15-20 tests needed] 
├── sql-service.js       ⚠️  [10-15 tests needed]
├── auth-ui.js           🔸 [5-8 tests for validations]
├── profile.js           🔸 [3-5 tests for updates]
└── app.js              🔹 [Integration tests only]
```

## Recommended Test Count

For your codebase size (~2000 lines of JS):
- **Minimum viable**: 40-50 tests
- **Good coverage**: 80-100 tests  
- **Comprehensive**: 150+ tests

## Time Investment

- Initial test setup: ✅ Done (2-3 hours)
- Critical path tests: 4-6 hours
- Good coverage: 2-3 days
- Ongoing: 1 test for every new feature/bug fix

## ROI Calculation

**High-value tests** (write these first):
1. Any code that broke before
2. Complex business logic
3. Code you're afraid to change
4. Integration points
5. Security-related code

**Skip these** (unless you have time):
1. Simple UI toggles
2. One-line functions
3. Pure display components
4. Temporary features

## The "Sleep Well" Test

Ask yourself: "What tests would let me deploy on Friday afternoon and sleep well over the weekend?"

Those are the tests you need.