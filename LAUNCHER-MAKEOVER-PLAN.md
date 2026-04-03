# Launcher Full Makeover — Implementation Plan

## Goal
Complete visual overhaul to match the RolePlayAI Website (`vrcentre-roleplayai-website.web.app`) look and feel:
- Same color palette, typography, component patterns
- Cinematic login screen (no more plain form)
- Native **Account** tab replacing the website iframe
- Full UI redesign: header, nav, cards, modals, DLC section, progress bars, dropdowns

**Core functionality is untouched** — downloads, installs, DLC management, Firestore listeners, build type switching, session server all stay as-is.

---

## Files to Edit

| File | What changes |
|------|-------------|
| `index.html` | Full `<style>` block replacement, login HTML, account-view HTML, nav tab rename |
| `renderer.js` | `showMfaPrompt()`, `showLauncher()`, `switchView()`, new `renderAccountView()`, `currentUserData` var |

---

## Website Design Tokens to Apply

### Colors (Dark Mode — website defaults dark)
```css
--bg: #0a0a0a;          /* page background */
--card: #111111;         /* card surfaces */
--border: #262626;       /* all borders */
--input: #1a1a1a;        /* input backgrounds */
--text: #f5f5f5;         /* primary text */
--text-muted: #64748b;   /* labels, secondary text */
--primary: #f5f5f5;      /* primary button bg */
--primary-fg: #171717;   /* primary button text */
--destructive: #ef4444;  /* errors, delete */
```

### Gradient Text (branding)
```css
background: linear-gradient(135deg, #f5f5f5, hsl(262 83% 70%));
-webkit-background-clip: text;
-webkit-text-fill-color: transparent;
```

### Glass Morphism
```css
background: rgba(10,10,10,0.8);
backdrop-filter: blur(12px);
border: 1px solid rgba(38,38,38,0.5);
```

### Radius
- Cards/modals: `border-radius: 0.75rem` (12px)
- Buttons/inputs: `border-radius: 0.5rem` (8px)
- Badges: `border-radius: 9999px`

---

## 1. `index.html` — Full `<style>` Block Replacement

Replace everything between `<style>` and `</style>` (currently lines 12–311) with:

