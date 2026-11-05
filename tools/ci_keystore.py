#!/usr/bin/env python3
"""触发 GitHub Actions 里的一次性 keystore 生成任务，等它跑完，把 keystore.b64 下载到本地。

用法：python3 tools/ci_keystore.py
前提：.github/workflows/keystore-once.yml 已在 main 分支上，且 3 个密码类 Secret 已配置。
"""
import io
import json
import pathlib
import sys
import time
import urllib.request
import zipfile

OWNER, REPO = 'AATINF', 'collage-helper'
WORKFLOW = 'keystore-once.yml'
API = 'https://api.github.com'
ROOT = pathlib.Path(__file__).resolve().parent.parent
TOKEN = open('/root/.git-credentials').read().split('//')[1].split(':')[1].split('@')[0]
H = {'Authorization': 'token ' + TOKEN, 'User-Agent': 'dsh', 'Accept': 'application/vnd.github+json'}


def call(method, path, payload=None):
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(API + path, data=data,
                                 headers={**H, 'Content-Type': 'application/json'}, method=method)
    with urllib.request.urlopen(req, timeout=30) as r:
        body = r.read().decode()
        return json.loads(body) if body.strip() else {}


def dispatch():
    call('POST', f'/repos/{OWNER}/{REPO}/actions/workflows/{WORKFLOW}/dispatches', {'ref': 'main'})
    print('已触发 keystore-once')


def latest_run():
    d = call('GET', f'/repos/{OWNER}/{REPO}/actions/workflows/{WORKFLOW}/runs?per_page=1')
    runs = d.get('workflow_runs', [])
    return runs[0] if runs else None


def wait_run(timeout=240):
    start = time.time()
    while time.time() - start < timeout:
        r = latest_run()
        if r:
            st = f"{r['status']}/{r.get('conclusion')}"
            print(f'  状态 {st}（第 {int(time.time() - start)}s）')
            if r['status'] == 'completed':
                return r
        time.sleep(6)
    return None


def download_artifact(run_id):
    arts = call('GET', f'/repos/{OWNER}/{REPO}/actions/runs/{run_id}/artifacts')['artifacts']
    target = next((a for a in arts if a['name'] == 'keystore'), None)
    if not target:
        sys.exit('没找到 keystore artifact')
    url = f"{API}/repos/{OWNER}/{REPO}/actions/artifacts/{target['id']}/zip"
    req = urllib.request.Request(url, headers=H)
    with urllib.request.urlopen(req, timeout=60) as r:
        data = r.read()
    z = zipfile.ZipFile(io.BytesIO(data))
    name = z.namelist()[0]
    content = z.read(name).decode().strip()
    out = ROOT / 'keystore/keystore.b64'
    out.write_text(content + '\n')
    out.chmod(0o600)
    print(f'✅ 已保存 {out}（{len(content)} 字符，单行：{"是" if chr(10) not in content else "否"}）')
    return content


if __name__ == '__main__':
    dispatch()
    time.sleep(6)
    run = wait_run()
    if not run:
        sys.exit('等待超时，去 Actions 页面看看')
    if run.get('conclusion') != 'success':
        sys.exit(f"构建失败：{run.get('conclusion')}，看 {run['html_url']}")
    download_artifact(run['id'])
