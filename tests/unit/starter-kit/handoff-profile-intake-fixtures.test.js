'use strict';

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

const FIXTURE_ROOT = path.resolve(__dirname, '..', '..', 'fixtures', 'handoff-profile-intake');

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

describe('handoff profile intake fixtures', () => {
  test('profile fixtures provide valid manifest and evidence samples', () => {
    const profiles = ['default', 'moqui', 'enterprise'];
    profiles.forEach((profile) => {
      const manifestFile = path.join(FIXTURE_ROOT, profile, 'manifest.json');
      const evidenceFile = path.join(FIXTURE_ROOT, profile, 'release-evidence-summary.json');

      expect(fs.existsSync(manifestFile)).toBe(true);
      expect(fs.existsSync(evidenceFile)).toBe(true);

      const manifest = readJson(manifestFile);
      expect(Array.isArray(manifest.specs)).toBe(true);
      expect(manifest.specs.length).toBeGreaterThan(0);
      expect(Array.isArray(manifest.templates)).toBe(true);
      expect(manifest.templates.length).toBeGreaterThan(0);
      expect(manifest.ontology_validation).toEqual(expect.objectContaining({
        status: 'passed'
      }));

      const evidence = readJson(evidenceFile);
      expect(evidence.mode).toBe('auto-handoff-evidence-review');
      expect(evidence.governance_snapshot).toEqual(expect.objectContaining({
        mode: 'auto-governance-stats'
      }));
    });
  });

  test('profile ci sample contains profile-based handoff commands', () => {
    const workflowFile = path.resolve('docs', 'starter-kit', 'handoff-profile-ci.sample.yml');
    expect(fs.existsSync(workflowFile)).toBe(true);
    const workflow = yaml.load(fs.readFileSync(workflowFile, 'utf8'));

    expect(workflow.on.workflow_dispatch.inputs.profile.default).toBe('moqui');
    const steps = workflow.jobs['handoff-intake'].steps;
    const runText = steps
      .map(step => (typeof step.run === 'string' ? step.run : ''))
      .join('\n');

    expect(runText).toContain('sce auto handoff capability-matrix');
    expect(runText).toContain('sce auto handoff run');
    expect(runText).toContain('--profile "${PROFILE}"');
  });
});

