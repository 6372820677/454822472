# SUBMISSION.md

基线提交：`21fc2141a49c2517416440ae28701586ae93fe9d`（exam-clock）
测试：`npm test`（零依赖、离线）→ **pass 15 / fail 0，退出码 0**

## T1 缺陷修复（40%）

新增纯函数 `convertCustomExamToSections`（`js/exam-core.js`）：计入环节依次拼接，不计入环节为零时长占位（不推进时间），末尾只追加一个"考试结束"于总时长处。总时长由 `getSectionsTotalMinutes` 从结果推导，保证标题时间段、时间线末端与"总时间"一致；环节保留 `countInTotal`，零时长显示"（不计时）"。三种跳转统一走 `jumpToSection` + `clampTimeLeft`，倒计时钳制在 `[0,totalTime]`。另修两处前置缺陷：采集时跳过自动"考试结束"行（曾 alert 中断保存）、`initializeGlobals` 执行顺序（原会覆盖已应用的考试）。

## T2 功能实现（35%）

Web Audio 合成提示音（OscillatorNode + GainNode 包络约 240ms），无外部音频。三种入口共用 `jumpToSection` 与 `suppressSectionNotify`，保证每次切换只响一次：自然跨环节、"下一环节"、下拉框跳转。新增设置项 `showSectionSound`（默认开），按现有显示设置的读取、应用、切换、恢复默认与复选框同步四处全部扩展，并持久化到 `localStorage.displaySettings`；旧三项配置无此键时保留当前值。视觉提示为当前环节闪烁 1.5 秒，与提示音同一开关。AudioContext 首次用户手势时才创建，`resume()` 已 catch，无未捕获错误。合成音无新增资源，PWA 同步项不适用。

## T3 自动化测试（20%）

仓库根新增 `package.json`，`npm test` = `node --test tests/`，零依赖、离线、退出码 0。为不改浏览器行为又便于测试，将 `formatTime`、`calculateEndTime`、`validateAndFormatTime` 与新增的转换函数集中到 `js/exam-core.js`（末尾 `module.exports` 守卫），两个页面在依赖脚本前引入，原实现删除以保证唯一。`tests/exam-core.test.js` 共 15 例，覆盖 `formatTime` 边界与负数钳 0、`calculateEndTime` 跨天与零时长、`validateAndFormatTime` 规范化与非法输入、T1 fixture 各环节 `start`/`end`/`realTime` 与"考试结束"= 120、全部不计入时总时长为 0。
