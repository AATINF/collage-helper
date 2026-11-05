#!/usr/bin/env python3
"""把 4 个签名相关的 Secret 写入 GitHub 仓库（用 libsodium sealed box 加密后通过 API 上传）。

用法：
    python3 tools/set_secrets.py            # 读取 keystore/keystore.b64 和 keystore/password.txt
"""
import base64
import json
import pathlib
import sys
import urllib.request

from nacl import encoding, public

OWNER, REPO = 'AATINF', 'collage-helper'
API = 'https://api.github.com'
ROOT = pathlib.Path(__file__).resolve().parent.parent
TOKEN = open('/root/.git-credentials').read().split('//')[1].split(':')[1].split('@')[0]
H = {'Authorization': 'token ' + TOKEN, 'User-Agent': 'dsh', 'Accept': 'application/vnd.github+json'}


def call(method, path, payload=None):
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(API + path, data=data, headers={**H, 'Content-Type': 'application/json'}, method=method)
    with urllib.request.urlopen(req, timeout=30) as r:
        body = r.read().decode()
        return json.loads(body) if body.strip() else {}


def encrypt(pub_key_b64: str, value: str) -> str:
    pk = public.PublicKey(pub_key_b64.encode(), encoding.Base64Encoder)
    sealed = public.SealedBox(pk).encrypt(value.encode())
    return base64.b64encode(sealed).decode()


def main():
    b64_path = ROOT / 'keystore/keystore.b64'
    pwd_path = ROOT / 'keystore/password.txt'
    if not b64_path.exists() or not pwd_path.exists():
        sys.exit('缺少 keystore/keystore.b64 或 keystore/password.txt')

    keystore_b64 = b64_path.read_text().strip()
    if '\n' in keystore_b64:
        sys.exit('keystore.b64 里有多行，必须是一整行（用 base64 -w0 生成）')
    password = pwd_path.read_text().strip()
    alias = 'appkey'

    key = call('GET', f'/repos/{OWNER}/{REPO}/actions/secrets/public-key')
    secrets = {
        'KEYSTORE_B64': keystore_b64,
        'KEYSTORE_PASSWORD': password,
        'KEY_ALIAS': alias,
        'KEY_PASSWORD': password,
    }
    for name, value in secrets.items():
        call('PUT', f'/repos/{OWNER}/{REPO}/actions/secrets/{name}',
             {'encrypted_value': encrypt(key['key'], value), 'key_id': key['key_id']})
        print(f'  ✓ {name}（{len(value)} 字符）')

    got = call('GET', f'/repos/{OWNER}/{REPO}/actions/secrets')
    print('仓库现有 Secrets：', ', '.join(s['name'] for s in got.get('secrets', [])))


if __name__ == '__main__':
    main()
