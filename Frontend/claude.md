# VOSOX Frontend — Claude Code Instructions

## 1. Purpose

This is the frontend codebase for the VOSOX ProcurementSuite application.

The application uses React, TypeScript, Vite and a microfrontend architecture.

The existing codebase is the primary source of truth.

Before making changes:

1. Inspect the existing implementation.
2. Search for similar functionality.
3. Reuse existing components, hooks, utilities and API services.
4. Follow the existing project architecture.
5. Make the smallest safe change required.
6. Do not modify unrelated code.

Do not introduce a new pattern when an existing project pattern already solves the problem.

---

# 2. General Coding Rules

* Use TypeScript.
* Do not use `any` unless absolutely unavoidable.
* Do not use `var`.
* Prefer `const`; use `let` only when reassignment is required.
* Use meaningful names.
* Keep functions focused.
* Avoid unnecessary abstraction.
* Avoid duplicated logic.
* Do not introduce unnecessary dependencies.
* Do not perform unrelated refactoring.
* Do not rename existing files/components/functions unless required.
* Do not change existing API contracts unless explicitly requested.

Prefer readable and maintainable code over clever code.

---

# 3. Before Writing Code

Before implementing a feature or fixing a bug:

1. Inspect the relevant directory.
2. Find similar components.
3. Find existing API services.
4. Find existing hooks.
5. Find existing types/interfaces.
6. Find existing shared components.
7. Find existing state-management patterns.
8. Follow the pattern already used by the project.

If you find an existing implementation that solves a similar problem, use it as the reference.

Do not guess how the application works.

---

# 4. Microfrontend Architecture

This project uses a microfrontend architecture.

Respect existing boundaries between:

* Host application
* Remote applications
* Shared components
* Shared utilities
* Platform functionality

Do not move functionality between applications unless explicitly required.

Before creating a shared component:

1. Check whether one already exists.
2. Check whether a similar component exists.
3. Determine whether the component belongs to the current microfrontend or a shared module.

Do not create duplicate components with slightly different implementations.

---

# 5. React Components

Components should have a clear responsibility.

Avoid very large components containing:

* API calls
* business logic
* state management
* data transformation
* complex UI
* validation

all in one file.

When the project pattern supports it, prefer:

```text
Component
    ↓
Hook
    ↓
Service/API
```

Do not create hooks merely for the sake of abstraction.

Use existing project patterns first.

---

# 6. TypeScript

Use explicit types for important data structures.

Prefer:

```typescript
interface Supplier {
    id: string;
    name: string;
    email: string;
}
```

over loosely typed objects.

Avoid:

```typescript
const supplier: any = response.data;
```

Prefer:

```typescript
const supplier: Supplier = response.data;
```

Reuse existing interfaces/types whenever possible.

Do not create duplicate interfaces representing the same API response.

---

# 7. State Management

Follow the state-management solution already used in the application.

Do not introduce:

* Redux
* Zustand
* Context
* React Query
* another state library

unless the project already uses it or the task explicitly requires it.

Keep state local when it is only required by one component.

Avoid unnecessary global state.

---

# 8. API Integration

Do not make API calls directly inside components if the project already has an API/service layer.

First search for existing:

* API clients
* service classes
* hooks
* request utilities
* authentication interceptors
* error handling

Follow the existing implementation.

Never hardcode API URLs.

Do not write:

```typescript
fetch("http://localhost:5000/api/...")
```

Use the project's existing configuration/environment mechanism.

---

# 9. Authentication

Never bypass the application's authentication mechanism.

Never:

* hardcode tokens
* expose credentials
* store secrets in source code
* log access tokens
* log refresh tokens
* bypass authorization checks

Follow the existing authentication and MSAL/API authorization implementation.

If modifying authentication, inspect all existing authentication-related code before making changes.

---

# 10. Authorization

UI authorization must not be treated as the only security mechanism.

Follow the existing role/permission system.

When adding UI functionality for a protected operation:

* follow existing role checks
* follow existing permission checks
* do not invent new role identifiers
* reuse existing authorization utilities

The backend remains the authoritative security boundary.

---

# 11. API Response Handling

Handle the common states:

```text
Loading
Success
Empty
Error
```

Do not leave the user with a blank screen when an API fails.

Reuse existing:

* loaders
* toast notifications
* alerts
* error components
* empty-state components

Do not create another notification/loading system if one already exists.

---

# 12. Forms

Follow existing form patterns.

Before creating a form:

1. Find similar forms.
2. Reuse existing form components.
3. Reuse validation utilities.
4. Follow existing error display patterns.
5. Follow existing submit/loading behavior.

