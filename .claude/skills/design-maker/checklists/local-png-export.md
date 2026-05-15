# 本地 PNG 导出 checklist（design-maker MCP 模式）

> 被 SKILL.md [第五步] 引用。逐项执行；任一项失败按 SKILL.md [第一性原则].MCP 调用纪律 停止并报告。
> 来源：feedback `design-maker-local-png-export`（occurrences=4）。

## 1. 目录准备

- [ ] 项目根目录存在 `design_export/`；不存在则 `mkdir -p design_export`
- [ ] 传给 MCP 导出工具的路径用项目根目录绝对路径，避免相对路径落到设计工具工作目录

## 2. 导出前置校验

- [ ] `get_editor_state` 确认当前活动设计文件
- [ ] 若活动文件 ≠ 本次目标 `.pen`，先 `open_document` 打开目标文件
- [ ] `batch_get` 读取所有计划导出节点，确认存在于同一个 `.pen`
- [ ] `snapshot_layout(..., problemsOnly: true)` 检查总设计容器和导出区无布局问题
- [ ] 回读总设计容器，确认至少包含：Header / Variables / Components / Pages / State Variants
- [ ] 组件区 / 页面区 / 状态区脱离总设计容器 → 先移动回总容器，或明确改为分别导出（不允许导出缺内容的总容器）

## 3. 导出节点清单（最少集）

- 总设计容器
- 页面区（所有主页面总览）
- 状态区（所有状态变体总览）
- 每个主页面 frame（如果有独立页面 frame）

## 4. 单节点循环导出 + scale 分级表

| 节点类型 | scale | 原因 |
|---|---|---|
| 单页面 / 主页面 frame | 1 | 开发需要 1:1 对照 |
| 组件区 / 页面行 / 状态总览 | 0.5 | 宽容器减少分辨率压力 |
| 总设计容器 | 0.25 | 全景图缩略，避免 Pencil 报 `.pen` 错误 |

- [ ] 用 `export_nodes`，`format: "png"`，`outputDir: "design_export"`
- [ ] **优先单节点逐个导出**，禁止把大量 node ids 一次传给 `export_nodes`
- [ ] 页面总览导出失败时，降级用「页面行 + 每个 frame」覆盖；在报告里注明页面总览失败原因
- [ ] 导出后读取返回路径，确认 PNG 文件真实存在

## 5. `.pen` 引用错误恢复

- 现象：`export_nodes` 报告引用了错误 `.pen` 文件
- 处置：**只允许 1 次恢复**——重新 `open_document` 打开目标文件 + `batch_get` 重新读取节点 + 重试导出
- 1 次恢复后仍失败 → 停止，按第 7 节失败处理报告

## 6. 过期 PNG 清理

- [ ] 替代导出成功后（如页面行替代页面总览），把被替代的旧 PNG 删除或移出 `design_export/`
- [ ] 不允许 `design_export/` 混入过期 / 已被替代 / 已不作为交付依据的 PNG
- [ ] 报告前再扫一遍目录，确认列出的文件路径与磁盘实际一致

## 7. 失败处理

- 不允许把 `get_screenshot` 结果或 Markdown 描述冒充本地 PNG 导出
- 目录创建失败 / MCP 导出失败 / PNG 文件不存在 → 停止 + 报告 MCP 错误、已创建目录、未生成 PNG 的事实

## 8. 报告字段（最终报告必须列出）

- `design_export/` 实际路径
- 每个导出 PNG 的文件路径
- 替代导出 / 失败降级的说明（如有）
- 已删除 / 已替代的过期 PNG 列表（如有）
