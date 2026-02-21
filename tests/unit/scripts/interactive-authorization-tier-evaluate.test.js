const fs = require('fs-extra');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

describe('interactive-authorization-tier-evaluate script', () => {
  let tempDir;
  let projectRoot;
  let scriptPath;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'sce-interactive-auth-tier-'));
    projectRoot = path.resolve(__dirname, '..', '..', '..');
    scriptPath = path.join(projectRoot, 'scripts', 'interactive-authorization-tier-evaluate.js');
  });

  afterEach(async () => {
    if (tempDir) {
      await fs.remove(tempDir);
    }
  });

  function runScript(workspace, args) {
    return spawnSync(process.execPath, [scriptPath, ...args], {
      cwd: workspace,
      encoding: 'utf8'
    });
  }

  async function writePolicy(workspace) {
    const policyPath = path.join(workspace, 'authorization-tier-policy.json');
    await fs.writeJson(policyPath, {
      version: '1.0.0',
      defaults: {
        profile: 'business-user'
      },
      profiles: {
        'business-user': {
          allow_execution_modes: ['suggestion'],
          auto_execute_allowed: false,
          allow_live_apply: false
        },
        'system-maintainer': {
          allow_execution_modes: ['suggestion', 'apply'],
          auto_execute_allowed: true,
          allow_live_apply: true
        }
      },
      environments: {
        dev: {
          require_secondary_authorization: false,
          require_password_for_apply: false,
          require_role_policy: false,
          require_distinct_actor_roles: false,
          manual_review_required_for_apply: false
        },
        prod: {
          require_secondary_authorization: true,
          require_password_for_apply: true,
          require_role_policy: true,
          require_distinct_actor_roles: true,
          manual_review_required_for_apply: true
        }
      }
    }, { spaces: 2 });
    return policyPath;
  }

  test('returns allow for maintainer apply in dev', async () => {
    const workspace = path.join(tempDir, 'workspace-allow');
    await fs.ensureDir(workspace);
    const policyPath = await writePolicy(workspace);

    const result = runScript(workspace, [
      '--policy', policyPath,
      '--execution-mode', 'apply',
      '--dialogue-profile', 'system-maintainer',
      '--runtime-environment', 'dev',
      '--auto-execute-low-risk',
      '--json'
    ]);

    expect(result.status).toBe(0);
    const payload = JSON.parse(`${result.stdout}`.trim());
    expect(payload.mode).toBe('interactive-authorization-tier-evaluate');
    expect(payload.decision).toBe('allow');
    expect(payload.requirements.auto_execute_allowed).toBe(true);
  });

  test('returns deny for business-user apply request', async () => {
    const workspace = path.join(tempDir, 'workspace-deny');
    await fs.ensureDir(workspace);
    const policyPath = await writePolicy(workspace);

    const result = runScript(workspace, [
      '--policy', policyPath,
      '--execution-mode', 'apply',
      '--dialogue-profile', 'business-user',
      '--runtime-environment', 'dev',
      '--json'
    ]);

    expect(result.status).toBe(0);
    const payload = JSON.parse(`${result.stdout}`.trim());
    expect(payload.decision).toBe('deny');
    expect(payload.violations.some(item => item.code === 'profile-execution-mode-not-allowed')).toBe(true);
  });

  test('returns review-required for prod apply when manual review is required', async () => {
    const workspace = path.join(tempDir, 'workspace-review');
    await fs.ensureDir(workspace);
    const policyPath = await writePolicy(workspace);

    const result = runScript(workspace, [
      '--policy', policyPath,
      '--execution-mode', 'apply',
      '--dialogue-profile', 'system-maintainer',
      '--runtime-environment', 'prod',
      '--json'
    ]);

    expect(result.status).toBe(0);
    const payload = JSON.parse(`${result.stdout}`.trim());
    expect(payload.decision).toBe('review-required');
    expect(payload.requirements.require_password_for_apply).toBe(true);
    expect(payload.requirements.require_role_policy).toBe(true);
    expect(payload.requirements.require_distinct_actor_roles).toBe(true);
  });
});
