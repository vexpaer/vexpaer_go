# vexpaer_go

个人浏览器主页（self-use browser homepage）。纯前端单页应用，无构建步骤，打开 `index.html` 即用。

左侧是按"栏目 / 颜色"分组的链接墙，右侧是带时钟、诗词、待办、提示词、骰子、AI 对话的功能面板。所有配置可通过右下角 ⚙️ 在前端直接编辑，并导出为 JSON。

## 功能

### 链接墙（左）
- 多栏目纵向布局，可自由增删栏目、调整顺序
- 每条链接可配置文字、URL、颜色、所属栏目、显示/隐藏
- 支持 `file:///` 本地路径（本机课本、PDF 等）
- 链接和栏目均支持拖拽排序、按栏目批量改色
- 颜色板自管理（增删任意颜色）

### 右侧面板
- **时间**：实时显示星期 + 日期 + 时:分:秒
- **今日诗词**：从 [jinrishici.com](https://v1.jinrishici.com/all.json) 拉取，可刷新；样式（颜色、字号、字体 CSS URL）可在设置里改
- **待办**：增删改、拖拽排序，本地存储
- **提示词**：常用 prompt 收藏，一键复制
- **诗词收藏**：手动加 / 把当前诗词收进列表 / 导出为 TXT
- **3D 骰子**：基于 Three.js + Cannon.js 的物理骰子，支持公式配置（如 `3D6`、`2D20+1D8`），支持 D4/D6/D8/D10/D12/D20
- **AI 对话**：OpenAI 兼容协议（DeepSeek / OpenAI / 任意 base_url），支持以下命令
  - `/new` 开新对话
  - `/save` 保存当前对话
  - `/delete` 删除当前已保存对话
  - 支持多模型预设配置、系统提示词、流式输出

### 全局
- 两套主题：默认暗色 / iOS 26 毛玻璃
- 右侧面板宽度可拖拽（280–800px），状态持久化
- 各功能模块可在设置里整体显示/隐藏
- 内容字体大小可按模块独立调节
- 聊天气泡宽度可调（50%–100%）
- 设置面板支持完整 JSON 导入 / 导出，方便备份与迁移
- 屏幕宽度 < 1100px 时自动切纵向布局

## 数据存储

- `localStorage["e-desktop-data"]`：栏目、链接、颜色、AI 配置、骰子配置、面板宽度、诗词样式、页面可见性、主题、聊天气泡宽度、内容字体大小
- `localStorage["e-desktop-side-data"]`：待办、提示词、收藏诗词、AI 对话历史

加载顺序：先读 localStorage → 读不到则使用 `state.js` 内嵌的 `DEFAULT_DATA`。

## 使用

直接双击 `index.html` 即可。

## 文件结构

```
vexpaer_go/
├── index.html          # 页面骨架 + 设置模态框
├── js/
│   ├── state.js        # 状态管理、默认数据、工具函数、持久化
│   ├── app.js          # 初始化流程、导入导出
│   ├── links.js        # 链接 / 栏目 CRUD 与拖拽
│   ├── features.js     # 右侧面板功能（待办/提示词/诗词/可见性）
│   ├── panel.js        # 右侧面板渲染与宽度拖拽
│   ├── poem.js         # 诗词拉取与样式
│   ├── dice.js         # 3D 物理骰子（Three.js + Cannon.js）
│   ├── ai-chat.js      # AI 对话（流式 SSE、多预设）
│   └── settings.js     # 设置弹窗、编辑器、主题切换
├── css/
│   ├── base.css        # 基础样式
│   ├── layout.css      # 布局
│   ├── buttons.css     # 按钮样式
│   ├── right-panel.css # 右侧面板样式
│   ├── settings.css    # 设置弹窗样式
│   ├── responsive.css  # 响应式适配
│   └── theme-ios26.css # iOS 26 毛玻璃主题
└── .gitignore
```

## 注意

- AI 配置中的 `apiKey` 仅存于浏览器 localStorage，不会写入仓库文件
- 修改不会自动回写本地文件，需在设置里点"导出 JSON"备份