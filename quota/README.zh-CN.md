# DSH 小 DS 伴宠与额度面板

在 DSH 里常驻一只小 DS，旁边显示账户与订阅额度；可选把它变成桌面上的独立悬浮窗。

![额度面板](assets/battery-panel.jpg)

## 它由两层组成

| 层 | 内容 | 安装方式 |
| --- | --- | --- |
| **网页层** | 小 DS、`DS ¥金额` / `5h` / `周` 三行额度、任务卡片、齿轮设置 | 普通 DSH 插件 |
| **桌面层**（可选） | 独立透明置顶窗口、鼠标穿透、原生拖拽 | 需要修改 DSH Desktop 的文件 |

网页层装完就能用，只是小 DS 显示在 DSH 页面内。
桌面层才会让它离开窗口、常驻桌面。

## 依赖

| 依赖 | 是否必需 | 用途 |
| --- | --- | --- |
| `@linxin666/dsh-pet` | **必需** | 主宠渲染、`/api/pet/state`、`/api/pet/pets`，小 DS 以它为锚点 |
| 宠物 `deepseek-whale-v2` | **必需** | 小 DS 的图集来源，来自同系列的「DeepSeek 鲸鱼娘」小人包 |
| `@linxin666/dsh-usage` | 建议 | `DS ¥` 金额，缺失时该行显示提示 |
| `@eddyskywalker/dsh-chatgpt-subscription` | 建议 | `5h` / `周` 电池，缺失时该行显示提示 |
| `@michengai/dsh-codex-ui` | **不需要** | 界面皮肤，与本插件无关 |
| DSH Desktop `2.0.18` | 仅桌面层 | 其它版本会被安装器拒绝 |

小 DS 的图集**不随本包分发**，它读取你已安装的 `deepseek-whale-v2` 宠物，
所以不会重新分发任何角色素材。宠物不存在时小 DS 会显示为可召回的空状态，不会报错崩溃。

## 安装：网页层

```sh
dsh plugin add <本仓库地址或本地路径>
```

装完刷新界面，小 DS 出现在页面里。原 `dsh-quota-battery` 如果还装着，
请先禁用它——本插件会移除它的旧挂件，同时留着两者会重复渲染。

## 安装：桌面层（可选）

先彻底退出 DSH Desktop，再执行：

```sh
node scripts/install-desktop.mjs
```

它会：

1. 校验 DSH Desktop 版本（只接受 `2.0.18`，其它版本需显式 `--unsafe-version`）
2. 把 `lib/main.js` 和 `lib/preload.cjs` 备份到 `backups/desktop-<版本>-<安装哈希>/`
3. 复制窗口实现到 `lib/pet-desktop/`，写入归属标记文件
4. 在 `main.js` 头部加一行 import，在 `preload.cjs` 末尾追加窄 IPC 桥

然后启动 DSH Desktop，小 DS 就是独立窗口了。透明区域鼠标穿透，角色、额度、按钮可交互。

### 还原

```sh
node scripts/install-desktop.mjs --restore
```

会把两个入口文件**按字节还原**成安装前的样子（测试里专门验证了这一点），
并只删除自己创建的 `lib/pet-desktop/` 目录。如果这两个文件在安装后被别人改过，
安装器会拒绝覆盖并提示你手动还原。

### 接管旧的手工安装

如果你之前用别的方式装过 `lib/pet-desktop`（没有本包的标记文件），安装器会拒绝执行。
确认要替换后用：

```sh
node scripts/install-desktop.mjs --take-over
```

替换前请先停用旧的那份，否则可能同时出现两个小 DS。

## 设置

小 DS 下方的 `⚙` 或右键打开：80–896 px 等比缩放、看向与空闲动作、挥手、小跳、专注、隐藏。
同一菜单里的「主宠待机设置」控制 DSH 主宠的空闲动作、拖拽回弹和专注。

隐藏后点左下角「显示小 DS」召回。窗口关闭或插件卸载时会清掉自己的样式与监听。

## 数据来源

- `DS ¥`：`/api/dsh-usage/overview`，来自 `@linxin666/dsh-usage`
- `5h` / `周`：`/api/dsh-chatgpt-subscription/quota/refresh`，来自订阅插件
- 任务卡片：DSH 当前会话的思考／工具调用／等待／完成／报错状态

三种数据都通过 DSH 同源的、已登录的页面接口读取，**不新增端口、不复制凭据、不发起模型对话**。
缺失或过期的数据会变灰或显示 `--`，不会伪装成 100%。

## 已知限制

- 桌面层绑定 `2.0.18`，DSH Desktop 升级后需要重新适配；安装器会拒绝未知版本而不是盲目写入。
- 桌面窗口依赖 Electron 主进程，所以无法做成「纯插件」零改动安装。
- 系统菜单、原生窗口边框、系统级文件拖放提示不受本插件控制。
- 网页层与桌面层不能同时各显示一只；装了桌面层后页面版自动让位。

## 许可

本仓库代码使用 MIT，见 [LICENSE](LICENSE)。

**不含第三方角色素材**：小 DS 读取的是你本机已安装的宠物图集，不随包分发。
若你使用的是他人绘制的宠物，请遵守该素材自己的许可（例如 `deepseek-whale-v2` 来自
YunYueSama，采用大肥鱼项目署名许可 1.0）。
