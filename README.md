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
- **3D 骰子**：基于 [@3d-dice/dice-box](https://www.npmjs.com/package/@3d-dice/dice-box)，可配置颗数与类型（d4/d6/d8/d10/d12/d20）
- **AI 对话**：OpenAI 兼容协议（DeepSeek / OpenAI / 任意 base_url），支持以下命令
  - `/new` 开新对话
  - `/save` 保存当前对话
  - `/delete` 删除当前已保存对话

### 全局
- 右侧面板宽度可拖拽（280–800px），状态持久化
- 各功能模块可在设置里整体显示/隐藏
- 设置面板支持完整 JSON 导入 / 导出，方便备份与迁移
- 屏幕宽度 < 1100px 时自动切纵向布局

## 数据存储

- `localStorage["e-desktop-data"]`：栏目、链接、颜色、AI 配置、骰子配置、面板宽度、诗词样式、页面可见性
- `localStorage["e-desktop-side-data"]`：待办、提示词、收藏诗词、AI 对话历史
- `link.json`：首次打开时的默认种子；也是导入 / 导出的标准格式

加载顺序：先读 localStorage → 读不到则 `fetch('link.json')` → 再失败则使用 `app.js` 内嵌的 `DEFAULT_DATA`。

## 使用

直接双击 `index.html` 即可。若需要让 `fetch('link.json')` 在首次加载时生效（即不依赖内嵌默认），用任意本地静态服务器打开：

```bash
# 任选其一
npx http-server .
python -m http.server 8000
```

骰子模块依赖通过 CDN（unpkg）动态 import，无需 `npm install`。`package.json` 仅声明依赖以备本地化，运行时不读取。

## 文件结构

```
vexpaer_go/
├── index.html        # 页面骨架 + 设置模态框
├── app.js            # 全部逻辑（约 1300 行，单文件）
├── styles.css        # 暗色主题样式
├── link.json         # 配置种子 / 备份样本
├── package.json      # 仅声明骰子依赖
├── assets/           # 骰子 wasm 与主题资源（备用本地化）
└── public/           # 同上
```

## 注意

- `link.json` 中包含 `aiConfig.apiKey`，提交到公共仓库前请清空或加 `.gitignore`
- 修改不会自动回写 `link.json`，需在设置里点"导出 JSON"覆盖
