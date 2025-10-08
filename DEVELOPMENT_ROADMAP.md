## Development Roadmap

### Identity Verification

- 2025-09-18: Integrated Stripe Identity verification flow

  - Added secure environment handling for Stripe secrets and Supabase service role in `lib/env/server.ts`
  - Created Stripe Identity service helper at `lib/stripe/identity.ts` and Supabase service client at `lib/supabase/service.ts`
  - Implemented API endpoints for starting, retrying, and receiving Stripe Identity webhooks under `app/api/identity/*`
  - Built `/verify` experience with session polling, status messaging, and retry handling; wired age verification page CTA
  - Updated auth-gate layout and Connect session page to enforce verification status and react to webhook-driven changes
  - Added reusable Stripe Identity flow support via `STRIPE_IDENTITY_FLOW_ID` env with provided email details for consistent configuration
  - Persist Stripe-sourced date of birth to `profiles.date_of_birth` upon successful verification for future age gating

### WebRTC Voice Implementation

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

### Auth Gating Refactor

- 2025-08-31: Centralized auth gating in `app/(root)/(auth-gate)/layout.tsx`
  - Layout checks session via `createSupabaseServerClient()`
  - Renders `AuthForms` when unauthenticated; renders children when authenticated
  - `/(root)/(auth-gate)/connect/page.tsx` simplified to static content
  - Benefit: single source of truth for gating, less duplication, easier future expansion

### SEO & Metadata
