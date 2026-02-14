# 发布检查清单

> 发版前可重复执行的最小核验流程。

---

## 1. 功能验证

```bash
# 核心 CI 测试
npm run test:ci

# Value 可观测命令单测
npm test -- tests/unit/commands/value-metrics.test.js

# CLI 冒烟
node bin/kiro-spec-engine.js --help
node bin/kiro-spec-engine.js value metrics --help
```

---

## 2. Value 可观测冒烟流程

```bash
kse value metrics sample --out ./kpi-input.json --json
kse value metrics snapshot --input ./kpi-input.json --json
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
```

---

## 5. Git 准备状态

```bash
git status -sb
git log --oneline -n 15
```

确认：

- 工作区干净；
- 提交分组清晰、提交信息可直接用于发布记录。

---

## 6. 发布前确认

确认：

- `package.json` 版本号正确；
- `CHANGELOG.md` 已记录发布相关变化；
- 发布说明草稿已就绪（如 `docs/releases/vX.Y.Z.md`）。

然后再执行你的正式发布流程（打 tag、push、npm publish、GitHub Release）。
