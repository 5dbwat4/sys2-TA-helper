"""Server-side ZJUAM login, ported from the `login-zju` npm package (github.com/5dbwat4/login-ZJU).

Flow:
  1. GET  https://zjuam.zju.edu.cn/cas/login          -> scrape `name="execution" value="..."`
  2. GET  https://zjuam.zju.edu.cn/cas/v2/getPubKey    -> {modulus, exponent}
  3. RSA-encrypt password: bigint(password bytes) ^ exponent mod modulus, hex, zero-padded
  4. POST /cas/login with username/password/execution/_eventId=submit/authcode
     302 -> success, 200 -> failure (error message in <span id="msg">)
"""
import re

import requests

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0")

CAS_LOGIN = "https://zjuam.zju.edu.cn/cas/login"
PUBKEY_URL = "https://zjuam.zju.edu.cn/cas/v2/getPubKey"


def rsa_encrypt(password: str, modulus_hex: str, exponent_hex: str) -> str:
    pwd = 0
    for ch in password:
        pwd = pwd * 256 + ord(ch)
    m = int(modulus_hex, 16)
    e = int(exponent_hex, 16)
    return format(pow(pwd, e, m), "x").zfill(len(modulus_hex))


def zjuam_verify(username: str, password: str, timeout: int = 20):
    """Return (ok, message). ok=True means the credentials are valid."""
    s = requests.Session()
    s.headers.update({"User-Agent": UA})
    try:
        r = s.get(CAS_LOGIN, timeout=timeout)
        m = re.search(r'name="execution" value="([^"]+)"', r.text)
        if not m:
            return False, "无法获取登录页面，请稍后再试"
        execution = m.group(1)
        pub = s.get(PUBKEY_URL, timeout=timeout).json()
        enc = rsa_encrypt(password, pub["modulus"], pub["exponent"])
        r = s.post(
            CAS_LOGIN,
            data={"username": username, "password": enc, "execution": execution,
                  "_eventId": "submit", "authcode": ""},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            allow_redirects=False, timeout=timeout)
        if r.status_code == 302:
            return True, None
        return False, "账号或密码错误"
    except Exception as exc:  # network / parse errors
        return False, f"统一身份认证暂时不可用（{type(exc).__name__}）"
