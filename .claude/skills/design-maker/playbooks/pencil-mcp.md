# Pencil MCP batch_design 实战避坑

> 被 design-maker SKILL.md 引用。调用 Pencil `batch_design` 前先过一遍这 4 条；调用失败时优先按以下规避策略恢复。
> 来源：feedback `design-maker-pencil-mcp-pitfalls`（occurrences=1，与 PNG 导出 checklist 同主题簇提前实施）。

## 坑 1：parent 参数仅接受 string id

**现象**：`I(parent_binding, {...})` 用 binding 变量做 parent 不生效——前一行 `root=I(document,{...})` 里的 `root` 不被解析为 parent id，新建子元素被插到文档顶层。

**例外**：`document` 是预定义 binding，可直接使用。

**规避**：
- parent 参数必须用 string id
- 跨 batch 时：先一次 `batch_design` 创建父节点 → 拿到返回 id → 下一次 `batch_design` 用该 id 当 parent
- 单 batch 内：用 `children: [...]` 在单次 `I()` 嵌套整棵子树

## 坑 2：单 batch_design 内新建节点 id 不可立即作为后续操作的 parent

**现象**：即使显式指定 `{id: "my-id", ...}`，同一批次的后续行 `I("my-id", {...})` 也会报 `Can't find parent node with id 'my-id'`。

**规避**：
- 方式 A（跨 batch）：本次 `batch_design` 创建父节点 → 等返回拿到 id → 下次 `batch_design` 引用
- 方式 B（嵌套）：在父节点的单次 `I()` 里用 `children: [...]` 数组装整棵子树

## 坑 3：特殊 Unicode 字符 / 嵌套双引号破坏 operations 字符串解析

**现象**：
- 勾号 `U+2713`、部分 emoji → MCP parser 报 `SyntaxError: Unexpected character`
- text content 里出现 `"` 双引号（如 `"已配 API"`）→ break 外层字符串包裹

**规避**：
- 特殊字符用中文全角（如「」）或普通 ASCII 替代
- 嵌套引号用单引号或全角引号
- 调用前对要插入的文本做一次字符白名单审查

## 坑 4：get_screenshot 对大尺寸嵌套顶级容器返回白板缩略图

**现象**：`.pen` 文件里渲染正常，但 `get_screenshot` 抓到的缩略图看起来像 frame 没填内容（其实 children 都在）。

**规避**：
- 完成度校验优先用 `batch_get` 的结构数据，不依赖缩略图
- 需要视觉校验时，换用子节点 id 截取局部截图
- 大容器整体截图只作为氛围参考，不作为「内容是否齐全」的判据

---

## 调用前 4 问 checklist

每次 `batch_design` 调用前快速过：

1. operations 里所有 parent 是不是 string id（不是 binding 变量）？
2. operations 里有没有「同 batch 后续引用新建 id」的情况？有 → 改 `children` 嵌套或拆 batch
3. text content 里有没有勾号 / emoji / 嵌套双引号？有 → 替换
4. 完成后用哪种方式校验完成度？批量内容用 `batch_get`，视觉态用子节点 `get_screenshot`
