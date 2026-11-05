#!/usr/bin/env python3
"""把当前工作区（遵守 .gitignore）同步到 GitHub，走 Git Data API。

为什么不用 `git push`：这台机器的 git 走 GnuTLS，推 GitHub 会
`GnuTLS recv error (-110)` 直接断连；而 api.github.com 是通的（0.5s）。
所以用 REST API 建 blob → tree → commit → 更新 ref，等价于一次 push。

用法：
    python3 tools/gh_push.py "提交说明"      # 首次会自动创建 refs/heads/main
"""
import base64
import pathlib
import concurrent.futures as cf
import json
import subprocess
import sys
import urllib.error
import urllib.request

OWNER, REPO, BRANCH = 'AATINF', 'collage-helper', 'main'
API = 'https://api.github.com'
TOKEN = open('/root/.git-credentials').read().split('//')[1].split(':')[1].split('@')[0]
H = {'Authorization': 'token ' + TOKEN, 'User-Agent': 'dsh', 'Accept': 'application/vnd.github+json'}


def call(method, path, payload=None, ok=(200, 201, 204)):
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(API + path, data=data, headers={**H, 'Content-Type': 'application/json'}, method=method)
    try:
        r = urllib.request.urlopen(req, timeout=30)
        body = r.read().decode()
        return json.loads(body) if body.strip() else {}
    except urllib.error.HTTPError as e:
        if e.code in ok:
            return {}
        raise SystemExit(f'{method} {path} -> {e.code} {e.read().decode()[:300]}')


def working_files():
    """git ls-files 的已跟踪 + 未忽略的未跟踪文件。"""
    out = subprocess.run(['git', 'ls-files', '-co', '--exclude-standard'],
                         capture_output=True, text=True, check=True).stdout
    files = [f for f in out.splitlines() if f.strip()]
    skip = ('node_modules/', 'www/', '.git/')
    # 已从磁盘删除的文件不该再上传（git ls-files 仍会列出已跟踪但删除的文件）
    return [f for f in files if not f.startswith(skip) and pathlib.Path(f).is_file()]


def blob(path):
    raw = open(path, 'rb').read()
    d = call('POST', f'/repos/{OWNER}/{REPO}/git/blobs',
             {'content': base64.b64encode(raw).decode(), 'encoding': 'base64'})
    return {'path': path, 'mode': '100644', 'type': 'blob', 'sha': d['sha']}


def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--tag=')]
    tag = next((a.split('=', 1)[1] for a in sys.argv[1:] if a.startswith('--tag=')), None)
    msg = args[0] if args else 'chore: sync'
    files = working_files()
    print(f'待上传 {len(files)} 个文件…')

    parent = None
    try:
        ref = call('GET', f'/repos/{OWNER}/{REPO}/git/ref/heads/{BRANCH}')
        parent = ref['object']['sha']
    except SystemExit:
        # 空仓库必须先有一个提交，Git Data API 才能用（否则 409 Git Repository is empty）
        print('（空仓库：先建 README 初始化）')
        call('PUT', f'/repos/{OWNER}/{REPO}/contents/README.md', {
            'message': 'chore: init',
            'content': base64.b64encode('项目初始化'.encode()).decode(),
        })
        parent = call('GET', f'/repos/{OWNER}/{REPO}/git/ref/heads/{BRANCH}')['object']['sha']
        print('  初始化提交', parent[:8])

    with cf.ThreadPoolExecutor(8) as ex:
        tree = list(ex.map(blob, files))
    print(f'  blob 上传完成 {len(tree)} 个')

    tree_payload = {'tree': tree}
    t = call('POST', f'/repos/{OWNER}/{REPO}/git/trees', tree_payload)['sha']
    c = call('POST', f'/repos/{OWNER}/{REPO}/git/commits',
             {'message': msg, 'tree': t, 'parents': [parent] if parent else []})['sha']

    if parent:
        call('PATCH', f'/repos/{OWNER}/{REPO}/git/refs/heads/{BRANCH}', {'sha': c, 'force': True})
    else:
        call('POST', f'/repos/{OWNER}/{REPO}/git/refs', {'ref': f'refs/heads/{BRANCH}', 'sha': c})

    # 打 tag 会触发 GitHub Actions 构建
    if tag:
        try:
            call('POST', f'/repos/{OWNER}/{REPO}/git/refs',
                 {'ref': f'refs/tags/{tag}', 'sha': c})
            print(f'🏷  tag {tag} 已创建')
        except SystemExit as e:
            print('tag 创建失败（可能已存在）：', e)

    # 本地也留一条提交记录，方便以后对账/回滚
    subprocess.run(['git', 'add', '-A'], check=True)
    subprocess.run(['git', 'commit', '-qm', msg], check=False)
    print(f'✅ 已同步到 https://github.com/{OWNER}/{REPO}  提交 {c[:8]}  {msg}')


if __name__ == '__main__':
    main()
