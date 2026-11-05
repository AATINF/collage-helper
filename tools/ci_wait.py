#!/usr/bin/env python3
"""等一次 workflow 跑完，打印状态。用法：python3 tools/ci_wait.py [workflow文件名] [超时秒]"""
import json, sys, time, urllib.request
OWNER, REPO = 'AATINF', 'collage-helper'
API = 'https://api.github.com'
TOKEN = open('/root/.git-credentials').read().split('//')[1].split(':')[1].split('@')[0]
H = {'Authorization': 'token ' + TOKEN, 'User-Agent': 'dsh', 'Accept': 'application/vnd.github+json'}

def get(path):
    req = urllib.request.Request(API + path, headers=H)
    with urllib.request.urlopen(req, timeout=30) as r:
        return json.loads(r.read().decode())

wf = sys.argv[1] if len(sys.argv) > 1 else 'android.yml'
timeout = int(sys.argv[2]) if len(sys.argv) > 2 else 900
start = time.time()
last = None
while time.time() - start < timeout:
    runs = get(f'/repos/{OWNER}/{REPO}/actions/workflows/{wf}/runs?per_page=1').get('workflow_runs', [])
    if runs:
        r = runs[0]
        st = f"{r['status']}/{r.get('conclusion')}"
        if st != last:
            print(f"[{int(time.time()-start)}s] {st}  {r['html_url']}", flush=True)
            last = st
        if r['status'] == 'completed':
            sys.exit(0 if r.get('conclusion') == 'success' else 1)
    time.sleep(10)
print('超时', flush=True)
sys.exit(2)
