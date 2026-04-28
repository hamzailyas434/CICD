# CI/CD Pipeline Guide
**Factory42 · Hinglish Edition**

---

## Overview — Ye System Kaise Kaam Karta Hai

```
base-setup.json        →  Org-wide defaults (ek baar likho, sab use karo)
project-setup.json     →  Project-specific config (har project alag)
         ↓
node scripts/generate-pipeline.js
         ↓
.github/workflows/deploy-dev.yml     ✓  (auto-generated)
.github/workflows/deploy-staging.yml ✓  (agar enabled ho)
.github/workflows/deploy-prod.yml    ✓  (agar enabled ho)
```

**Main idea:** Tujhe kabhi bhi `.github/workflows/*.yml` manually nahi likhna.
Sirf JSON update karo, script run karo — workflow ready.

---

## base-setup.json — Ek Baar, Sab Projects Ke Liye

Ye file **Factory42 platform team** maintain karta hai.
Har project is file ko inherit karta hai — isme woh sab defaults hain jo **organization-wide** apply hote hain.

### Kya kya define hota hai isme?

```json
{
  "runtime": {
    "node": "20-lts",           // Node.js version — sab projects pe same
    "packageManager": "pnpm",   // pnpm use karo, npm nahi
    "typescript": "mandatory"   // TypeScript compulsory hai
  }
}
```

```json
{
  "qualityDefaults": {
    "lint":      { "enabled": true, "failOnWarning": true },  // warning pe bhi fail karo
    "typecheck": { "enabled": true },                         // tsc --noEmit
    "unitTests": { "enabled": true, "coverageThreshold": 80 } // 80% coverage minimum
  }
}
```

```json
{
  "stageTemplates": {
    "dev":     { "trigger": { "type": "auto",   "branch": "main" } }, // main pe push → auto deploy
    "staging": { "trigger": { "type": "manual" } },                    // manually trigger karo
    "prod":    { "trigger": { "type": "manual", "requireReleaseTag": true } } // v1.0.0 tag chahiye
  }
}
```

```json
{
  "databaseDefaults": {
    "provider": "supabase",
    "region":   "eu-central-1",   // GDPR — Europe mein data
    "rlsRequired": true           // Row Level Security compulsory
  }
}
```

```json
{
  "secretsDefaults": {
    "required": [
      "SUPABASE_URL",
      "SUPABASE_ANON_KEY",
      "SUPABASE_SERVICE_ROLE_KEY",
      "NEXTAUTH_SECRET"
    ]
  }
}
```

### Rule: base-setup.json kabhi project-specific cheez mat likho.

---

## project-setup.json — Har Project Ka Apna Config

Ye file **developer likhta hai** — sirf woh cheezein jo is project ke liye alag hain.
Baaki sab `base-setup.json` se automatically aata hai.

### Structure:

```json
{
  "extends": "./base-setup.json",   // ZAROORI — base ko inherit karo

  "project": {
    "name": "customer-portal",      // project ka naam
    "type": "external",             // external = customer-facing, internal = team-only
    "criticality": "high"           // high / medium / low
  },

  "repository": {
    "name": "customer-portal"       // GitHub repo ka naam
  },

  "framework": "react-vite",        // react-vite / nextjs / nestjs

  "stages": { ... },                // kaun se stages enabled hain

  "hosting": { ... },               // kahan deploy hoga

  "notifications": { ... },         // Slack channel

  "overrides": { ... }              // base ke defaults ko override karo
}
```

---

## Stages — Kaun Se Environments Enable Karo

```json
{
  "stages": {
    "dev": {
      "enabled": true,                          // ✅ ye deploy hoga
      "supabase": { "projectRef": "dev-xyz" }   // dev ka Supabase project ID
    },
    "staging": {
      "enabled": false                          // ❌ skip — workflow generate nahi hoga
    },
    "prod": {
      "enabled": false                          // ❌ skip
    }
  }
}
```

**Script ka logic:**
```
dev.enabled = true   →  deploy-dev.yml     GENERATE ✓
staging.enabled = false → deploy-staging.yml  SKIP
prod.enabled = false    → deploy-prod.yml     SKIP
```

### Future mein staging add karna ho to:

```json
"staging": {
  "enabled": true,
  "supabase": { "projectRef": "stg-xyz" }
}
```

