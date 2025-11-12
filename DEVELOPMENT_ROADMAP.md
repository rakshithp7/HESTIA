## Development Roadmap

### Documentation & Onboarding

- 2025-10-12: Refreshed repository README for onboarding

  - Added branded logo header and concise project description
  - Documented core features, architecture highlights, and required environment variables
  - Standardised setup instructions around `pnpm` and noted Supabase/Netlify deployment considerations

### Error & Fallback Pages

- 2025-10-10: Added whimsical 404 experience

  - Created cute firefly-inspired layout at `app/not-found.tsx` that keeps the brand palette and typography
  - Included primary and secondary calls-to-action guiding visitors back to the home page or resources
  - Updated hero treatment to render the provided dotLottie animation (`public/404-anim.lottie`) with the official React wrapper

### Identity Verification

- 2025-09-18: Integrated Stripe Identity verification flow

  - Added secure environment handling for Stripe secrets and Supabase service role in `lib/env/server.ts`
  - Created Stripe Identity service helper at `lib/stripe/identity.ts` and Supabase service client at `lib/supabase/service.ts`
  - Implemented API endpoints for starting, retrying, and receiving Stripe Identity webhooks under `app/api/identity/*`
  - Built `/verify` experience with session polling, status messaging, and retry handling; wired age verification page CTA
  - Updated auth-gate layout and Connect session page to enforce verification status and react to webhook-driven changes
  - Added reusable Stripe Identity flow support via `STRIPE_IDENTITY_FLOW_ID` env with provided email details for consistent configuration

- Persist Stripe-sourced date of birth to `profiles.date_of_birth` upon successful verification for future age gating
- 2025-10-07: Hardened DOB persistence for Stripe Identity verifications

  - Required new `STRIPE_IDENTITY_RESTRICTED_KEY` env and restricted Stripe client for sensitive lookups
  - Webhook now re-fetches the session with `verified_outputs.dob` expansion to reliably store DOB in `profiles`
  - Verified UI surfaces “Age verified from ID” with derived age when DOB is stored

### WebRTC Voice Implementation

- 2025-10-16: Stabilized RTC session teardown & diagnostics

  - Replaced the recursive `rtcWarn`/`rtcError` helpers with a shared logger so connection warnings stop crashing the hook
  - Persist the active room channel via ref so `end_session` broadcasts reuse the subscribed channel and reliably notify peers
  - Hardened cleanup paths to clear room channel refs whenever a room unsubscribes, preventing stale signaling handles between matches

- 2025-10-13: Added in-session reporting modal

  - Wired shadcn dialog-based flow on Connect sessions so members can choose multiple report reasons
  - On submit the session ends, re-queues the user with a fresh match, and surfaces a safety confirmation toast
- 2025-10-14: Enhanced reporting dialog with contextual notes

  - Added optional free-form comments textarea so members can provide safety details beyond the predefined reasons
  - Captured note state alongside selected reasons to prepare for downstream moderation integrations
- 2025-10-15: Wired matchmaking telemetry with blocking & moderation hooks

  - Added Supabase tables for `active_matches` and `blocked_users`, plus API routes to register, cleanup, and list matches
  - Reporting endpoint now records chat transcripts, resolves participant emails, blocks the reported user, and logs the moderation payload for email previews
  - `useRTCSession` now uses authenticated user IDs for pairing, skips blocked peers, and syncs match state with the new APIs so moderators can trace every session
  - Hardened schema integrity by referencing `profiles`, re-enabling RLS on the new tables, and scoping `blocked_users` policies to the owning member
  - Profile page now includes a “Blocked users” panel so members can review and remove entries without leaving the app
- 2025-10-17: Bootstrapped admin roles and moderation schema

  - Added Supabase migration for profile roles, moderation reports, user bans, and an `active_user_bans` helper view
  - Introduced shared TypeScript models plus helpers for admin role checks and ban calculations
- 2025-10-18: Built moderator workflows and ban enforcement

  - Persisted `/api/report` submissions into `moderation_reports` and exposed `/api/me/ban` plus admin-only moderation APIs for listing, resolving, and banning
  - Created `/admin/reports` dashboard with ban issuance/lift controls, transcript viewer, and resolution actions
  - Added client-side ban messaging and matchmaking guards so banned members see the remaining duration before rejoining
  - Surfaced admin navigation via the profile drawer and a dedicated `/admin` console that mirrors the profile layout while keeping tools separate
- 2025-09-02: Implemented simplified WebRTC voice chat

  - Added WebRTC dependencies: `webrtc-adapter` and `detectrtc`
  - Created `useVoiceRTC` hook in `lib/webrtc/useVoiceRTC.ts`
  - Improved session UI with better status indicators
  - Added proper connection state handling and error messages
  - Implemented disconnect and switch to chat functionality

- 2025-09-03: Fixed SSR compatibility issues

  - Modified Navbar component to use `dynamic` import with `{ ssr: false }` to prevent window access during SSR
  - Updated `useVoiceRTC` hook to safely handle localStorage and window access during server-side rendering
  - Added SSR-safe UUID generation with proper client/server detection

