#!/usr/bin/env node
/**
 * Pipeline Generator
 * Reads base-setup.json + project-setup.json and generates
 * .github/workflows/deploy-{stage}.yml for each enabled stage.
 *
 * Usage: node scripts/generate-pipeline.js
 */

const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');

// ─── Load & merge configs ─────────────────────────────────────────────────────

function deepMerge(base, override) {
  const result = { ...base };
  for (const key of Object.keys(override ?? {})) {
    const val = override[key];
    if (val && typeof val === 'object' && !Array.isArray(val)) {
      result[key] = deepMerge(base[key] ?? {}, val);
    } else {
      result[key] = val;
    }
  }
  return result;
}

const base    = JSON.parse(fs.readFileSync(path.join(ROOT, 'base-setup.json'),    'utf8'));
const project = JSON.parse(fs.readFileSync(path.join(ROOT, 'project-setup.json'), 'utf8'));

// Merge: base ← project (project wins), then apply overrides block
let cfg = deepMerge(base, project);
if (project.overrides) {
  cfg = deepMerge(cfg, project.overrides);
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const pm        = cfg.runtime?.packageManager ?? 'npm';
const nodeVer   = (cfg.runtime?.node ?? '20').replace('-lts', '');
const quality   = cfg.qualityDefaults ?? {};
const templates = cfg.stageTemplates  ?? {};

const install = pm === 'pnpm' ? 'pnpm install --frozen-lockfile' : 'npm ci';
const run     = pm === 'pnpm' ? 'pnpm'                           : 'npm run';

function pnpmSetupBlock() {
  if (pm !== 'pnpm') return '';
  return `
      - uses: pnpm/action-setup@v6
        with:
          version: 9
`;
}

function triggerBlock(stage) {
  const tpl          = templates[stage] ?? {};
  const trigger      = tpl.trigger ?? {};
  const stageTrigger = project.stages?.[stage]?.trigger ?? {};
  const branch       = stageTrigger.branch ?? trigger.branch ?? 'main';

  const ignorePaths  = project.ci?.pathsIgnore ?? ['**.md', '.gitignore'];
  const pathsIgnoreBlock = ignorePaths.length
    ? `\n    paths-ignore:\n${ignorePaths.map(p => `      - '${p}'`).join('\n')}`
    : '';

  if (trigger.type === 'auto') {
    return `on:\n  push:\n    branches: [${branch}]${pathsIgnoreBlock}`;
  }
  if (trigger.requireReleaseTag) {
    return `on:\n  push:\n    tags: ['v*']`;
  }
  return `on:\n  workflow_dispatch:`;
}

function cacheBlock() {
  const lockFile = pm === 'pnpm' ? 'pnpm-lock.yaml' : 'package-lock.json';
  return `
      - name: Cache node_modules
        id: cache-deps
        uses: actions/cache@v4
        with:
          path: |
            backend/node_modules
            frontend/node_modules
          key: \${{ runner.os }}-node_modules-\${{ hashFiles('**/${lockFile}') }}
`;
}

function ciSteps() {
  const steps = [];

  if (quality.lint?.enabled) {
    steps.push(`      - name: Lint backend
        working-directory: backend
        run: ${run} lint

      - name: Lint frontend
        working-directory: frontend
        run: ${run} lint`);
  }

  if (quality.typecheck?.enabled) {
    steps.push(`      - name: Typecheck backend
        working-directory: backend
        run: ${run} typecheck

      - name: Typecheck frontend
        working-directory: frontend
        run: ${run} typecheck`);
  }

  if (quality.unitTests?.enabled) {
    steps.push(`      - name: Test backend
        working-directory: backend
        run: ${run} test

      - name: Test frontend
        working-directory: frontend
        run: ${run} test`);
  }

  return steps.join('\n\n');
}

function deployJob(stage) {
  const pfx           = stage.toUpperCase();
  const stageCfg      = project.stages?.[stage]  ?? {};
  const h             = stageCfg.hosting          ?? {};
  const type          = h.type                    ?? 'hetzner-ssh';
  const hostSecret    = h.host                    ?? `${pfx}_SERVER_HOST`;
  const userSecret    = h.user                    ?? `${pfx}_SERVER_USER`;
  const keySecret     = h.privateKey              ?? `${pfx}_SSH_PRIVATE_KEY`;
  const fePath        = h.frontendPath            ?? '~/app/frontend';
  const bePath        = h.backendPath             ?? '~/app/backend';
  const serverInstall = pm === 'pnpm' ? 'pnpm install --prod' : 'npm ci --omit=dev';

  const environment = project.stages?.[stage]?.environment ?? '';
  const envLine = environment ? `\n    environment: ${environment}` : '';

  if (type === 'hetzner-ssh') {
    return `
  deploy:
    needs: build
    runs-on: ubuntu-latest${envLine}
    steps:
      - uses: actions/download-artifact@v4
        with:
          name: frontend-dist
          path: artifacts/frontend

      - uses: actions/download-artifact@v4
        with:
          name: backend-build
          path: artifacts/backend

      - name: Deploy frontend
        uses: appleboy/scp-action@v0.1.7
        with:
          host: \${{ secrets.${hostSecret} }}
          username: \${{ secrets.${userSecret} }}
          key: \${{ secrets.${keySecret} }}
          port: 22
          source: "artifacts/frontend/*"
          target: "${fePath}"
          strip_components: 2

      - name: Deploy backend
        uses: appleboy/scp-action@v0.1.7
        with:
          host: \${{ secrets.${hostSecret} }}
          username: \${{ secrets.${userSecret} }}
          key: \${{ secrets.${keySecret} }}
          port: 22
          source: "artifacts/backend/"
          target: "${bePath}"
          strip_components: 2

      - name: Install deps and restart backend
        uses: appleboy/ssh-action@v1.0.3
        with:
          host: \${{ secrets.${hostSecret} }}
          username: \${{ secrets.${userSecret} }}
          key: \${{ secrets.${keySecret} }}
          port: 22
          envs: SUPABASE_URL,SUPABASE_SERVICE_ROLE_KEY,PORT
          script: |
            set -e
            export NVM_DIR="$HOME/.nvm"
            [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
            mkdir -p ${bePath}
            cd ${bePath}
            ${serverInstall}
            printf "SUPABASE_URL=%s\\nSUPABASE_SERVICE_ROLE_KEY=%s\\nPORT=%s\\n" \\
              "$SUPABASE_URL" "$SUPABASE_SERVICE_ROLE_KEY" "$PORT" > .env
            pm2 restart backend || pm2 start dist/index.js --name backend
        env:
          SUPABASE_URL: \${{ secrets.${pfx}_SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: \${{ secrets.${pfx}_SUPABASE_SERVICE_ROLE_KEY }}
          PORT: \${{ secrets.${pfx}_PORT }}`;
  }

  if (type === 'vercel') {
    const tokenSecret = h.token ?? 'VERCEL_TOKEN';
    return `
  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
${pnpmSetupBlock()}
      - uses: actions/setup-node@v4
        with:
          node-version: ${nodeVer}

      - name: Deploy to Vercel
        run: npx vercel --prod --token \${{ secrets.${tokenSecret} }}`;
  }

  throw new Error(`Unknown hosting type: "${type}". Add it to generate-pipeline.js`);
}

function dockerJob(stage) {
  const docker = project.docker ?? {};
  if (!docker.enabled) return '';

  const pfx       = stage.toUpperCase();
  const registry  = cfg.dockerDefaults?.registry ?? {};
  const imageName = docker.image ?? project.project?.name ?? 'app';
  const regUrl    = registry.url ?? 'ghcr.io/factory42';
  const authSecret = registry.authSecret ?? 'GHCR_TOKEN';

  return `
  docker:
    needs: ci
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Log in to GitHub Container Registry
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: \${{ github.actor }}
          password: \${{ secrets.${authSecret} }}

      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: |
            ${regUrl}/${imageName}:\${{ github.sha }}
            ${regUrl}/${imageName}:${stage}`;
}

function slackStep(stage) {
  const slack = project.notifications?.slack;
  if (!slack) return '';
  const pfx = stage.toUpperCase();
  return `
      - name: Notify Slack
        if: always()
        uses: slackapi/slack-github-action@v1.26.0
        with:
          channel-id: "${slack.channel}"
          slack-message: |
            $\{{ job.status == 'success' && '✅' || '❌' }} *${project.project.name}* deploy $\{{ job.status }}
            <$\{{ github.server_url }}/$\{{ github.repository }}/actions/runs/$\{{ github.run_id }}|View run>
        env:
          SLACK_BOT_TOKEN: \${{ secrets.${pfx}_${slack.webhookSecret} }}`;
}

// ─── Workflow template ────────────────────────────────────────────────────────

function generateWorkflow(stage) {
  const stageName = stage.charAt(0).toUpperCase() + stage.slice(1);
  const lockFile  = pm === 'pnpm' ? 'pnpm-lock.yaml' : 'package-lock.json';

  return `# AUTO-GENERATED — do not edit manually.
# Source: base-setup.json + project-setup.json
# Regenerate: node scripts/generate-pipeline.js

name: Deploy ${stageName}

${triggerBlock(stage)}

env:
  FORCE_JAVASCRIPT_ACTIONS_TO_NODE24: true

jobs:
  ci:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
${pnpmSetupBlock()}
      - uses: actions/setup-node@v4
        with:
          node-version: ${nodeVer}
${cacheBlock()}
      - name: Install backend
        if: steps.cache-deps.outputs.cache-hit != 'true'
        working-directory: backend
        run: ${install}

      - name: Install frontend
        if: steps.cache-deps.outputs.cache-hit != 'true'
        working-directory: frontend
        run: ${install}

${ciSteps()}

  build:
    needs: ci
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
${pnpmSetupBlock()}
      - uses: actions/setup-node@v4
        with:
          node-version: ${nodeVer}
${cacheBlock()}
      - name: Build backend
        working-directory: backend
        run: ${install} && ${run} build

      - name: Build frontend
        working-directory: frontend
        env:
          VITE_API_URL: \${{ secrets.${stageName.toUpperCase()}_VITE_API_URL }}
        run: ${install} && ${run} build

      - name: Prepare artifacts
        run: |
          mkdir -p artifacts/frontend artifacts/backend
          cp -r frontend/dist/. artifacts/frontend/
          cp -r backend/dist     artifacts/backend/dist
          cp backend/package.json backend/${lockFile} artifacts/backend/

      - uses: actions/upload-artifact@v4
        with:
          name: frontend-dist
          path: artifacts/frontend/

      - uses: actions/upload-artifact@v4
        with:
          name: backend-build
          path: artifacts/backend/
${deployJob(stage)}
${dockerJob(stage)}
${slackStep(stage)}
`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const outDir = path.join(ROOT, '.github', 'workflows');
fs.mkdirSync(outDir, { recursive: true });

const stages = project.stages ?? {};
let generated = 0;

for (const [stage, stageCfg] of Object.entries(stages)) {
  if (!stageCfg.enabled) {
    console.log(`  skip  deploy-${stage}.yml  (disabled)`);
    continue;
  }
  const yaml    = generateWorkflow(stage);
  const outFile = path.join(outDir, `deploy-${stage}.yml`);
  fs.writeFileSync(outFile, yaml, 'utf8');
  console.log(`  ✓     deploy-${stage}.yml`);
  generated++;
}

if (generated === 0) {
  console.log('No stages enabled — nothing generated.');
} else {
  console.log(`\nDone. ${generated} workflow(s) written to .github/workflows/`);
  console.log('Review: git diff .github/workflows/');
}