```css
/* ── Design Tokens ──────────────────────────────── */
:root {
  --bg: #0a0a0a;
  --card: #111111;
  --border: #262626;
  --input: #1a1a1a;
  --text: #f5f5f5;
  --text-muted: #64748b;
  --primary: #f5f5f5;
  --primary-fg: #171717;
  --destructive: #ef4444;
  --radius: 0.5rem;
  --radius-xl: 0.75rem;
}

body { background: var(--bg); color: var(--text); font-family: 'Inter', system-ui, sans-serif; font-feature-settings: "rlig" 1, "calt" 1; }

/* ── Glass ──────────────────────────────────────── */
.glass { background: rgba(10,10,10,0.8); backdrop-filter: blur(12px); border: 1px solid rgba(38,38,38,0.5); }

/* ── Header ─────────────────────────────────────── */
.header-level1 { height: 60px; background: rgba(10,10,10,0.8); backdrop-filter: blur(16px); border-bottom: 1px solid var(--border); }
.header-level2 { height: 80px; background: rgba(10,10,10,0.6); backdrop-filter: blur(12px); border-bottom: 1px solid var(--border); }

/* ── Nav Tabs ────────────────────────────────────── */
.nav-tabs-wrapper { background: #1a1a1a; border-radius: var(--radius); padding: 4px; }
.nav-tab { padding: 6px 16px; border-radius: calc(var(--radius) - 2px); font-size: 0.8rem; font-weight: 500; color: var(--text-muted); transition: all 0.2s; }
.nav-tab:hover { color: var(--text); }
.nav-tab.active { background: var(--card); color: var(--text); box-shadow: 0 1px 6px rgba(0,0,0,0.4); }

/* ── Cards ───────────────────────────────────────── */
.app-card { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius-xl); transition: all 0.2s; }
.app-card:hover { transform: translateY(-2px); box-shadow: 0 8px 30px rgba(255,255,255,0.04); border-color: #333; }

/* ── Buttons ─────────────────────────────────────── */
.btn-primary { display: inline-flex; align-items: center; justify-content: center; background: var(--primary); color: var(--primary-fg); border-radius: var(--radius); font-size: 0.875rem; font-weight: 500; padding: 0 1rem; height: 2.5rem; transition: all 0.2s; border: none; cursor: pointer; }
.btn-primary:hover { opacity: 0.9; }
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }
.btn-outline { display: inline-flex; align-items: center; justify-content: center; background: transparent; color: var(--text); border: 1px solid var(--border); border-radius: var(--radius); font-size: 0.875rem; font-weight: 500; padding: 0 1rem; height: 2.5rem; transition: all 0.2s; cursor: pointer; }
.btn-outline:hover { background: #1a1a1a; }
.btn-glow { background: linear-gradient(135deg, #3b82f6, #1d4ed8); color: #fff; border: none; box-shadow: 0 0 16px rgba(59,130,246,0.3); }
.btn-glow:hover { box-shadow: 0 0 24px rgba(59,130,246,0.5); }

/* ── Inputs ──────────────────────────────────────── */
.form-input { display: block; background: var(--input); border: 1px solid var(--border); border-radius: var(--radius); color: var(--text); font-size: 0.875rem; padding: 0 0.75rem; height: 2.5rem; width: 100%; transition: border-color 0.2s; outline: none; font-family: inherit; }
.form-input:focus { border-color: #4b5563; box-shadow: 0 0 0 2px rgba(75,85,99,0.2); }
.form-input::placeholder { color: var(--text-muted); }

/* ── Badges ──────────────────────────────────────── */
.badge { display: inline-flex; align-items: center; gap: 4px; padding: 2px 10px; border-radius: 9999px; font-size: 0.72rem; font-weight: 600; }
.badge-success { background: rgba(34,197,94,0.1); color: #4ade80; }
.badge-error { background: rgba(239,68,68,0.1); color: #f87171; }
.badge-muted { background: rgba(100,116,139,0.15); color: #94a3b8; }

/* ── Gradient Text ───────────────────────────────── */
.gradient-text { background: linear-gradient(135deg, #f5f5f5, hsl(262 83% 70%)); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text; }

/* ── Login ───────────────────────────────────────── */
#login-view { background: url('assets/BG.jpg') center/cover no-repeat; position: relative; }
#login-view::before { content: ''; position: absolute; inset: 0; background: rgba(0,0,0,0.7); }
.login-card { position: relative; z-index: 1; background: rgba(10,10,10,0.75); backdrop-filter: blur(24px); border: 1px solid rgba(38,38,38,0.8); border-radius: 1rem; }
.otp-input { letter-spacing: 0.6em; font-size: 1.6rem; text-align: center; }

/* ── Account View ────────────────────────────────── */
.account-section-label { font-size: 0.68rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-muted); margin-bottom: 0.5rem; }
.account-card { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius-xl); padding: 1.25rem; }
.avatar-circle { width: 52px; height: 52px; border-radius: 50%; background: linear-gradient(135deg, #3b82f6, #1d4ed8); display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: 1rem; color: #fff; flex-shrink: 0; }
.entitlement-pill { display: inline-flex; align-items: center; gap: 6px; padding: 4px 12px; background: rgba(59,130,246,0.08); border: 1px solid rgba(59,130,246,0.18); border-radius: var(--radius); font-size: 0.78rem; color: #93c5fd; }

/* ── DLC Cards ───────────────────────────────────── */
.dlc-environment-card, .dlc-character-card { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius-xl); transition: all 0.2s; }
.dlc-environment-card:hover, .dlc-character-card:hover { border-color: #333; }
.dlc-dependency-warning { background: rgba(251,191,36,0.08); border: 1px solid rgba(251,191,36,0.2); border-radius: var(--radius); color: #fbbf24; }

/* ── Modals ──────────────────────────────────────── */
.modal-backdrop { background: rgba(0,0,0,0.7); backdrop-filter: blur(4px); }
.modal-panel { background: var(--card); border: 1px solid var(--border); border-radius: 1rem; box-shadow: 0 24px 64px rgba(0,0,0,0.6); }

/* ── Progress ────────────────────────────────────── */
.progress-bar-track { background: var(--border); border-radius: 9999px; height: 6px; }
.progress-bar-fill { background: linear-gradient(90deg, #3b82f6, #6366f1); border-radius: 9999px; height: 6px; transition: width 0.3s ease; }

/* ── Dropdown ────────────────────────────────────── */
.logo-dropdown { position: absolute; top: calc(100% + 8px); left: 0; z-index: 100; background: var(--card); border: 1px solid var(--border); border-radius: var(--radius-xl); box-shadow: 0 8px 30px rgba(0,0,0,0.5); min-width: 180px; padding: 4px; }
.dropdown-item { display: flex; align-items: center; gap: 8px; padding: 8px 10px; border-radius: var(--radius); font-size: 0.8rem; color: var(--text-muted); transition: all 0.15s; cursor: pointer; }
.dropdown-item:hover { background: #1a1a1a; color: var(--text); }
.dropdown-separator { height: 1px; background: var(--border); margin: 4px 0; }

/* ── Favorites Bar ───────────────────────────────── */
.app-favorite-icon { width: 52px; height: 52px; border-radius: var(--radius); object-fit: cover; transition: all 0.2s; border: 2px solid transparent; }
.game-logo-active { border-color: #3b82f6 !important; box-shadow: 0 0 12px rgba(59,130,246,0.35); }

/* ── Toast ───────────────────────────────────────── */
#toast-notification { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius-xl); box-shadow: 0 8px 30px rgba(0,0,0,0.5); color: var(--text); font-size: 0.85rem; }

/* ── Build Type Badge ────────────────────────────── */
.build-type-option { padding: 4px 10px; border-radius: var(--radius); font-size: 0.75rem; font-weight: 500; cursor: pointer; transition: all 0.2s; color: var(--text-muted); }
.build-type-option.active { background: var(--card); color: var(--text); box-shadow: 0 1px 4px rgba(0,0,0,0.4); }

/* ── Scrollbar ───────────────────────────────────── */
::-webkit-scrollbar { width: 6px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(100,116,139,0.3); border-radius: 9999px; }
::-webkit-scrollbar-thumb:hover { background: rgba(100,116,139,0.5); }

/* ── Animations ──────────────────────────────────── */
@keyframes fade-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
@keyframes slide-in { from { transform: translateX(-100%); } to { transform: translateX(0); } }
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes shimmer { 0% { background-position: -200% 0; } 100% { background-position: 200% 0; } }
.animate-fade-in { animation: fade-in 0.3s ease-out both; }
.hidden { display: none !important; }
```

