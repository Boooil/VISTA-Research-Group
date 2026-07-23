# VISTA Research Group 首页团队手风琴测试规格

本文档是 **VISTA Research Group 网站首页团队手风琴** 的测试用例规格书。

## L4 浏览器验收

| ID | 用例 | 验收标准 |
|:---|:-----|:---------|
| TEAM-UI-1 | 初始状态 | 所有非空分组默认关闭；摘要显示正确人数和最多 4 个头像；`+N` 位于头像组最右侧、展开箭头左侧 |
| TEAM-UI-2 | 单组展开 | 点击分组展开卡片；打开其他分组时旧分组关闭；再次点击当前分组可关闭 |
| TEAM-UI-3 | 可访问性与响应式 | Enter/Space 可切换；手机和深色模式无横向溢出；reduced-motion 禁用过渡 |

## 运行方式

```powershell
hugo server --disableFastRender --bind 127.0.0.1 --port 1313
playwright-cli -s=team-accordion open http://127.0.0.1:1313/ --browser=chrome
playwright-cli -s=team-accordion run-code --filename=web-app-test/scripts/team-accordion.e2e.js
playwright-cli -s=team-accordion close
```

## 脚本清单

| 脚本 | 对应层 | 覆盖用例 |
|:-----|:------:|:---------|
| `web-app-test/scripts/team-accordion.e2e.js` | L4 | TEAM-UI-1 至 TEAM-UI-3 |

## 测试环境

| 项 | 值 |
|:---|:---|
| 首页本地服务 | `hugo server --disableFastRender --bind 127.0.0.1 --port 1313` |
| 健康检查 | `http://127.0.0.1:1313/` |
| 浏览器 | Playwright CLI + Chrome |
| 桌面视口 | `1440x900` |
| 手机视口 | `390x844` |
| 端口冲突处理 | 选择空闲端口，并同步调整脚本中的本地地址后运行 |
