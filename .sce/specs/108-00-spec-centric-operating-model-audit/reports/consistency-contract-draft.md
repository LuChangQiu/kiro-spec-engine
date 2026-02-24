# Consistency Contract（草案 v0.1）

## 1. 目标

为 `spec`、`scene`、`orchestrate`、`auto`、`collab`、`docs` 建立统一配置与状态契约，降低跨模块联动歧义。

## 2. 配置优先级

统一建议优先级（高 -> 低）：

1. CLI 显式参数
2. Spec 局部配置（`.sce/specs/<spec>/custom/*`）
3. 项目配置（`.sce/config/*.json`）
4. 全局默认配置（代码内默认值）

冲突策略：

- 参数冲突默认 **fail-fast**
- 可通过策略开关改为 **override with warning**
- 所有覆盖行为必须写入运行报告

## 3. 统一状态字段

建议所有运行/协同输出至少包含：

```json
{
  "spec_id": "108-00-spec-centric-operating-model-audit",
  "run_id": "uuid-or-timestamp",
  "trace_id": "optional-cross-system-id",
  "stage": "requirements|design|tasks|execute|gate|archive",
  "status": "not-started|in-progress|completed|failed|blocked|stopped",
  "result": "success|warning|error",
  "updated_at": "ISO-8601"
}
```

## 4. 状态源治理

当前已存在的状态源（需收敛）：

- `.sce/specs/<spec>/tasks.md`
- `.sce/specs/<spec>/collaboration.json`
- `.sce/specs/<spec>/lifecycle.json`
- `.sce/config/orchestration-status.json`
- `.sce/auto/<spec>-state.json`

建议：

1. 以 `tasks.md` 作为任务完成真值
2. 其余状态文件以“运行态/协同态”补充，不得反向覆盖任务真值
3. 统一提供状态聚合视图（后续由 pipeline/gate 输出）

## 5. 最小机器可读输出契约

建议统一 JSON 响应壳：

```json
{
  "meta": {
    "spec_id": "...",
    "run_id": "...",
    "command": "...",
    "version": "...",
    "timestamp": "..."
  },
  "decision": {
    "status": "go|conditional-go|no-go",
    "score": 0,
    "summary": "..."
  },
  "details": {},
  "next_actions": []
}
```

## 6. 兼容策略

- 对现有命令先提供 `--json-v2` 或 `--contract v1` 过渡
- 保留旧字段读取兼容期（至少 2 个次版本）
- 在 `CHANGELOG` 标注破坏性变更窗口