---

## 2. `index.html` — Replace `#login-view` HTML

Find and replace the entire `<div id="login-view" ...>...</div>` block (currently lines ~317–357):

```html
<!-- Login View -->
<div id="login-view" class="hidden flex items-center justify-center h-screen w-screen">
  <div class="login-card w-full max-w-sm mx-6 p-8 animate-fade-in">

    <!-- Logo + Brand -->
    <div class="flex flex-col items-center mb-8">
      <img src="assets/icon-white.png" class="h-12 w-12 mb-4" alt="RolePlay AI">
      <h1 class="gradient-text text-2xl font-bold tracking-tight">Role-Play AI</h1>
      <p style="color:var(--text-muted);font-size:0.75rem;margin-top:4px;">by VR Centre</p>
    </div>

    <!-- Login Step -->
    <div id="login-step">
      <form id="electron-login-form" class="space-y-4">
        <div>
          <label style="display:block;font-size:0.75rem;font-weight:500;color:var(--text-muted);margin-bottom:6px;">Email</label>
          <input id="email" type="email" placeholder="you@example.com" class="form-input" required>
        </div>
        <div>
          <label style="display:block;font-size:0.75rem;font-weight:500;color:var(--text-muted);margin-bottom:6px;">Password</label>
          <input id="password" type="password" placeholder="••••••••••••" class="form-input" required>
        </div>
        <button id="login-button" type="submit" class="btn-primary w-full" style="width:100%;margin-top:8px;">Sign In</button>
        <p id="error-message" style="color:#f87171;font-size:0.75rem;text-align:center;min-height:1rem;margin-top:4px;"></p>
      </form>
    </div>

    <!-- MFA Step (hidden until MFA required) -->
    <div id="mfa-step" class="hidden">
      <div style="text-align:center;margin-bottom:20px;">
        <div style="width:48px;height:48px;margin:0 auto 12px;border-radius:50%;background:rgba(59,130,246,0.1);display:flex;align-items:center;justify-content:center;">
          <svg style="width:24px;height:24px;color:#60a5fa;stroke:#60a5fa;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/>
          </svg>
        </div>
        <h2 style="font-size:0.9rem;font-weight:600;margin-bottom:4px;">Two-Factor Authentication</h2>
        <p style="font-size:0.75rem;color:var(--text-muted);">Enter the 6-digit code from your authenticator app</p>
      </div>
      <input id="mfa-code-input" type="text" inputmode="numeric" maxlength="6"
        placeholder="000000" class="form-input otp-input" style="margin-bottom:12px;">
      <button id="mfa-submit-btn" class="btn-primary" style="width:100%;">Verify</button>
      <p id="mfa-error-message" style="color:#f87171;font-size:0.75rem;text-align:center;min-height:1rem;margin-top:6px;"></p>
      <button id="mfa-back-btn" style="display:block;width:100%;margin-top:8px;font-size:0.75rem;color:var(--text-muted);background:none;border:none;cursor:pointer;transition:color 0.2s;">← Back to login</button>
    </div>

  </div>
  <!-- Version label -->
  <div id="login-version" style="position:absolute;bottom:16px;font-size:0.7rem;color:var(--text-muted);opacity:0.5;"></div>
</div>
```

