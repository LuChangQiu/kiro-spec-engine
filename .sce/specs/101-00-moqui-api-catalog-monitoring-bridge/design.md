# 设计文档：Moqui API Catalog + Monitoring Bridge

## 概述

通过在 `moqui-adapter` 增加 `api.*` 与 `monitor.*` 命名空间，将目录发现与监控查询纳入统一 binding 执行面。

## Ref 设计

### API

- `moqui.api.index` -> `GET /api/v1`
- `moqui.api.catalog` -> `GET /api/v1/catalog`
- `moqui.api.routes` -> `GET /api/v1/routes`
- `moqui.api.tags` -> `GET /api/v1/tags`
- `moqui.api.methods` -> `GET /api/v1/methods`
- `moqui.api.search` -> `GET /api/v1/catalog/search`（query 来自 payload）

### Monitoring

- `moqui.monitor.ready` -> `GET /api/v1/ready`
- `moqui.monitor.metrics-json` -> `GET /api/v1/metrics`
- `moqui.monitor.metrics` -> `GET /metrics`

## Discover 扩展

- `scene discover --type api`
- `scene discover --type monitoring`
- 默认 summary 增加 `api`、`monitoring` 两类计数与状态

## 变更点

- `lib/scene-runtime/moqui-adapter.js`
- `lib/commands/scene.js`
- `tests/unit/scene-runtime/moqui-adapter.test.js`
- `tests/unit/commands/scene.test.js`

## Scene Manifest 示例

```yaml
spec:
  capability_contract:
    bindings:
      - type: query
        ref: moqui.api.index
      - type: query
        ref: moqui.api.catalog
      - type: query
        ref: moqui.api.routes
      - type: query
        ref: moqui.monitor.ready
      - type: query
        ref: moqui.monitor.metrics-json
      - type: query
        ref: moqui.monitor.metrics
```

payload 示例：

```json
{
  "query": {
    "tag": "services",
    "publicOnly": true
  }
}
```
