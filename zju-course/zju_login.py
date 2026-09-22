#!/usr/bin/env python3
"""Minimal ZJUAM -> courses.zju.edu.cn login, replicating the `login-zju` npm flow."""
import base64
import os
import re
import ssl
import sys
import urllib.parse

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.ssl_ import create_urllib3_context

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0")

# 2025 student course that must be ignored
IGNORED_COURSES = {"87493"}


def make_legacy_ssl_context():
    """courses.zju.edu.cn serves a 1024-bit DH key; OpenSSL 3 rejects it by default."""
    ctx = create_urllib3_context()
    ctx.set_ciphers("DEFAULT@SECLEVEL=1")
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return ctx


class LegacySSLAdapter(HTTPAdapter):
    def __init__(self, *a, **kw):
        self._ctx = make_legacy_ssl_context()
        super().__init__(*a, **kw)

    def init_poolmanager(self, *a, **kw):
        kw["ssl_context"] = self._ctx
        return super().init_poolmanager(*a, **kw)


def make_session():
    s = requests.Session()
    s.mount("https://", LegacySSLAdapter())
    s.headers.update({
        "User-Agent": UA,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
    })
    return s


def rsa_encrypt(password: str, modulus_hex: str, exponent_hex: str) -> str:
    pwd = 0
    for ch in password:
        pwd = (pwd << 8) + ord(ch)
    m = int(modulus_hex, 16)
    e = int(exponent_hex, 16)
    c = pow(pwd, e, m)
    h = hex(c)[2:]
    if len(h) % 2:
        h = "0" + h
    raw = bytes.fromhex(h)
    return base64.b64encode(raw).decode()


class ZJUAM:
    def __init__(self, username, password):
        self.username = username
        self.password = password
        self.s = make_session()

    def login(self):
        r1 = self.s.get("https://zjuam.zju.edu.cn/cas/login", timeout=15)
        m = re.search(r'name="execution" value="([^"]+)"', r1.text)
        if not m:
            raise RuntimeError("no execution token")
        execution = m.group(1)

        r2 = self.s.get("https://zjuam.zju.edu.cn/cas/v2/getPubKey", timeout=15)
        k = r2.json()
        password_enc = rsa_encrypt(self.password, k["modulus"], k["exponent"])

        r3 = self.s.post(
            "https://zjuam.zju.edu.cn/cas/login",
            data={
                "username": self.username,
                "password": password_enc,
                "execution": execution,
                "_eventId": "submit",
                "authcode": "",
            },
            allow_redirects=False,
            timeout=15,
        )
        if r3.status_code == 302 and "Location" in r3.headers:
            return r3.headers["Location"]
        raise RuntimeError(f"login failed: {r3.status_code}")

    def login_service(self, service_url, max_hops=15):
        e = service_url
        for _ in range(max_hops):
            host = urllib.parse.urlsplit(e).hostname or ""
            if host == "zjuam.zju.edu.cn":
                break
            r = self.s.get(e, allow_redirects=False, timeout=15)
            if 300 <= r.status_code < 400 and "Location" in r.headers:
                e = urllib.parse.urljoin(e, r.headers["Location"])
            else:
                return r

        r = self.s.get(e, allow_redirects=False, timeout=15)
        loc = r.headers.get("Location")
        for _ in range(max_hops):
            if not loc:
                break
            r = self.s.get(loc, allow_redirects=False, timeout=15)
            m = re.search(r'meta http-equiv="refresh" content="0;URL=([^"]+)"', r.text)
            if r.status_code == 200 and m:
                loc = m.group(1).replace("&amp;", "&")
                continue
            if 300 <= r.status_code < 400 and "Location" in r.headers:
                loc = urllib.parse.urljoin(loc, r.headers["Location"])
                continue
            break
        return r


MY_COURSES_BODY = {
    "fields": "id,name,course_code,department(id,name),grade(id,name),klass(id,name),course_type,start_date,end_date,is_started,is_closed,credit,compulsory,second_name,display_name,created_user(id,name),is_instructor,is_team_teaching,instructors(id,name,email)",
    "page": 1, "page_size": 1000,
    "conditions": {"status": ["ongoing", "notStarted", "closed"], "keyword": "", "classify_type": "recently_started", "display_studio_list": False},
    "showScorePassedStatus": False,
}


def main():
    u = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("ZJU_USERNAME", "")
    p = sys.argv[2] if len(sys.argv) > 2 else os.environ.get("ZJU_PASSWORD", "")
    if not u or not p:
        sys.exit("Usage: python3 zju_login.py <user> <pass>")

    am = ZJUAM(u, p)
    loc = am.login()
    print("[ZJUAM] login ok, redirect:", loc)

    r = am.login_service("https://courses.zju.edu.cn/user/index")
    print("[COURSES] final:", r.status_code, r.url)

    r = am.s.post("https://courses.zju.edu.cn/api/my-courses", json=MY_COURSES_BODY,
                  headers={"Content-Type": "application/json"}, timeout=30)
    print("[COURSES] my-courses:", r.status_code)
    try:
        data = r.json()
    except Exception:
        print(r.text[:500])
        return
    courses = data.get("courses", [])
    
    # Filter: ONLY 2026 TA courses, explicitly IGNORE 2025 student courses (e.g. 87493)
    ta_courses = []
    for c in courses:
        cid = str(c.get("id"))
        if cid in IGNORED_COURSES:
            continue
        if not c.get("is_instructor"):
            continue
        code = c.get("course_code") or ""
        sdate = c.get("start_date") or ""
        if "2026-2027" in code or sdate.startswith("2026"):
            ta_courses.append(c)

    print(f"检测到 {len(ta_courses)} 门有效助教课程 (已自动过滤 2025 及学生身份课程):")
    for c in ta_courses:
        instr = ",".join(i.get("name", "") for i in (c.get("instructors") or []))
        print(f"  id={c.get('id')}  name={c.get('name')}  code={c.get('course_code')}  instructors={instr}  is_instructor={c.get('is_instructor')}")


if __name__ == "__main__":
    main()
