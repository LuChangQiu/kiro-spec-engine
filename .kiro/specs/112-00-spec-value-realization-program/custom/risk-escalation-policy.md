# 风险升级规则（周度）

## 规则定义

当以下任一 KPI 连续两周朝“更差方向”变化时，风险等级自动提升为 `High`：

- `ttfv_minutes`（越低越好）
- `batch_success_rate`（越高越好）
- `cycle_reduction_rate`（越高越好）
- `manual_takeover_rate`（越低越好）

## 自动评估脚本

- 脚本路径：`custom/scripts/evaluate-risk.js`
- 输入目录：`custom/weekly-metrics/*.json`
- 输出文件：`custom/weekly-metrics/risk-evaluation.latest.json`

### 运行命令

```bash
node .kiro/specs/112-00-spec-value-realization-program/custom/scripts/evaluate-risk.js \
  --dir .kiro/specs/112-00-spec-value-realization-program/custom/weekly-metrics \
  --out .kiro/specs/112-00-spec-value-realization-program/custom/weekly-metrics/risk-evaluation.latest.json
```

## 执行频率

- 每周复盘前执行一次
- Day 30 / Day 60 门禁前强制执行并归档结果
