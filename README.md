# teach-assist

浙江大学「计算机系统II」助教相关工具集。

## 目录

| 目录 | 说明 |
| --- | --- |
| [`ta-web/`](ta-web/) | 课程用户系统（Flask，部署于 `ta.alabtnt.cn`）：学生查成绩，助教 / 教师批改作业 |
| [`zju-course/`](zju-course/) | 学在浙大（`courses.zju.edu.cn`）相关脚本：ZJUAM 登录、课程信息拉取、作业发布 |

## ta-web

- 学生：学号 + 姓名登录 → 查看本人成绩
- 教师：固定账号（默认 `SysTeacher`）+ 密码
- 助教：ZJUAM 登录，仅允许指定学号尾号（页面不提示该限制）
- 成绩模块与用户系统贯通：助教 / 教师可编辑、批量录入、按尾号批改

详见 [`ta-web/README.md`](ta-web/README.md)。

## zju-course

- `zju_login.py`：ZJUAM 统一身份认证（服务端，RSA 加密密码）→ 登录 `courses.zju.edu.cn`
- `zju_course.py`：拉取课程页面 / 接口，列出课程
- `zju_create_homework.py`：在某课程下新建 / 发布作业
- `NOTES.md`：登录与作业 API 的技术细节

### 关键技术点

- ZJUAM 密码为**裸模幂** RSA（非标准 PKCS#1）：`pow(bigint(password), exponent, modulus)` 转 hex 补零。
- `courses.zju.edu.cn` 使用 1024-bit DH 参数，OpenSSL 3 默认拒绝，需要 `DEFAULT@SECLEVEL=1`。
- 作业时间字段用 **UTC**（北京时间 −8h）。
- 新建作业：`POST /api/courses/{course_id}/activities`；发布：`PUT /api/activities/{id}`（该 PUT 常返回 500 但已生效，以随后 GET 为准）。

## 安全

**请勿把任何密码、`secret.key`、真实名单 / 成绩提交进仓库。** 相关文件已在 `.gitignore` 中排除，配置请从 `*.example.json` 复制后填写。

## License

GPL-3.0（见 [LICENSE](LICENSE)）
