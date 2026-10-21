# DeepSeek 鲸鱼娘 · DSH 小人与额度套件

一个仓库，两个可以独立安装的部分：

| 位置 | 是什么 | 装完的效果 |
| --- | --- | --- |
| **仓库根目录** | 小人包：`DeepSeek 鲸鱼娘` 宠物 | DSH 里多一只蓝发鲸鱼娘 |
| **[`quota/`](quota/)** | 额度插件：小 DS 伴宠 + 额度面板 | 常驻小 DS，旁边显示余额和订阅额度 |

两者可以一起用，也可以只装一个。额度插件就是根据这只鲸鱼娘的图集来画小 DS 的，
所以一起装的体验最完整。

---

# 第一部分：小人包（根目录）

![宠物预览](assets/preview.png)

| 项目 | 值 |
| --- | --- |
| 宠物 ID | `custom:deepseek-whale-v2` |
| 图集 | 1536 × 2288，8 列 × 11 行，每格 192 × 208，RGBA 透明 |
| 协议 | `spriteVersionNumber: 2` |
| 素材作者 | YunYueSama |

## 需要装什么

| 插件 | 是否必需 | 作用 |
| --- | --- | --- |
| `@michengai/dsh-codex-pet` | **必需** | 宠物渲染与设置界面 |
| `@michengai/dsh-codex-ui` | **不需要** | 界面皮肤，与宠物显示无关 |
| `@linxin666/dsh-pet` | 不需要 | 另一套宠物系统，互不影响 |

**关于 codex-UI：** 不需要装。本包是「宠物素材 + 安装壳」，角色由图集直接渲染；
在 `@michengai/dsh-codex-pet` 1.0.2 的 `lib/` 里检索不到任何 `codex-ui` 引用。
装了只会换界面皮肤，不会让宠物更完整。

## 安装

```sh
dsh plugin add <本仓库地址>
```

插件首次加载时把宠物写入宠物库，**已存在则不覆盖**。之后在 DSH 宠物设置里刷新并选择「DeepSeek 鲸鱼娘」。

不想装插件也可以：

```sh
git clone <本仓库地址>
node scripts/install.mjs            # 安装，已存在则不动
node scripts/install.mjs --force    # 覆盖
```

或直接把 `pets/deepseek-whale-v2/` 复制到：

- Windows：`%USERPROFILE%\.dsh\codex-pet\pets\deepseek-whale-v2\`
- macOS / Linux：`~/.dsh/codex-pet/pets/deepseek-whale-v2/`

设置了 `DSH_HOME` 时用 `$DSH_HOME/codex-pet/pets/deepseek-whale-v2/`。

## 卸载

删除 `~/.dsh/codex-pet/pets/deepseek-whale-v2/`，或在宠物设置里换回其他角色后再删。
装过插件的从插件管理器移除即可；本插件不会删除宠物目录，也不改其他配置。

---

# 第二部分：额度插件（`quota/`）

完整说明见 **[quota/README.zh-CN.md](quota/README.zh-CN.md)**。

![额度面板](quota/assets/battery-panel.jpg)

它负责：小 DS 伴宠、`DS ¥金额` / `5h` / `周` 三行额度、任务卡片、齿轮设置，
以及**可选**的桌面独立悬浮窗（需要修改 DSH Desktop 文件，绑定 `2.0.18`）。

| 依赖 | 是否必需 |
| --- | --- |
| `@linxin666/dsh-pet` | **必需** |
| 宠物 `deepseek-whale-v2`（本仓库根目录那个） | **必需** |
| `@linxin666/dsh-usage` | 建议（DS 余额） |
| `@eddyskywalker/dsh-chatgpt-subscription` | 建议（5h / 周电池） |
| `@michengai/dsh-codex-ui` | **不需要** |

因为它在子目录里，安装时给插件管理器指子路径：

```sh
git clone <本仓库地址>
dsh plugin add link:<克隆目录>/quota
```

桌面窗口是可选的，装之前先读完 [quota/README.zh-CN.md](quota/README.zh-CN.md)，
它会在写文件前备份、校验版本，并支持 `--restore` 按字节还原。

---

# 许可证与署名

- **角色素材**：作者 YunYueSama，仓库 <https://github.com/YunYueSama/codex-deepseek-pet>，
  采用「大肥鱼项目署名许可 1.0」。允许使用、修改、分享及商用，**须注明作者与仓库地址，
  分发时须保留完整许可**。完整条款见 [LICENSE](LICENSE) 与 [ASSET_LICENSE.md](ASSET_LICENSE.md)。
  该许可不授予底层社区参考作品的额外权利，也不代表 DeepSeek 或 OpenAI 官方发布。
- **`quota/` 的代码**：MIT，见 [quota/LICENSE](quota/LICENSE)。它**不打包任何角色素材**，
  读取本机已安装的宠物图集。

# 验证状态

- 小人图集实测 1536×2288、RGBA、透明角像素，与协议网格一致。
- 额度插件 30 项测试通过，含桌面安装器沙盒测试（版本拦截、幂等、接管保护、还原后字节一致）。
- **未验证**：未在干净的第三方机器上完整走通「插件管理器安装 → 出现宠物 / 小 DS」；
  桌面窗口只在 DSH Desktop `2.0.18` 上验证过。正式宣传前建议找台没装过的机器试一次。
