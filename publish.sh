#!/usr/bin/env bash
# 📦 一键发版
# 用法: ./publish.sh v1.0.1 "修复了什么"
# 作用: 同步三处版本号 → versionCode 自动 +1 → 提交 → 打 tag（触发云端编译）
set -e
cd "$(dirname "$0")"

NEW="${1:?用法: ./publish.sh vX.Y.Z [说明]}"
DESC="${2:-版本升级}"
VER="${NEW#v}"
[[ "$VER" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]] || { echo "❌ 版本格式错，应为 vX.Y.Z"; exit 1; }

python3 - "$VER" <<'PYEOF'
import json, re, sys, pathlib
V = sys.argv[1]

# ① package.json
p = pathlib.Path('package.json'); d = json.loads(p.read_text(encoding='utf-8'))
old = d['version']
d['version'] = V
p.write_text(json.dumps(d, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
print(f'✓ package.json  {old} → {V}')

# ② android/app/build.gradle：versionName + versionCode 单调递增
g = pathlib.Path('android/app/build.gradle'); s = g.read_text(encoding='utf-8')
m = re.search(r'versionCode\s+(\d+)', s)
if not m:
    sys.exit('❌ build.gradle 里找不到 versionCode')
code = int(m.group(1))
s = re.sub(r'versionCode\s+\d+', f'versionCode {code + 1}', s, count=1)
s = re.sub(r'versionName\s+"[^"]+"', f'versionName "{V}"', s, count=1)
g.write_text(s, encoding='utf-8')
print(f'✓ build.gradle  versionName → {V}，versionCode {code} → {code + 1}')
PYEOF

python3 tools/prepare_www.py > /dev/null
python3 tools/gh_push.py "v$VER $DESC" --tag="v$VER"
echo ""
echo "✅ 已推送 v$VER 并打 tag，云端构建约 3~5 分钟："
echo "   https://github.com/AATINF/collage-helper/actions"
echo "   完成后下载：https://github.com/AATINF/collage-helper/releases/latest/download/collage-helper.apk"
