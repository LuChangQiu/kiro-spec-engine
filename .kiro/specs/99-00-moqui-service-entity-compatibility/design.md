# 设计文档：Moqui Service + Entity Compatibility

## 概述

本设计在 `moqui-adapter` 内扩展 ref 解析和 HTTP 映射，不改动 MoquiClient 协议层。

## 接口映射

### Service

- `moqui.service.{Name}.job-status` -> `GET /api/v1/services/jobs/{jobId}`
- 可选回退：`GET /api/v1/services/{Name}/jobs/{jobId}`

### Entity

- `moqui.entity.{Entity}.definition` -> `GET /api/v1/entities/{Entity}/definition`
- `moqui.entity.{Entity}.relationships` -> `GET /api/v1/entities/{Entity}/relationships`
- `moqui.entity.{Entity}.batch` -> `POST /api/v1/entities/{Entity}/batch`
- `moqui.entity.{Entity}.related.{Rel}.list` -> `GET /api/v1/entities/{Entity}/{id}/related/{Rel}`

## 解析策略

1. 先匹配显式语法 `moqui.entity.*`。
2. 再匹配历史语法 `moqui.{Entity}.{op}`。
3. 对缺参场景增加输入校验，返回 `MISSING_REQUIRED_FIELD`。

## 变更点

- `lib/scene-runtime/moqui-adapter.js`
- `tests/unit/scene-runtime/moqui-adapter.test.js`

## 兼容策略

- 不删除历史 ref。
- 新语法与旧语法并存。
- `job-status` 优先新路径，保障与基线一致。

## Scene Manifest 示例

以下示例用于 `scene run`/`scene doctor` 验收：

```yaml
spec:
  capability_contract:
    bindings:
      - type: query
        ref: moqui.entity.OrderHeader.definition
      - type: query
        ref: moqui.entity.OrderHeader.relationships
      - type: mutation
        ref: moqui.entity.OrderHeader.batch
      - type: query
        ref: moqui.entity.OrderHeader.related.OrderItems.list
      - type: adapter
        ref: moqui.service.PlaceOrder.job-status
```

payload 示例：

```json
{
  "id": "ORDER-10001",
  "jobId": "job-abc-123",
  "data": {
    "operations": [
      { "op": "update", "id": "ORDER-10001", "fields": { "statusId": "ORDER_APPROVED" } }
    ]
  }
}
```
