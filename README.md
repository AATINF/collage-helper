# 拼图助手

把几张照片拼成一张：**模板网格**（2~9 张，16 种版式）＋ **长图拼接**（竖向 / 横向）。

- 全程本地处理，**照片不上传任何服务器**
- 成品直接存进系统「下载」，保存后弹卡片可以「打开」「分享」
- 网页 + Capacitor 套壳，编译在 GitHub Actions 云端完成（本机不需要 JDK / Android SDK）

## 本地跑网页版

```bash
python3 -m http.server 8080
# 浏览器打开 http://localhost:8080
```

## 目录

```
index.html           界面
src/                 全部业务代码（core 算法 / io 原生能力 / ui 视图）
tools/prepare_www.py 白名单打包脚本：只有它能决定什么进 APK
android/             Capacitor 生成的原生工程（必须提交）
tests/               纯逻辑自测
ARCHITECTURE.md      加功能该改哪里的说明书
```

## 发版

```bash
./publish.sh v1.0.1 "修复xxx"
```

脚本会自动：同步版本号 → versionCode +1 → 提交 → 打 tag → 触发云端编译。
约 3~5 分钟后 APK 出现在
`https://github.com/AATINF/collage-helper/releases/latest/download/collage-helper.apk`

## 签名

固定 keystore（PKCS12），4 个 Secrets：`KEYSTORE_B64` / `KEYSTORE_PASSWORD` / `KEY_ALIAS` / `KEY_PASSWORD`。
**keystore 丢了，老用户升级必须卸载重装**——`keystore/` 目录不进 git，请另行备份。
