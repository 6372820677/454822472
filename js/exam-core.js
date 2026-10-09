// 考试核心纯函数 / Exam core pure helpers
// 本文件中的函数均不依赖 DOM、不读写 localStorage，可在浏览器中通过 <script> 引入，
// 也可以在 Node.js 中通过 require 引入用于自动化测试（见 tests/）。

// 将秒数格式化为 "HH:MM:SS"
// 传入负数或非法值时按 0 处理，避免出现 "-1:-10:00" 这类乱码
function formatTime(seconds) {
  const totalSeconds = Math.max(0, Math.floor(Number(seconds) || 0));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

// 计算结束时间（处理跨日期的情况）
function calculateEndTime(startTime, durationMinutes) {
  const [hours, minutes] = startTime.split(":").map(Number);
  const endTime = new Date(2000, 0, 1, hours, minutes);

  // 如果开始时间加上持续时间超过了24小时，则需要处理跨日期的情况
  endTime.setMinutes(endTime.getMinutes() + (Number(durationMinutes) || 0));

  const timeStr = `${endTime.getHours().toString().padStart(2, "0")}:${endTime.getMinutes().toString().padStart(2, "0")}`;
  const isNextDay = endTime.getDate() > 1 || endTime.getHours() < hours;
  return isNextDay ? `${timeStr} (次日)` : timeStr;
}

// 验证和格式化时间
function validateAndFormatTime(timeString) {
  if (!timeString || !timeString.trim()) {
    return null;
  }

  const timePattern = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;
  if (timePattern.test(timeString)) {
    // 格式化时间（确保小时和分钟都是两位数）
    const [hours, minutes] = timeString.split(":");
    return `${parseInt(hours).toString().padStart(2, "0")}:${parseInt(minutes).toString().padStart(2, "0")}`;
  }

  // 尝试修复格式
  const numbers = timeString.replace(/[^\d]/g, "");
  if (numbers.length >= 2) {
    const hours = parseInt(numbers.substring(0, 2));
    const minutes = numbers.length >= 4 ? parseInt(numbers.substring(2, 4)) : 0;

    if (hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59) {
      return `${hours.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}`;
    }
  }

  return null;
}

// 判断某个环节是否为自定义考试页面自动附加的"考试结束"占位行
function isEndPlaceholderSection(section) {
  if (!section) {
    return false;
  }
  return section.name === "考试结束" && !(Number(section.duration) > 0);
}

// 把 "HH:MM" 的开始时间加上偏移分钟数，返回 "HH:MM"（跨天自动取模）
function offsetClockTime(startTime, offsetMinutes) {
  const [hours, minutes] = String(startTime || "00:00").split(":").map(Number);
  const time = new Date(2000, 0, 1, hours || 0, minutes || 0);
  time.setMinutes(time.getMinutes() + offsetMinutes);
  return `${time.getHours().toString().padStart(2, "0")}:${time.getMinutes().toString().padStart(2, "0")}`;
}

// 自定义考试对象 → 首页环节数组（纯函数，无 DOM 依赖）
// 语义：
//   1. 计入总时间的环节按自身时长依次拼接；
//   2. 不计入总时间的环节退化为零时长占位（start === end），
//      位置等于它之前所有"计入"环节的时长之和，因此不会挤占倒计时；
//   3. 末尾固定追加一个"考试结束"环节，位于 start = end = 总时长处。
function convertCustomExamToSections(customExam) {
  const sections = [];
  const sourceSections =
    customExam && Array.isArray(customExam.sections) ? customExam.sections : [];
  const startTime = (customExam && customExam.startTime) || "00:00";

  // 已累计的"计入总时间"分钟数，同时也是不计时环节的占位位置
  let elapsed = 0;

  sourceSections.forEach((section) => {
    // 自动附加的"考试结束"占位行会在末尾统一生成，避免重复
    if (isEndPlaceholderSection(section)) {
      return;
    }

    const duration = Number(section.duration) || 0;
    const countInTotal = section.countInTotal !== false;
    const start = elapsed;
    const end = countInTotal ? elapsed + duration : elapsed;

    sections.push({
      name: section.name,
      start: start,
      duration: duration,
      end: end,
      description: section.description || section.name,
      realTime: `${offsetClockTime(startTime, start)}-${offsetClockTime(startTime, end)}`,
      countInTotal: countInTotal,
    });

    if (countInTotal) {
      elapsed = end;
    }
  });

  sections.push({
    name: "考试结束",
    start: elapsed,
    duration: 0,
    end: elapsed,
    description: "考试结束",
    realTime: offsetClockTime(startTime, elapsed),
  });

  return sections;
}

// 从环节数组反推总时长（最后一个"考试结束"环节所在的位置即总时长）
// 这样标题区、时间线末端与"总时间"统计永远来自同一个数字
function getSectionsTotalMinutes(sections) {
  if (!Array.isArray(sections) || sections.length === 0) {
    return 0;
  }
  const lastSection = sections[sections.length - 1];
  return lastSection && Number.isFinite(lastSection.end) ? lastSection.end : 0;
}

// 供 Node.js 单元测试使用；浏览器中 module 未定义，此分支不会执行
if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    formatTime,
    calculateEndTime,
    validateAndFormatTime,
    convertCustomExamToSections,
    getSectionsTotalMinutes,
  };
}
