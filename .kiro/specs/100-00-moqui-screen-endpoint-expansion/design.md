# 设计文档：Moqui Screen Endpoint Expansion

## 概述

设计目标是在不破坏既有 screen ref 行为的前提下，增加 query 风格接口映射。

## Ref 映射

- `moqui.screen.catalog` -> `GET /api/v1/screens`
- `moqui.screen.{Path}` -> `GET /api/v1/screens/{Path}`
- `moqui.screen.definition` -> `GET /api/v1/screens/definition?path={payload.path}`
- `moqui.screen.forms` -> `GET /api/v1/screens/forms?path={payload.path}`
- `moqui.screen.widgets` -> `GET /api/v1/screens/widgets?path={payload.path}`
- `moqui.screen.render` -> `GET /api/v1/screens/render?path={payload.path}`

## 解析优先级

1. 优先识别关键字：catalog/definition/forms/widgets/render
2. 非关键字按历史路径参数语法处理

## 变更点

- `lib/scene-runtime/moqui-adapter.js`
- `tests/unit/scene-runtime/moqui-adapter.test.js`

## 兼容性

- 历史 `moqui.screen.OrderEntry` 等路径 ref 保持不变
- 新接口缺参时返回失败结果，不抛出未捕获异常

## Scene Manifest 示例

```yaml
spec:
  capability_contract:
    bindings:
      - type: query
        ref: moqui.screen.catalog
      - type: query
        ref: moqui.screen.definition
      - type: query
        ref: moqui.screen.forms
      - type: query
        ref: moqui.screen.widgets
      - type: query
        ref: moqui.screen.render
```

payload 示例：

```json
{
  "path": "framework/screen/framework/ScreenRenderEmail"
}
```