Script dobara run karo → `deploy-staging.yml` automatically ban jayega.

---

## Hosting — Kahan Deploy Hoga

Hosting config **stage ke andar** hoti hai — har stage ka apna alag server/path.

### Option 1: Hetzner SSH (abhi use ho raha hai)

```json
{
  "stages": {
    "dev": {
      "enabled": true,
      "hosting": {
        "type":         "hetzner-ssh",
        "host":         "DEV_SERVER_HOST",      // GitHub Secret ka naam
        "user":         "DEV_SERVER_USER",
        "privateKey":   "DEV_SSH_PRIVATE_KEY",
        "frontendPath": "~/test/www/html/static", // server pe frontend kahan jaaye
        "backendPath":  "~/apps/backend"          // server pe backend kahan jaaye
      }
    },
    "staging": {
      "enabled": true,
      "hosting": {
        "type":         "hetzner-ssh",
        "host":         "STG_SERVER_HOST",      // staging ke alag secrets
        "user":         "STG_SERVER_USER",
        "privateKey":   "STG_SSH_PRIVATE_KEY",
        "frontendPath": "~/staging/www/html/static",
        "backendPath":  "~/staging/apps/backend"
      }
    }
  }
}
```

### Option 2: Vercel (future mein)

```json
{
  "stages": {
    "dev": {
      "enabled": true,
      "hosting": {
        "type":  "vercel",
        "token": "VERCEL_TOKEN_DEV"
      }
    }
  }
}
```

Script automatically Vercel wala deploy step generate kar dega — SSH wala nahi.

---

## Folder Names Change Karna

Agar frontend ya backend ka folder name alag ho to — **sirf 2 jagah change karo:**

### 1. project-setup.json mein hosting paths update karo:

```json
"stages": {
  "dev": {
    "hosting": {
      "frontendPath": "~/myapp/public",   // server pe naya path
      "backendPath":  "~/myapp/server"
    }
  }
}
```

### 2. scripts/generate-pipeline.js mein folder names update karo:

```javascript
// Line ~100 — build job mein ye section dhundo:

- name: Prepare artifacts
  run: |
    mkdir -p artifacts/frontend artifacts/backend
    cp -r frontend/dist/.  artifacts/frontend/    // ← "frontend" folder ka naam
    cp -r backend/dist     artifacts/backend/dist  // ← "backend" folder ka naam
    cp backend/package.json backend/pnpm-lock.yaml artifacts/backend/
```

Agar folders ka naam `web` aur `api` ho:

```javascript
cp -r web/dist/.  artifacts/frontend/
cp -r api/dist    artifacts/backend/dist
cp api/package.json api/pnpm-lock.yaml artifacts/backend/
```

Script dobara run karo → updated `deploy-dev.yml` ban jayega.

---

## Overrides — Base Defaults Ko Override Karna

Base mein coverage threshold 80% hai. Customer portal ke liye 98% chahiye:

```json
{
  "overrides": {
    "quality": {
      "unitTests": { "coverageThreshold": 98 }  // 80 → 98
    },
    "observability": {
      "uptime": { "probeIntervalSeconds": 30 }   // 60s → 30s (zyada check karo)
    }
  }
}
```

---

## Naya Project Add Karna — Complete Example

### Scenario: `sendhero42` project banana hai

**Step 1:** Naya repo banao, `base-setup.json` copy karo (ya shared repo se link karo)

**Step 2:** `project-setup.json` likho (sirf jo alag hai):

```json
{
  "extends": "./base-setup.json",

  "project": {
    "name": "sendhero42",
    "type": "internal",
    "criticality": "medium",
    "owner": "team@factory42.com"
  },

  "repository": {
    "name": "sendhero42"
  },

  "framework": "react-vite",

  "stages": {
    "dev":     { "enabled": true,  "supabase": { "projectRef": "sh42-dev" } },
    "staging": { "enabled": false },
    "prod":    { "enabled": false }
  },

  "hosting": {
    "type": "hetzner-ssh",
    "secrets": {
      "dev": {
        "host":       "DEV_SERVER_HOST",
        "user":       "DEV_SERVER_USER",
        "privateKey": "DEV_SSH_PRIVATE_KEY"
      }
    },
    "paths": {
      "dev": {
        "frontend": "~/sendhero/www",
        "backend":  "~/sendhero/api"
      }
    }
  },

  "notifications": {
    "slack": {
      "webhookSecret": "SLACK_DEPLOY_WEBHOOK",
      "channel": "#deploys-sendhero42"
    }
  }
}
```

