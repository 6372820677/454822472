// 考试核心纯函数单元测试
// 运行方式：npm test（等价于 node --test tests/）
// 依赖：仅使用 Node.js >= 18 内置的 node:test 与 node:assert，完全离线

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  formatTime,
  calculateEndTime,
  validateAndFormatTime,
  convertCustomExamToSections,
  getSectionsTotalMinutes,
} = require("../js/exam-core.js");

// ---------- formatTime ----------

test("formatTime: 秒数格式化为 HH:MM:SS", () => {
  assert.equal(formatTime(0), "00:00:00");
  assert.equal(formatTime(59), "00:00:59");
  assert.equal(formatTime(60), "00:01:00");
  assert.equal(formatTime(7325), "02:02:05");
  assert.equal(formatTime(3600), "01:00:00");
  assert.equal(formatTime(140 * 60), "02:20:00");
});

test("formatTime: 负数与非法输入钳制为 00:00:00（不出现 -1:-10:00 这类乱码）", () => {
  assert.equal(formatTime(-1), "00:00:00");
  assert.equal(formatTime(-600), "00:00:00");
  assert.equal(formatTime(NaN), "00:00:00");
  assert.equal(formatTime(undefined), "00:00:00");
});

// ---------- calculateEndTime ----------

test("calculateEndTime: 同一天内结束", () => {
  assert.equal(calculateEndTime("09:00", 120), "11:00");
  assert.equal(calculateEndTime("18:00", 120), "20:00");
});

test("calculateEndTime: 跨天时标注 (次日)", () => {
  assert.equal(calculateEndTime("23:30", 120), "01:30 (次日)");
});

test("calculateEndTime: 时长为 0", () => {
  assert.equal(calculateEndTime("00:00", 0), "00:00");
});

// ---------- validateAndFormatTime ----------

test("validateAndFormatTime: 合法时间被规范化", () => {
  assert.equal(validateAndFormatTime("09:30"), "09:30");
  assert.equal(validateAndFormatTime("9:30"), "09:30");
  assert.equal(validateAndFormatTime("0930"), "09:30");
  assert.equal(validateAndFormatTime("00:00"), "00:00");
});

test("validateAndFormatTime: 非法输入返回 null", () => {
  assert.equal(validateAndFormatTime("25:99"), null);
  assert.equal(validateAndFormatTime("24:00"), null);
  assert.equal(validateAndFormatTime("abc"), null);
  assert.equal(validateAndFormatTime(""), null);
  assert.equal(validateAndFormatTime(null), null);
  assert.equal(validateAndFormatTime(undefined), null);
});

// ---------- convertCustomExamToSections（T1 回归 fixture）----------

// README 中的回归用例：09:00 开始，科目一 90 分钟（计入）、休息 10 分钟（不计入）、科目二 30 分钟（计入）
function buildFixture() {
  return {
    id: 1,
    name: "模拟测评-综合卷",
    startTime: "09:00",
    date: "2026-10-15",
    sections: [
      {
        name: "科目一",
        duration: 90,
        description: "科目一",
        countInTotal: true,
      },
      {
        name: "休息",
        duration: 10,
        description: "休息",
        countInTotal: false,
      },
      {
        name: "科目二",
        duration: 30,
        description: "科目二",
        countInTotal: true,
      },
    ],
    totalMinutes: 120,
    displaySettings: {
      showCurrentTime: true,
      showCountdownTimer: true,
      showSectionTimer: true,
    },
  };
}

test("convertCustomExamToSections: 不计入总时间的环节为零时长占位", () => {
  const sections = convertCustomExamToSections(buildFixture());

  assert.equal(sections.length, 4);
  assert.deepEqual(
    sections.map((section) => [section.name, section.start, section.end]),
    [
      ["科目一", 0, 90],
      ["休息", 90, 90],
      ["科目二", 90, 120],
      ["考试结束", 120, 120],
    ],
  );
});

test("convertCustomExamToSections: realTime 与实际考场时间一致", () => {
  const sections = convertCustomExamToSections(buildFixture());

  assert.deepEqual(
    sections.map((section) => section.realTime),
    ["09:00-10:30", "10:30-10:30", "10:30-11:00", "11:00"],
  );
});

test("convertCustomExamToSections: 考试结束位于总时长处，且总时长为 120 分钟", () => {
  const sections = convertCustomExamToSections(buildFixture());
  const totalMinutes = getSectionsTotalMinutes(sections);
  const lastSection = sections[sections.length - 1];

  assert.equal(totalMinutes, 120);
  assert.equal(lastSection.name, "考试结束");
  assert.equal(lastSection.start, 120);
  assert.equal(lastSection.end, 120);
  // 三方一致：标题区时间段终点 === 时间线末端 === 总时间统计
  assert.equal(calculateEndTime("09:00", totalMinutes), "11:00");
  assert.equal(lastSection.realTime, "11:00");
});

test("convertCustomExamToSections: 零时长环节保留 countInTotal 语义供界面显示", () => {
  const sections = convertCustomExamToSections(buildFixture());
  const restSection = sections.find((section) => section.name === "休息");

  assert.ok(restSection, "不计时环节必须仍然出现在环节数组中");
  assert.equal(restSection.countInTotal, false);
  // 计入总时间的环节不显示"不计时"
  assert.equal(sections[0].countInTotal, true);
});

test("convertCustomExamToSections: 输入已包含自动附加的考试结束行时不会重复", () => {
  const exam = buildFixture();
  exam.sections.push({
    name: "考试结束",
    duration: 0,
    description: "收答题卡和试题册",
    countInTotal: false,
  });

  const sections = convertCustomExamToSections(exam);

  assert.equal(sections.length, 4);
  assert.equal(
    sections.filter((section) => section.name === "考试结束").length,
    1,
  );
  assert.equal(getSectionsTotalMinutes(sections), 120);
});

test("convertCustomExamToSections: 未提供 countInTotal 时默认计入总时间", () => {
  const sections = convertCustomExamToSections({
    startTime: "09:00",
    sections: [
      { name: "科目一", duration: 90, description: "科目一" },
      { name: "科目二", duration: 30, description: "科目二" },
    ],
  });

  assert.deepEqual(
    sections.map((section) => [section.name, section.start, section.end]),
    [
      ["科目一", 0, 90],
      ["科目二", 90, 120],
      ["考试结束", 120, 120],
    ],
  );
});

test("convertCustomExamToSections: 全部环节都不计入总时间时不抛错且总时长为 0", () => {
  const sections = convertCustomExamToSections({
    name: "全是休息",
    startTime: "09:00",
    sections: [
      { name: "休息一", duration: 10, description: "休息一", countInTotal: false },
      { name: "休息二", duration: 20, description: "休息二", countInTotal: false },
    ],
    totalMinutes: 0,
  });

  assert.equal(getSectionsTotalMinutes(sections), 0);
  assert.deepEqual(
    sections.map((section) => [section.name, section.start, section.end]),
    [
      ["休息一", 0, 0],
      ["休息二", 0, 0],
      ["考试结束", 0, 0],
    ],
  );
});

test("convertCustomExamToSections: 空配置或非法输入不抛错", () => {
  assert.equal(getSectionsTotalMinutes(convertCustomExamToSections(null)), 0);
  assert.equal(getSectionsTotalMinutes(convertCustomExamToSections({})), 0);
  assert.equal(
    getSectionsTotalMinutes(
      convertCustomExamToSections({ startTime: "09:00", sections: [] }),
    ),
    0,
  );
});
