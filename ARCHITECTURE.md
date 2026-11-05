# 架构说明（给以后加功能的人看）

这个 App 是「纯网页 + Capacitor 套壳」。**所有业务逻辑都在 `src/` 里**，`android/` 只有一层薄壳和两个 Java 文件。
没有打包器、没有框架、没有 npm 依赖（除了 Capacitor 本身）——改完刷新就生效，`node_modules` 删了也能跑。

## 目录与职责

```
index.html            界面骨架（3 屏：选图 / 编辑 / 结果卡 + 3 个弹层）
src/
├── app.js            入口：事件绑定、屏幕切换、导出流程。只做「胶水」，不放算法
├── state.js          全局状态 + 订阅 + 草稿用的元信息快照
├── styles.css        iOS 风格视觉层（全部设计参数集中在 :root）
├── core/
│   ├── templates.js  版式定义（唯一数据源）＋ 缩略图 SVG 生成
│   ├── image.js      读图 / EXIF 方向纠正 / 降采样 / cover 绘制
│   └── compose.js    网格合成 + 长图拼接 + canvas→Blob
├── io/
│   ├── picker.js     选图（<input type=file>，Capacitor 自动接管）
│   ├── bridge.js     原生能力桥：保存 / 打开 / 分享 / 是否在 App 里
│   └── draft.js      草稿（IndexedDB 存原图，localStorage 放不下）
└── ui/
    └── toast.js      底部提示
```

## 数据流

```
选图 → state.photos[]（每张含 File / 解码后的 bitmap / 缩略图 / 裁剪参数）
     ↓
编辑 → renderPreview() 把 state 画到预览 canvas（边长 700，不是最终画质）
     ↓
导出 → drawGrid / drawLong 按 state.quality 重新画一张大 canvas → toBlob(JPG)
     ↓
保存 → io/bridge.js：App 里走 FileSaver 原生桥写进系统「下载」，浏览器里走 a[download]
```

## 常见改动怎么做

| 想做的事 | 改哪里 |
|---|---|
| 加一种拼图版式 | `core/templates.js` 的 `TEMPLATES` 加一条 `{id, name, count, cells}`，`cells` 是 0~1 相对坐标，面积必须铺满 1 |
| 加边框 / 圆角 / 背景色 | `core/compose.js` 的 `drawGrid`，在 `drawCover` 前后加绘制；参数从 `state` 里新增字段读 |
| 加滤镜 / 水印 | `core/image.js` 加处理函数，在 `drawGrid` 里 `drawCover` 之后调用 |
| 改输出格式（PNG/WebP） | `core/compose.js` 的 `canvasToBlob` + 文件名后缀 |
| 改保存位置 / 走 SAF 让用户选路径 | `android/app/src/main/java/com/aatinf/collage/FileSaverPlugin.java` |
| 改清晰度档位 | `index.html` 的 `#qualityList` + `app.js` 的 `qualityLabel()` |
| 改视觉风格 | `src/styles.css` 的 `:root` 变量（`--accent` 换主色，`--r-card` 换圆角） |
| 改草稿行为 | `io/draft.js` |

## 三条硬约束（别踩）

1. **画布边长上限**：`core/image.js` 里 `MAX_EDGE = 4096`（单图解码上限）、`core/compose.js` 里 `MAX_LONG_EDGE = 16384`（长图总高/总宽上限）。调大之前先在真机上试，Android WebView 的 canvas 超限会直接闪退，不会报错。
2. **必须 `npx cap sync`**：改完 `src/` 后，App 里的代码来自 `android/app/src/main/assets/public/`，不同步就还是旧代码。
3. **versionCode 只能加不能减**：见 `publish.sh`，它每次自动 +1。

## 调试

- 浏览器里打开页面，控制台执行 `__collage.state` 能看到当前状态（照片、版式、清晰度）。
- 纯逻辑测试（不需要浏览器）：`node tests/logic.test.mjs`，覆盖版式几何、合成尺寸、长图封顶、裁剪数学。
