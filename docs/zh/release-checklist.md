# 发布检查清单

> 发版前可重复执行的最小核验流程。

---

## 1. 功能验证

```bash
# 快速 CI 冒烟（integration 为主）
npm run test:smoke

# 全量回归（unit + integration + properties）
npm run test:full

# 防回归：禁止新增 .skip 测试
npm run test:skip-audit

# Value 可观测命令单测
npm test -- tests/unit/commands/value-metrics.test.js

# CLI 冒烟
node bin/scene-capability-engine.js --help
node bin/scene-capability-engine.js value metrics --help
```

---

## 2. Value 可观测冒烟流程

```bash
sce value metrics sample --out ./kpi-input.json --json
sce value metrics snapshot --input ./kpi-input.json --json
```

预期：

- `sample` 生成可用 JSON 样例。
- `snapshot` 输出 machine-readable 结果，包含 `snapshot_path` 与风险字段。

---

## 3. 打包洁净度检查

```bash
npm pack --dry-run
```

确认：

- 打包清单中无临时产物（如 `__pycache__`、`*.pyc`）。
- 包体积在当前版本合理范围内。

---

## 4. 文档一致性检查

确认以下文档与当前版本能力一致：

- `README.md`
- `README.zh.md`
- `docs/command-reference.md`
- `docs/quick-start.md`
- `docs/zh/quick-start.md`
- `CHANGELOG.md`

可选扫描：

```bash
rg -n "yourusername|support@example.com" README.md README.zh.md docs docs/zh -S

# canonical 仓库链接扫描（应返回空）
rg -n "github.com/scene-capability-engine/sce" README.md README.zh.md docs START_HERE.txt INSTALL_OFFLINE.txt -S -g "!docs/release-checklist.md" -g "!docs/zh/release-checklist.md"
```

---

## 5. Git 准备状态

```bash
git status -sb
git log --oneline -n 15

# 强制托管门禁（prepublish/release preflight 默认执行）
node scripts/git-managed-gate.js --fail-on-violation --json
```

确认：

- 工作区干净；
- 提交分组清晰、提交信息可直接用于发布记录。
- 若配置了 GitHub/GitLab 远端：当前分支必须已设置 upstream 且与远端完全同步（ahead=0, behind=0）。
- 若客户确实没有 GitHub/GitLab：可通过策略放行（`SCE_GIT_MANAGEMENT_ALLOW_NO_REMOTE=1`，默认开启）。
- 在 CI/tag 的 detached HEAD 场景下，默认放宽分支/upstream 同步检查；如需强制严格校验，设置 `SCE_GIT_MANAGEMENT_STRICT_CI=1`。
- Errorbook release gate 同时强制临时兜底治理：活动中的兜底记录必须包含退出条件、清理任务和截止时间，且不得过期。

---

## 6. 发布前确认

确认：

- `package.json` 版本号正确；
- `CHANGELOG.md` 已记录发布相关变化；
- 发布说明草稿已就绪（如 `docs/releases/vX.Y.Z.md`）。
- 可选：通过仓库变量配置 release evidence 门禁（`Settings -> Secrets and variables -> Actions -> Variables`）：
  - `KSE_RELEASE_GATE_ENFORCE`：`true|false`（默认 advisory，不阻断发布）
  - `KSE_RELEASE_GATE_REQUIRE_EVIDENCE`：是否要求存在 `handoff-runs.json` 摘要
  - `KSE_RELEASE_GATE_REQUIRE_GATE_PASS`：是否要求 evidence gate `passed=true`（有 evidence 时默认要求）
  - `KSE_RELEASE_GATE_MIN_SPEC_SUCCESS_RATE`：最小允许成功率（百分比）
  - `KSE_RELEASE_GATE_MAX_RISK_LEVEL`：`low|medium|high|unknown`（默认 `unknown`）
  - `KSE_RELEASE_GATE_MAX_UNMAPPED_RULES`：ontology 业务规则未映射最大允许值
  - `KSE_RELEASE_GATE_MAX_UNDECIDED_DECISIONS`：ontology 决策未定最大允许值
  - `KSE_RELEASE_GATE_REQUIRE_SCENE_BATCH_PASS`：是否要求 scene package publish-batch gate 必须通过（`true|false`，默认 `true`）
  - `KSE_RELEASE_GATE_MAX_SCENE_BATCH_FAILURES`：scene package batch 失败数量最大允许值（默认 `0`）
- 可选：通过仓库变量调节 Release Notes 中的漂移告警阈值：
  - CI 中漂移评估由 `scripts/release-drift-evaluate.js` 执行（历史读取、告警计算、gate 报告写回、enforce 退出码）。
  - `KSE_RELEASE_DRIFT_ENFORCE`：`true|false`（默认 `false`），触发 drift alert 时阻断发布
  - `KSE_RELEASE_DRIFT_FAIL_STREAK_MIN`：触发告警的最小连续失败次数（默认 `2`）
  - `KSE_RELEASE_DRIFT_HIGH_RISK_SHARE_MIN_PERCENT`：近 5 版 high 风险占比告警阈值（默认 `60`）
  - `KSE_RELEASE_DRIFT_HIGH_RISK_SHARE_DELTA_MIN_PERCENT`：短期相对长期 high 风险占比增量阈值（默认 `25`）
  - `KSE_RELEASE_DRIFT_PREFLIGHT_BLOCK_RATE_MIN_PERCENT`：近 5 版（有 preflight 信号）blocked 占比告警阈值（默认 `40`）
  - `KSE_RELEASE_DRIFT_HARD_GATE_BLOCK_STREAK_MIN`：hard-gate preflight 连续 blocked 告警阈值（最近窗口，默认 `2`）
  - `KSE_RELEASE_DRIFT_PREFLIGHT_UNAVAILABLE_STREAK_MIN`：release preflight 连续 unavailable 告警阈值（最近窗口，默认 `2`）
- 可选：发布资产 0 字节防护（workflow 默认开启）
  - `scripts/release-asset-nonempty-normalize.js` 会在上传 GitHub Release 资产前，为可选 `.lines` / `.jsonl` 资产自动补齐占位内容，避免 422。
  - 本地 dry-run 示例：
    - `node scripts/release-asset-nonempty-normalize.js --file .sce/reports/release-evidence/matrix-remediation-vX.Y.Z.lines --kind lines --note "no matrix remediation items for this release" --dry-run --json`
  - 本地规范化示例：
    - `node scripts/release-asset-nonempty-normalize.js --file .sce/reports/release-evidence/interactive-matrix-signals-vX.Y.Z.jsonl --kind jsonl --event interactive-matrix-signals --note "No interactive matrix signals collected for this release." --json`
- 可选本地预演 release gate 历史索引产物：
  - `sce auto handoff gate-index --dir .sce/reports/release-evidence --out .sce/reports/release-evidence/release-gate-history.json --json`

然后再执行你的正式发布流程（打 tag、push、npm publish、GitHub Release）。