---

## 3. `index.html` — Replace `#dashboard-view` with `#account-view`

Find:
```html
<div id="dashboard-view" class="hidden h-full w-full bg-gray-900">
    <iframe id="dashboard-iframe" src="https://vrcentre-roleplayai-website.web.app"
        class="w-full h-full border-0" allow="clipboard-read; clipboard-write"></iframe>
</div>
```

Replace with:
```html
<!-- Account View (native — replaces iframe dashboard) -->
<div id="account-view" class="hidden h-full w-full overflow-y-auto p-6">
    <!-- Populated dynamically by renderAccountView() in renderer.js -->
</div>
```

---

## 4. `index.html` — Update Nav Tab

Find the nav tab with `data-view="dashboard"` (or label `DASHBOARD`) and change:
- `data-view="dashboard"` → `data-view="account"`
- Label text `DASHBOARD` → `ACCOUNT`

---

## 5. `renderer.js` — Add `currentUserData` Variable

Near the top of the file (after other `let` declarations), add:
```js
let currentUserData = null; // stores userData post-login for account view access
```

---

## 6. `renderer.js` — Update `showLauncher(userData)`

Add `currentUserData = userData` and unauthenticated redirect:
```js
function showLauncher(userData) {
    currentUserData = userData;

    if (!userData) {
        // No authenticated user — go to login (no guest access)
        showLogin();
        return;
    }

    usernameDisplay.textContent = userData.displayName || userData.username || 'PlayerOne';
    userInfo.classList.remove('hidden');
    userInfo.classList.add('flex');
    guestInfo.classList.add('hidden');

    loginView.classList.add('hidden');
    launcherVIew.classList.remove('hidden');

    if (!launcherInitialized) {
        initLauncher();
        launcherInitialized = true;
    }
}
```

---

## 7. `renderer.js` — Replace `showMfaPrompt()`

