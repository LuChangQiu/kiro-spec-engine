# 当前场景

**版本**: `3.6.41` 已完成发布切版准备  
**状态**: SCE 接管基线已对齐，进入遗留命名治理与兼容收敛阶段  
**当前主线**: 消化高价值 legacy Kiro 命名残留，统一活跃路径的 SCE 语义，同时保留 `.kiro` 迁移兼容面

**本轮重点**:
- 修复协作元数据写入仍使用 `kiroInstance` 的行为偏差，统一改为 `sceInstance`
- 将 adoption / backup / bootstrap / spec gate / auto / repo config 等活跃模块内部命名迁移到 `sce*`
- 保持 takeover baseline、branding consistency 和 legacy migration guard 同步成立，避免清理动作破坏兼容层