**Step 3:** Script run karo:

```bash
node scripts/generate-pipeline.js
```

**Output:**
```
✓  deploy-dev.yml
skip  deploy-staging.yml  (disabled)
skip  deploy-prod.yml     (disabled)
```

**Step 4:** GitHub Secrets add karo aur push karo — done.

---

## Script Kya Karta Hai — Andar Se

```
scripts/generate-pipeline.js
          ↓
Step 1:  base-setup.json  load karo
Step 2:  project-setup.json  load karo
Step 3:  deepMerge() — project base ko override karta hai
Step 4:  overrides block apply karo
Step 5:  project.stages loop karo
          ├── enabled: false → SKIP
          └── enabled: true  → generateWorkflow(stage) call karo
                    ↓
              runtime.packageManager  →  pnpm ya npm commands decide
              qualityDefaults.lint    →  lint step add karo ya nahi
              qualityDefaults.typecheck → typecheck step add karo ya nahi
              stageTemplates[stage]   →  trigger: auto ya manual
              hosting.type            →  hetzner-ssh ya vercel deploy steps
              notifications.slack     →  slack step add karo ya nahi
                    ↓
              YAML string generate karo
              .github/workflows/deploy-{stage}.yml mein likho
```

---

## Generated YML Ko Samjho

```yaml
# ── CI Job ────────────────────────────────────────────
# qualityDefaults se aata hai: lint + typecheck + test
jobs:
  ci:
    steps:
      - run: pnpm lint       # qualityDefaults.lint.enabled: true
      - run: pnpm typecheck  # qualityDefaults.typecheck.enabled: true
      - run: pnpm test       # qualityDefaults.unitTests.enabled: true

# ── Build Job ─────────────────────────────────────────
# framework aur packageManager se aata hai
  build:
    steps:
      - run: pnpm install --frozen-lockfile && pnpm build  # pnpm kyunke base mein pnpm hai

# ── Deploy Job ────────────────────────────────────────
# hosting.type = "hetzner-ssh" se aata hai
  deploy:
    steps:
      - appleboy/scp-action   # frontend → server pe copy
      - appleboy/scp-action   # backend  → server pe copy
      - appleboy/ssh-action   # npm install + pm2 restart

# ── Slack Notification ────────────────────────────────
# notifications.slack se aata hai
      - slackapi/slack-github-action  # #deploys-customer-portal pe message
```

---

## Quick Reference

| JSON Field | Generated YML Pe Asar |
|---|---|
| `runtime.packageManager: "pnpm"` | `pnpm install`, `pnpm lint`, `pnpm build` |
| `runtime.node: "20-lts"` | `node-version: 20` |
| `qualityDefaults.lint.enabled: true` | Lint steps add hote hain |
| `qualityDefaults.typecheck.enabled: true` | Typecheck steps add hote hain |
| `stageTemplates.dev.trigger.branch: "main"` | `on: push: branches: [main]` |
| `hosting.type: "hetzner-ssh"` | SCP + SSH deploy steps |
| `hosting.type: "vercel"` | Vercel CLI deploy step |
| `stages.dev.enabled: false` | `deploy-dev.yml` generate nahi hoga |
| `notifications.slack.channel: "#deploys-x"` | Slack notification step add hota hai |

---

## Agar Kuch Change Karna Ho — Cheat Sheet

| Kya Change Karna Hai | Kahan Change Karo |
|---|---|
| Server host / user / key | `project-setup.json` → `hosting.secrets.dev` |
| Frontend/backend server path | `project-setup.json` → `hosting.paths.dev` |
| Staging enable karna | `project-setup.json` → `stages.staging.enabled: true` |
| Naya project banana | Naya `project-setup.json` likho |
| Node version change | `base-setup.json` → `runtime.node` |
| Coverage threshold | `project-setup.json` → `overrides.quality.unitTests.coverageThreshold` |
| Slack channel | `project-setup.json` → `notifications.slack.channel` |

**Har change ke baad:**
```bash
node scripts/generate-pipeline.js
```