Replace the existing function with:
```js
function showMfaPrompt() {
    document.getElementById('login-step').classList.add('hidden');
    const mfaStep = document.getElementById('mfa-step');
    mfaStep.classList.remove('hidden');

    const mfaInput = document.getElementById('mfa-code-input');
    const mfaBtn = document.getElementById('mfa-submit-btn');
    const mfaError = document.getElementById('mfa-error-message');
    const mfaBack = document.getElementById('mfa-back-btn');

    mfaInput.value = '';
    mfaError.textContent = '';
    mfaInput.focus();

    // Back to login
    mfaBack.onclick = () => {
        pendingMfaResolver = null;
        mfaStep.classList.add('hidden');
        document.getElementById('login-step').classList.remove('hidden');
        mfaInput.value = '';
        mfaError.textContent = '';
    };

    async function submitMfa() {
        const code = mfaInput.value.trim();
        if (code.length !== 6) return;
        mfaBtn.disabled = true;
        mfaBtn.textContent = 'Verifying...';
        try {
            const assertion = TotpMultiFactorGenerator.assertionForSignIn(
                pendingMfaResolver.hints[0].uid, code
            );
            await pendingMfaResolver.resolveSignIn(assertion);
            pendingMfaResolver = null;
        } catch (err) {
            mfaBtn.disabled = false;
            mfaBtn.textContent = 'Verify';
            mfaInput.value = '';
            mfaInput.focus();
            mfaError.textContent = err.code === 'auth/invalid-verification-code'
                ? 'Invalid code. Please try again.'
                : 'Verification failed. Please try again.';
        }
    }

    mfaBtn.onclick = submitMfa;
    mfaInput.onkeydown = (e) => { if (e.key === 'Enter') submitMfa(); };
}
```

---

## 8. `renderer.js` — Update `switchView()` for `account`

Find the section in `switchView()` that handles `'dashboard'` and rename:
```js
// OLD:
case 'dashboard':
    document.getElementById('dashboard-view').classList.remove('hidden');
    break;

// NEW:
case 'account':
    document.getElementById('account-view').classList.remove('hidden');
    renderAccountView(currentUserData);
    break;
```

Also update any references to `'dashboard'` in the nav tab click handlers.

---

## 9. `renderer.js` — Add `renderAccountView()` Function

Add this function near the other render functions (around line 616):