Do not duplicate validation logic unnecessarily.

---

# 13. Tables and Lists

Follow existing table/list components.

For API-driven tables consider:

* loading
* empty state
* error state
* pagination
* filtering
* sorting
* row actions

Do not implement a completely new table pattern if an existing reusable table exists.

---

# 14. UI / Design System

Maintain a consistent enterprise UI.

Before creating new UI, inspect existing screens and components.

Reuse:

* buttons
* inputs
* dropdowns
* modals
* cards
* tables
* typography
* spacing
* icons
* colors
* form layouts

Do not introduce arbitrary styling that conflicts with the existing application.

Do not redesign unrelated screens while implementing a feature.

---

# 15. CSS

Follow the project's existing styling approach.

Do not introduce another styling framework without explicit approval.

Avoid excessive inline styles when the project uses reusable classes/components.

Avoid `!important` unless there is a legitimate reason.

Do not duplicate large CSS blocks.

Prefer reusable styles when the same pattern appears multiple times.

---

# 16. Responsive Design

New UI should work with the application's supported screen sizes.

Check:

* desktop
* laptop
* tablet where applicable

Do not break existing layouts while adding new components.

---

# 17. Accessibility

Where applicable:

* use semantic HTML
* provide labels for form controls
* provide accessible names for buttons/icons
* ensure keyboard interaction works
* do not use clickable `div` elements when a button is appropriate

Follow existing accessibility patterns.

---

# 18. Performance

Avoid unnecessary:

* API calls
* renders
* state updates
* expensive calculations
* large component trees

Do not add `useMemo` or `useCallback` everywhere.

Use memoization when there is an actual performance reason.

Avoid loading large datasets when pagination/filtering can be performed by the backend.

---

# 19. Error Handling

Never silently ignore API errors.

Bad:

```typescript
try {
    await saveData();
} catch {
}
```

Handle errors using the existing application pattern.

Show appropriate user-facing messages.

Do not expose internal backend errors unnecessarily.

---

# 20. File Uploads

Follow the existing asset/metadata upload architecture.

When handling multiple files:

* process each file independently where appropriate
* do not accidentally deactivate other files
* preserve existing `IsActive` behavior
* handle partial failures correctly
* do not duplicate upload logic

Before modifying upload functionality, inspect the existing upload implementation.

---

# 21. Procurement / RFQ Screens

Be careful with:

* RFQ
* Supplier
* Buyer
* Supplier RFQ
* RFQ invitations
* Users
* Quotations
* Assets
* External suppliers
* RFQ status
* Start date
* End date

Do not assume two IDs represent the same entity.

Follow the API contract exactly.

Do not create frontend workarounds for backend bugs unless explicitly requested.

---

# 22. Security

Never commit:

* API keys
* passwords
* tokens
* private keys
* credentials
* production secrets

Check `.env` usage before adding configuration.

Do not expose sensitive backend information in frontend logs.

Remember that frontend environment variables are generally visible to users in the built application.

Never put secrets in frontend environment variables.

---

# 23. Dependencies

Before installing a new npm package:

1. Search `package.json`.
2. Check whether an existing dependency can solve the problem.
3. Check how similar functionality is already implemented.
4. Avoid unnecessary dependencies.

Do not install packages without a reason.

---

# 24. Git Safety

Do not perform destructive Git commands unless explicitly requested.

Never run without explicit instruction:

```text
git reset --hard
git clean -fd
git push --force
```

Do not modify unrelated files.

Before finishing:

```text
git status
git diff
```

Review the changes.

---

# 25. Testing / Validation

After making changes:

1. Run the relevant lint/type-check/build command if available.
2. Test the affected functionality where possible.
3. Check for TypeScript errors.
4. Check for broken imports.
5. Check for unused imports.
6. Check API request/response compatibility.

Do not claim something was tested if it was not actually tested.

---

# 26. Do Not Over-Engineer

Do not introduce:

* unnecessary abstractions
* unnecessary hooks
* unnecessary services
* unnecessary components
* unnecessary dependencies
* unnecessary state
* unnecessary refactoring

Solve the requested problem with the smallest maintainable change.

---

# 27. Final Review

Before completing the task, verify:

* Only required files were changed.
* Existing architecture was preserved.
* Existing components were reused where appropriate.
* Existing API patterns were followed.
* No secrets were introduced.
* No unnecessary dependencies were added.
* No unrelated code was modified.
* Loading/error/empty states are handled where applicable.
* TypeScript types are correct.
* No obvious lint/build errors were introduced.

Provide a concise final summary:

Changes:

* ...

Files changed:

* ...

Validation:

* ...

Potential concerns:

* ...
