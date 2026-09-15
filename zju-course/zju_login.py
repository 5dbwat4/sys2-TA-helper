#!/usr/bin/env python3
"""Minimal ZJUAM -> courses.zju.edu.cn login, replicating the `login-zju` npm flow."""
import json
import os
import re
import sys
import urllib.parse

import ssl

import requests
from requests.adapters import HTTPAdapter
from urllib3.util.ssl_ import create_urllib3_context

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0")


class LegacySSLAdapter(HTTPAdapter):
    """courses.zju.edu.cn serves a 1024-bit DH key; OpenSSL 3 rejects it by default."""

    def init_poolmanager(self, *args, **kwargs):
        ctx = create_urllib3_context()
        ctx.set_ciphers("DEFAULT@SECLEVEL=1")
        kwargs["ssl_context"] = ctx
        return super().init_poolmanager(*args, **kwargs)


def make_session():
    s = requests.Session()
    s.headers.update({"User-Agent": UA})
    s.mount("https://", LegacySSLAdapter())
    return s


def rsa_encrypt(password: str, modulus_hex: str, exponent_hex: str) -> str:
    pwd = 0
    for ch in password:
        pwd = pwd * 256 + ord(ch)
    m = int(modulus_hex, 16)
    e = int(exponent_hex, 16)
    return format(pow(pwd, e, m), "x").zfill(len(modulus_hex))


class ZJUAM:
    def __init__(self, username, password):
        self.username = username
        self.password = password
        self.s = make_session()
        self.logged_in = False

    def login(self):
        login_url = "https://zjuam.zju.edu.cn/cas/login"
        r = self.s.get(login_url, timeout=20)
        m = re.search(r'name="execution" value="([^"]+)"', r.text)
        if not m:
            raise RuntimeError("no execution in CAS login page")
        execution = m.group(1)
        pub = self.s.get("https://zjuam.zju.edu.cn/cas/v2/getPubKey", timeout=20).json()
        enc = rsa_encrypt(self.password, pub["modulus"], pub["exponent"])
        r = self.s.post(
            login_url,
            data={"username": self.username, "password": enc, "execution": execution,
                  "_eventId": "submit", "authcode": ""},
            headers={"Content-Type": "application/x-www-form-urlencoded"},
            allow_redirects=False, timeout=20)
        if r.status_code == 302:
            self.logged_in = True
            return r.headers.get("Location")
        msg = re.search(r'<span id="msg">([^<]+)</span>', r.text)
        raise RuntimeError(f"ZJUAM login failed status={r.status_code} msg={msg.group(1) if msg else r.text[:300]}")

    def login_service(self, service_url, max_hops=15):
        """Follow the CAS dance to obtain cookies for `service_url`'s host."""
        e = service_url
        for _ in range(max_hops):
            host = urllib.parse.urlparse(e).hostname
            if host == "zjuam.zju.edu.cn":
                break
            r = self.s.get(e, allow_redirects=False, timeout=20)
            loc = r.headers.get("Location")
            if not loc:
                return r
            e = urllib.parse.urljoin(e, loc)
        # e is now the CAS login URL with ?service=
        r = self.s.get(e, allow_redirects=False, timeout=20)
        loc = r.headers.get("Location")
        for _ in range(max_hops):
            if not loc:
                break
            r = self.s.get(loc, allow_redirects=False, timeout=20)
            m = re.search(r'meta http-equiv="refresh" content="0;URL=([^"]+)"', r.text)
            if r.status_code == 200 and m:
                loc = m.group(1)
                continue
            if 300 <= r.status_code < 400:
                loc = r.headers.get("Location")
                continue
            break
        return r


MY_COURSES_BODY = {
    "fields": "id,name,course_code,department(id,name),grade(id,name),klass(id,name),course_type,"
              "start_date,end_date,is_started,is_closed,credit,compulsory,second_name,display_name,"
              "created_user(id,name),is_instructor,is_team_teaching,instructors(id,name,email)",
    "page": 1, "page_size": 1000,
    "conditions": {"status": ["ongoing", "notStarted", "closed"], "keyword": "",
                   "classify_type": "recently_started", "display_studio_list": False},
    "showScorePassedStatus": False,
}


def main():
    username = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("ZJU_USERNAME", "")
    password = sys.argv[2] if len(sys.argv) > 2 else os.environ.get("ZJU_PASSWORD", "")
    if not username or not password:
        sys.exit("用法: python3 zju_login.py <学号> <密码>   （或设置 ZJU_USERNAME / ZJU_PASSWORD）")
    am = ZJUAM(username, password)
    loc = am.login()
    print("[ZJUAM] login ok, redirect:", loc)

    r = am.login_service("https://courses.zju.edu.cn/user/index")
    print("[COURSES] final:", r.status_code, r.url)
    print("[COURSES] cookies:", {c.name: c.value[:12] + "..." for c in am.s.cookies})

    r = am.s.post("https://courses.zju.edu.cn/api/my-courses", json=MY_COURSES_BODY,
                  headers={"Content-Type": "application/json"}, timeout=30)
    print("[COURSES] my-courses:", r.status_code)
    try:
        data = r.json()
    except Exception:
        print(r.text[:500])
        return
    courses = data.get("courses", [])
    print(f"共 {len(courses)} 门课程:")
    for c in courses:
        instr = ",".join(i.get("name", "") for i in (c.get("instructors") or []))
        print(f"  id={c.get('id')}  name={c.get('name')}  code={c.get('course_code')}  instructors={instr}  is_instructor={c.get('is_instructor')}")


if __name__ == "__main__":
    main()