```js
function renderAccountView(userData) {
    const container = document.getElementById('account-view');
    if (!container) return;

    if (!userData) {
        container.innerHTML = `<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-muted);font-size:0.875rem;">Sign in to view your account</div>`;
        return;
    }

    const license = userData.licenseData;

    const initials = (userData.displayName || userData.email || 'U')
        .split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

    const formatDate = (val) => {
        if (!val) return '—';
        try {
            const d = val.toDate ? val.toDate() : new Date(val);
            return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
        } catch { return '—'; }
    };

    const pillList = (arr) => (arr && arr.length)
        ? arr.map(e => `<span class="entitlement-pill">● ${e}</span>`).join('')
        : `<span style="font-size:0.75rem;color:var(--text-muted);">None allocated</span>`;

    container.innerHTML = `
    <div style="max-width:640px;margin:0 auto;" class="animate-fade-in">

      <p class="account-section-label" style="margin-bottom:12px;">Profile</p>
      <div class="account-card" style="display:flex;align-items:center;gap:16px;margin-bottom:24px;">
        <div class="avatar-circle">${initials}</div>
        <div style="flex:1;min-width:0;">
          <p style="font-weight:600;font-size:0.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${userData.displayName || '—'}</p>
          <p style="font-size:0.75rem;color:var(--text-muted);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${userData.email || '—'}</p>
          ${userData.organizationId ? `<p style="font-size:0.72rem;color:var(--text-muted);margin-top:2px;">Org: <span style="color:var(--text);">${userData.organizationId}</span></p>` : ''}
        </div>
        <button id="account-signout-btn" class="btn-outline" style="height:32px;padding:0 12px;font-size:0.75rem;flex-shrink:0;">Sign Out</button>
      </div>

      <p class="account-section-label" style="margin-bottom:12px;">License</p>
      ${license ? `
      <div class="account-card" style="margin-bottom:24px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
          <span style="font-size:0.75rem;color:var(--text-muted);">Status</span>
          <span class="badge ${license.isActive !== false ? 'badge-success' : 'badge-error'}">${license.isActive !== false ? '● Active' : '● Inactive'}</span>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
          <span style="font-size:0.75rem;color:var(--text-muted);">License ID</span>
          <span style="font-size:0.75rem;font-family:monospace;color:var(--text);">${userData.allocatedLicenseId || '—'}</span>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;">
          <span style="font-size:0.75rem;color:var(--text-muted);">Valid from</span>
          <span style="font-size:0.75rem;color:var(--text);">${formatDate(license.startDate)}</span>
        </div>
        <div style="display:flex;align-items:center;justify-content:space-between;">
          <span style="font-size:0.75rem;color:var(--text-muted);">Valid until</span>
          <span style="font-size:0.75rem;color:var(--text);">${formatDate(license.endDate)}</span>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:24px;">
        <div>
          <p class="account-section-label">Environments</p>
          <div style="display:flex;flex-wrap:wrap;gap:6px;">${pillList(license.environments)}</div>
        </div>
        <div>
          <p class="account-section-label">Characters</p>
          <div style="display:flex;flex-wrap:wrap;gap:6px;">${pillList(license.characters)}</div>
        </div>
      </div>

      <div>
        <p class="account-section-label">DLC Access</p>
        <div style="display:flex;flex-wrap:wrap;gap:6px;">${pillList(license.dlcAccess)}</div>
      </div>
      ` : `
      <div class="account-card" style="margin-bottom:24px;">
        <p style="font-size:0.8rem;color:var(--text-muted);">No license is allocated to this account. Contact your organisation administrator.</p>
      </div>`}

    </div>`;

    document.getElementById('account-signout-btn')?.addEventListener('click', () => signOut(auth));
}
```

---

## 10. `renderer.js` — Login Version Label

After the existing auth listeners (near the `showLoginButton.addEventListener` block), add:
```js
// Set version on login screen
window.electronAPI.getAppVersion().then(v => {
    const el = document.getElementById('login-version');
    if (el) el.textContent = `v${v} · VR Centre Pty Ltd`;
}).catch(() => {});
```

---

## Verification

Run `npm start` from the launcher directory and confirm:

| Check | Expected |
|-------|----------|
| Launch | Cinematic login screen (BG.jpg background, dark overlay, glassmorphism card) |
| Logo | Icon + "Role-Play AI" gradient text + "by VR Centre" subtitle |
| Login | Clean form-input styled fields, white "Sign In" button |
| MFA | Slide to dedicated MFA panel (not injected into error text) with back link |
| Post-login | Launcher UI with website-matched colors (dark #0a0a0a bg, #262626 borders) |
| Header | Glass header with subtle border-bottom |
| Nav tabs | Pill-style tabs in #1a1a1a wrapper, active tab has card bg + shadow |
| App cards | Dark card (#111111), subtle border, hover lifts 2px |
| ACCOUNT tab | Native profile, license status badge, environment/character/DLC pills |
| Sign Out | Signs out → returns to login (no guest launcher access) |
| Session server | `curl http://localhost:45678/session` returns authenticated JSON |
| Downloads/DLC | All existing functionality works unchanged |

---

## Notes for Implementation

- The `#login-view` originally had `class="hidden"` as part of its class list — keep this so it starts hidden until `showLogin()` is called
- The `showLauncher(null)` change (redirecting to login) means unauthenticated users can no longer browse the launcher. If you want to allow guest browsing of the app library, revert that change and restore the `guestInfo` panel
- The `#dashboard-view` iframe is removed entirely — if you ever need to link to the website, add an external link button in the Account view that calls `window.electronAPI.openExternal('https://vrcentre-roleplayai-website.web.app')`
- All Tailwind CDN classes still work — we're adding CSS variables on top, not removing Tailwind
- The `node_modules/electron/index.js` patch (for running via `npm start`) must remain in place — don't `npm install electron` without re-applying the patch, as it will be overwritten