- 2025-09-03: Enhanced voice session UI with audio waveforms
  - Created `AudioWaveform` component for real-time audio visualization
  - Implemented dynamic waveform animation that responds to actual audio levels
  - Moved microphone permission button to the user's panel for better UX
  - Added visual indication of speaking/muted states with animated waveforms
  - Exposed local and remote streams from useVoiceRTC hook for visualization
- 2025-09-04: Improved audio waveform visualization
  - Updated waveform to display flat line when there's no sound
  - Added proper muted state handling to show flat line when microphone is muted
  - Improved audio activity detection with sound threshold
  - Separated muted state from active state for better visual feedback
  - Added configurable sound threshold to reduce sensitivity
  - Implemented average sound level calculation for better noise filtering
- 2025-09-04: Improved microphone access handling
  - Added automatic microphone permission detection on page load
  - Implemented loading state while checking for microphone access
  - Added specific error messages for different microphone access states
  - Only show "Enable Microphone" button when permission check is complete
  - Wrapped microphone request function in useCallback for better performance
- 2025-09-04: Fixed WebRTC for Netlify deployment

  - Added netlify.toml with required headers for WebRTC and Supabase WebSockets
  - Enhanced ICE server configuration with multiple STUN servers for better NAT traversal
  - Added improved error handling and logging for WebRTC connections
  - Added error handling for Supabase channel connection issues
  - Added detailed connection state monitoring for better debugging

- 2025-09-05: Improved session management and peer notifications
  - Added End Call button with proper cleanup
  - Implemented session end notification to remote peer
  - Added automatic return to matching pool when session ends
  - Fixed issue where remote peer wasn't notified when session ended
  - Added proper cleanup of WebRTC connections and media streams
  - Improved navigation flow after ending a session

### Auth Views

- 2025-08-29: Implemented sign-in page UI at `app/(auth)/sign-in/page.tsx`.

  - Added accessible form fields for email and password
  - Included remember-me checkbox and forgot password link
  - Used shared `Button` and Tailwind theme tokens to match branding

- 2025-08-29: Implemented sign-up page wired to Supabase at `app/(auth)/sign-up/page.tsx`.
  - Creates user and stores `first_name`/`last_name` in `user_metadata`
  - Inline "Check your email" message; no separate page
  - `emailRedirectTo` → `/age-verification`
- 2025-09-04: Improved auth forms UX
  - Reset form fields after successful sign-up
  - Added success message after sign-up with email verification instructions
  - Clear error messages when switching between sign-in and sign-up modes
- 2025-09-19: Expanded verification resend flow for sign-up and sign-in
  - Store the submitted email and surface resend controls once sign-up succeeds
  - Resurfaced resend option on sign-in when Supabase reports the email as unconfirmed
  - Cooldown now escalates 60s → 2m → 5m → 10m with clear messaging between attempts
  - Wired Supabase `auth.resend` to reuse existing age verification redirect

### Supabase Auth Integration

- Installed `@supabase/supabase-js` and `@supabase/ssr`
- Helpers added: `lib/supabase/client.ts`, `lib/supabase/server.ts`
- `(full)` routes protected in `app/(full)/layout.tsx`
- Navbar shows `SIGN OUT` when authenticated; hides `SIGN IN/SIGN UP`
- 2025-10-14: Hardened Supabase auth session handling
  - Replaced `auth.getSession()` usage with server-verified `auth.getUser()` across navbar, auth-gate layout, profile, and age verification flows
  - Client auth listener now re-fetches the authenticated user on state changes to avoid trusting storage-backed session payloads
  - Added graceful handling for missing-session responses so anonymous visitors no longer trigger `AuthSessionMissingError` noise in logs or UI
  - Introduced shared `getUserById` helper in `lib/supabase/profile-service.ts` to reuse the profiles lookup across surfaces
  - Replaced ad-hoc `<button>` elements with the shared shadcn `Button` component for consistent styling and accessibility
  - Simplified resources search UI by removing the temporary loading overlay once local filtering proved fast enough
  - Standardised chat message composer on shadcn `Input` for consistent styling and focus states
  - Consolidated shared auth helpers into `lib/supabase/auth-utils.ts` to keep validation and logging logic DRY

### Database & Profiles

- 2025-08-29: Added `public.profiles` table with RLS and triggers
  - Auto-create profile on `auth.users` insert; sync on metadata updates
  - Columns: `id`, `first_name`, `last_name`, timestamps

### Password Reset

- 2025-08-29: Implemented password reset flow
  - Request: `app/(auth)/forgot-password/page.tsx`
  - Update: `app/(auth)/update-password/page.tsx`
  - Sign-in page link updated

### Full Access Pages & Nav

- 2025-08-29: Added authenticated nav links and pages
  - Navbar (authed): HOME, ABOUT, CONNECT, RESOURCES, CONTACT US, SIGN OUT
  - Pages: `/(full)/about`, `/(full)/connect`, `/(full)/resources`, `/(full)/contact`
  - About page styled per screenshot (hero + FAQ layout)
  - 2025-08-29: About FAQ made interactive
    - Converted `/(full)/about/page.tsx` to client component
    - Left list items now clickable; right panel renders selected content
    - No scrolling between FAQ answers; content swaps in place
    - Added search icon to FAQ search input using `lucide-react`
  - 2025-08-29: Resources page interaction updated
    - Converted left nav to selection; right panel swaps content without scrolling
    - Kept search input with icon; search filters entries within selected section
  - 2025-09-17: Added mobile-responsive accordion layout
    - Installed shadcn accordion component
    - Added accordion animations to globals.css
    - Desktop: keeps existing sidebar + content layout (hidden on mobile)
    - Mobile: uses accordion where section titles expand to show content
    - Search functionality works with both layouts
  - 2025-09-17: Fixed mobile search results
    - Only show sections with matching results when searching on mobile
    - Added "no results found" message when search yields no matches
    - Auto-expand first section with results when searching
    - Improved mobile UX by hiding irrelevant sections
- 2025-09-17: Enhanced search to include section titles
  - Section titles are now searchable and matching titles show entire section
  - If section title matches query, all entries in that section are displayed
  - Improved search relevance and discoverability
- 2025-10-13: Expanded resources search UX
  - Desktop search now surfaces matches from every section within the main results column
  - Preserved sidebar navigation while rendering multi-section hits inline to improve discovery
  - Added asynchronous loading affordance for future API-backed searches
- 2025-10-13: Polished resources search interaction
  - Removed visual selection from sidebar while searching to avoid conflicting state
  - Auto-expands matching accordion panels on mobile for quicker scanning
  - Highlighted query text across section titles, entries, and descriptions
- 2025-10-13: Centralized resources data
  - Extracted static resources content into `data/resources.ts` for reuse
  - Keeps page component focused on presentation and interaction logic
- 2025-10-13: Centralized FAQ content
  - Moved About page FAQ items into `data/faq.ts` with shared types
  - Simplifies page and enables reuse across other surfaces
  - Stored FAQ copy as plain data (no JSX) to keep presentation logic within components
- 2025-10-13: Added profile management page
  - `/profile` offers password updates and embedded verification status panel
  - Avatar dropdown now links to the profile workspace on desktop and mobile
  - Shared verification hook/component powers both `/verify` and profile experiences
- 2025-09-17: Added mobile accordion layout to About page
  - Desktop: maintains existing two-column layout (sidebar + content)
    - Mobile: uses accordion where FAQ questions expand to show content
    - Consistent with Resources page mobile experience
    - Smooth expand/collapse animations using shadcn accordion component
  - 2025-08-29: Navbar active link underline
    - Used `usePathname()` to add underline to the current route
    - Refactored links to use a shared `linkClass` helper with `cn()`
  - 2025-08-31: Limited layout always renders `Navbar`
    - Unauthenticated users now see only `SIGN IN` and `SIGN UP`
    - Resources page is publicly accessible under `/(limited)/resources`
  - 2025-08-31: Hide `Navbar` on unauthenticated home page
    - `Navbar` returns `null` on `/` when no session
    - Updated to render only `ThemeToggle` at top-right on `/` when logged out
  - 2025-08-31: Unified `Navbar` links for all users
    - Removed SIGN IN/SIGN UP from nav; kept ABOUT, CONNECT, RESOURCES, CONTACT US
    - Right side shows `ThemeToggle` always; avatar only when authenticated

### Connect Page

- 2025-08-31: Moved `/connect` to limited routes with conditional content
  - When authenticated: show connect content (placeholder for now)
  - When not authenticated: inline sign-in form with toggle to sign-up
  - Removed old protected `/(full)/connect/page.tsx`
  - 2025-09-01: Implemented Connect UI per mock
    - Heading: “What’s on your mind?”
    - Single-line input placeholder “Value”
    - Two outline icon buttons (Phone, Message)
    - Outline “Connect” button centered
  - 2025-09-01: Added session flow
    - On Connect: requires topic and selects voice to proceed
    - Navigates to `/connect/session?topic=...`
    - Session page shows two panels (peer and you), topic field read-only
- 2025-09-01: Added chat session & actions
  - Buttons: End Call (to /connect), Switch to Text (to /connect/session/chat), Report an Issue (to /contact)
  - Created `/connect/session/chat` with chat bubbles UI and composer
- 2025-10-13: Added tooltips to mode selection buttons on `/connect`
  - Introduced shadcn tooltip primitives for clearer voice vs chat affordances
  - Tooltips surface “Start a voice session” and “Start a chat session” guidance

### Auth Gating Refactor

- 2025-08-31: Centralized auth gating in `app/(root)/(auth-gate)/layout.tsx`
  - Layout checks session via `createSupabaseServerClient()`
  - Renders `AuthForms` when unauthenticated; renders children when authenticated
  - `/(root)/(auth-gate)/connect/page.tsx` simplified to static content
  - Benefit: single source of truth for gating, less duplication, easier future expansion

### SEO & Metadata
