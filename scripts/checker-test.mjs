// Focused test for the rule engine.
//
// The `numeric` check used to judge the FIRST match of a rule's pattern and
// to report that number — which in a figure spec is often the wrong number
// ("0.05 pt" read as a font size, "20" read out of "220 mm"). The engine now
// judges every match, reports the worst one and softens a mixed finding.
//
// The other check types get the same treatment: `count` counts every
// occurrence, `forbidden` and `required` say how often they hit.
//
// Run: node scripts/checker-test.mjs
import { checkRule, checkText } from '../lib/checker.mjs';

let failures = 0;
let assertions = 0;
const check = (name, condition, detail = '') => {
  assertions += 1;
  if (condition) console.log(`✓ ${name}`);
  else {
    failures += 1;
    console.log(`✗ ${name} ${detail}`);
  }
};

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

/** A synthetic rule — the engine is exercised with a rule of its own. */
const makeRule = (overrides = {}) => ({
  id: 'T-01',
  title: '测试规则',
  severity: 'hard',
  sections: ['figures'],
  statement: '规则陈述。',
  fix: '改法。',
  source: { file: 'references/test.md', line: 1 },
  check: { type: 'numeric', params: {} },
  ...overrides,
});

const numericRule = (params, overrides = {}) =>
  makeRule({ check: { type: 'numeric', params }, ...overrides });

/* ── 1. a mixed finding: the first match is in band, a later one is not ── */

const fontRule = numericRule(
  {
    pattern: '(?:字号|font\\s*size)[^\\d]{0,15}(?<![\\d.])(\\d{1,2}(?:\\.\\d+)?)(?![\\d.])\\s*pt',
    flags: 'i',
    min: 8,
    max: 72,
  },
  { id: 'T-FONT', title: '字号下限 8 pt' },
);

const mixed = checkRule(fontRule, 'Figures\n\n字号: 12 pt. 字号: 6 pt.');
check('the mixed case reports exactly one finding', mixed.violations.length === 1, String(mixed.violations.length));
const mixedFinding = mixed.violations[0] ?? {};
check('the mixed case is NOT a hard violation', mixedFinding.severity === 'soft', String(mixedFinding.severity));
check('the mixed case names the out-of-band value', String(mixedFinding.actual).includes('6'), String(mixedFinding.actual));
check('the mixed case says how many values are out', String(mixedFinding.actual).includes('1 个值超界'), String(mixedFinding.actual));
check('the mixed case carries the out-of-band values', same(mixedFinding.values, [6]), JSON.stringify(mixedFinding.values));
check('the mixed case carries the matched text', mixedFinding.matched === '字号: 6 pt', String(mixedFinding.matched));
check('the mixed case explains itself', typeof mixedFinding.note === 'string' && mixedFinding.note.length > 0, String(mixedFinding.note));
check('the mixed case keeps the expected band', mixedFinding.expected === '8-72', String(mixedFinding.expected));
check('the mixed case counts one soft finding', mixed.summary.soft === 1 && mixed.summary.hard === 0, JSON.stringify(mixed.summary));
check('the mixed case still passes the HARD check', mixed.summary.pass === true, String(mixed.summary.pass));

// the rule's own severity is the default: a soft rule softens to info
const softMixed = checkRule(
  numericRule(
    {
      pattern: '(?:字号|font\\s*size)[^\\d]{0,15}(?<![\\d.])(\\d{1,2}(?:\\.\\d+)?)(?![\\d.])\\s*pt',
      flags: 'i',
      min: 8,
      max: 72,
    },
    { id: 'T-FONT-SOFT', severity: 'soft' },
  ),
  'Figures\n\n字号: 12 pt. 字号: 6 pt.',
);
check('a soft rule softens to info', softMixed.violations[0]?.severity === 'info', String(softMixed.violations[0]?.severity));

/* ── 2. every match is out of band → the worst one is reported ───────── */

const allOut = checkRule(fontRule, 'Figures\n\n字号: 6 pt. 字号: 4 pt.');
check('the all-out case reports exactly one finding', allOut.violations.length === 1, String(allOut.violations.length));
const worst = allOut.violations[0] ?? {};
check('the all-out case keeps the rule severity', worst.severity === 'hard', String(worst.severity));
check('the all-out case reports the WORST value', worst.actual === 4, String(worst.actual));
check('the all-out case reports the worst matched text', worst.matched === '字号: 4 pt', String(worst.matched));
check('the all-out case lists every out-of-band value', same(worst.values, [6, 4]), JSON.stringify(worst.values));
check('the all-out case has no mixed note', worst.note === undefined, String(worst.note));
check('the all-out case counts one hard finding', allOut.summary.hard === 1 && allOut.summary.total === 1, JSON.stringify(allOut.summary));

// a value ABOVE the band is the worst one too
const above = checkRule(fontRule, 'Figures\n\n字号: 90 pt. 字号: 99 pt.');
check('the value above the band is the worst one', above.violations[0]?.actual === 99, String(above.violations[0]?.actual));
check('the value above the band is a hard finding', above.violations[0]?.severity === 'hard', String(above.violations[0]?.severity));

// a number the pattern cannot capture is not a number the rule matched
const uncapturable = checkRule(fontRule, 'Figures\n\n字号: 100 pt.');
check('a number the pattern cannot capture is not reported', uncapturable.violations.length === 0, JSON.stringify(uncapturable.violations));

/* ── 3. "220 mm" must never be read as "20" ───────────────────────────── */

// the loose pattern the lead used: `(\d{1,2})\s*mm` starts one digit late
const looseMillimetre = numericRule({
  pattern: '(\\d{1,2})\\s*mm',
  flags: 'i',
  min: 0,
  max: 85,
});
const loose = checkRule(looseMillimetre, 'Figures\n\n图宽: 220 mm.');
check('the loose pattern does not report a number out of "220 mm"', loose.violations.length === 0, JSON.stringify(loose.violations));
check('the loose pattern reports nothing at all for "220 mm"', loose.summary.total === 0, String(loose.summary.total));

// the tight pattern reads the whole number
const tightMillimetre = numericRule({
  pattern: '(?<![\\d.])(\\d{2,3})(?![\\d.])\\s*mm',
  flags: 'i',
  min: 0,
  max: 85,
});
const tight = checkRule(tightMillimetre, 'Figures\n\n图宽: 220 mm.');
check('the tight pattern reports 220 mm', tight.violations[0]?.actual === 220, String(tight.violations[0]?.actual));
check('the tight pattern reports the matched text', tight.violations[0]?.matched === '220 mm', String(tight.violations[0]?.matched));

// a number that continues after the capture is not a number the rule matched
const truncated = checkRule(looseMillimetre, 'Figures\n\n图宽: 1.5 mm.');
check('a truncated number is not reported', truncated.violations.length === 0, JSON.stringify(truncated.violations));

/* ── 3b. a pattern with TWO capture groups judges BOTH numbers ────────── */
//
// A figure dimension is a pair of quantities — "180 mm × 230 mm" — and each
// of them has its own limit. Only the first group used to be judged, so a
// height of 260 mm passed the 230 mm limit.

const pairRule = numericRule({
  pattern: '(\\d{2,3})\\s*mm\\s*[×x]\\s*(\\d{2,3})\\s*mm',
  flags: 'i',
  min: 0,
  max: 230,
});

// the SECOND number breaks the band
const pairSecond = checkRule(pairRule, 'Figures\n\n图幅: 180 mm × 260 mm.');
check('the pair rule reports the second number', pairSecond.violations.length === 1, String(pairSecond.violations.length));
check('the pair rule names the second number', same(pairSecond.violations[0]?.values, [260]), JSON.stringify(pairSecond.violations[0]?.values));
check('the pair rule says the second number is out', String(pairSecond.violations[0]?.actual).includes('260'), String(pairSecond.violations[0]?.actual));
check('the pair rule keeps the whole matched text', pairSecond.violations[0]?.matched === '180 mm × 260 mm', String(pairSecond.violations[0]?.matched));
check('one group out of band is softened', pairSecond.violations[0]?.severity === 'soft', String(pairSecond.violations[0]?.severity));
check('one group out of band explains itself', typeof pairSecond.violations[0]?.note === 'string' && pairSecond.violations[0].note.length > 0, String(pairSecond.violations[0]?.note));

// the FIRST number breaks the band
const pairFirst = checkRule(pairRule, 'Figures\n\n图幅: 280 mm × 260 mm.');
check('the pair rule reports the first number too', pairFirst.violations.length === 1, String(pairFirst.violations.length));
check('both numbers out of band stay a hard finding', pairFirst.violations[0]?.severity === 'hard', String(pairFirst.violations[0]?.severity));
check('both numbers out of band report the worst one', pairFirst.violations[0]?.actual === 280, String(pairFirst.violations[0]?.actual));
check('both numbers out of band list every value', same(pairFirst.violations[0]?.values, [280, 260]), JSON.stringify(pairFirst.violations[0]?.values));

// both numbers inside the band: nothing to report
const pairOk = checkRule(pairRule, 'Figures\n\n图幅: 180 mm × 230 mm.');
check('a pair inside the band is not reported', pairOk.violations.length === 0, JSON.stringify(pairOk.violations));

// the same for the real F-24 rule (design size ≤180 × 230 mm) — a general rule
const f24 = checkText('Figures\n\n图幅: 180 mm × 260 mm.');
const f24Finding = f24.violations.find((entry) => entry.id === 'F-24');
check('F-24 sees the height of the pair', f24Finding !== undefined, JSON.stringify(f24Finding));
check('F-24 names the offending height', same(f24Finding?.values, [260]), JSON.stringify(f24Finding?.values));
const f24Ok = checkText('Figures\n\n图幅: 180 mm × 230 mm.');
check('F-24 is silent for a size inside the band', f24Ok.violations.find((entry) => entry.id === 'F-24') === undefined, JSON.stringify(f24Ok.violations.find((entry) => entry.id === 'F-24')));

/* ── 4. `count` counts EVERY occurrence ───────────────────────────────── */

const countRule = makeRule({
  id: 'T-COUNT',
  title: 'however 至多 2 次',
  check: { type: 'count', params: { pattern: '\\bhowever\\b', flags: 'i', min: 0, max: 2 } },
});
const counted = checkRule(countRule, 'Figures\n\nHowever this is one. However that is two. however three.');
check('count reports the number of occurrences', counted.violations[0]?.actual === 3, String(counted.violations[0]?.actual));
check('count keeps the expected bound', counted.violations[0]?.expected === '≤ 2 次', String(counted.violations[0]?.expected));

const countedOk = checkRule(countRule, 'Figures\n\nHowever this is one. that is two.');
check('count reports nothing when the bound holds', countedOk.violations.length === 0, JSON.stringify(countedOk.violations));

/* ── 5. `forbidden` says how often it hit ─────────────────────────────── */

const forbiddenRule = makeRule({
  id: 'T-FORBIDDEN',
  title: '禁止 first time',
  check: { type: 'forbidden', params: { patterns: ['\\bfirst time\\b'], flags: 'i' } },
});
const forbidden = checkRule(forbiddenRule, 'Figures\n\nFor the first time we saw it. For the first time again.');
check('forbidden reports one finding', forbidden.violations.length === 1, String(forbidden.violations.length));
check('forbidden says how many times it hit', forbidden.violations[0]?.actual === '命中 2 次', String(forbidden.violations[0]?.actual));
check('forbidden keeps the matched text', /first time/i.test(forbidden.violations[0]?.matched ?? ''), String(forbidden.violations[0]?.matched));
check('forbidden keeps the expectation', forbidden.violations[0]?.expected?.includes('不得出现') === true, String(forbidden.violations[0]?.expected));

/* ── 6. `required` reports every missing pattern separately ───────────── */

const requiredRule = makeRule({
  id: 'T-REQUIRED',
  title: '必须含 Background 与 Objective',
  check: { type: 'required', params: { patterns: ['\\bBackground\\b', '\\bObjective\\b'], flags: 'i' } },
});
const required = checkRule(requiredRule, 'Figures\n\nThe background of the study is described.');
check('required reports the missing pattern only', required.violations.length === 1, String(required.violations.length));
check('required names the missing pattern', required.violations[0]?.matched === '\\bObjective\\b', String(required.violations[0]?.matched));
check('required says how many elements are already there', required.violations[0]?.actual === '1/2 项必需要素已出现', String(required.violations[0]?.actual));

const requiredAll = checkRule(requiredRule, 'Figures\n\nBackground and Objective are both here.');
check('required reports nothing when every pattern is there', requiredAll.violations.length === 0, JSON.stringify(requiredAll.violations));

/* ── 7. the summary stays consistent with the violations ───────────────── */

//
// The figure rules are mostly scoped to one journal, so the journal has to
// be named — without a target the scoped rule is skipped (and counted as
// skipped), which is the honest outcome.

const spec = 'Figures\n\nFigure 1. dpi: 150. 图宽: 220 mm. 线宽: 0.05 pt. 字号: 6 pt.';
const report = checkText(spec, { journal: 'paleobiology' });
const violations = report.violations;
const hard = violations.filter((entry) => entry.severity === 'hard').length;
const soft = violations.filter((entry) => entry.severity === 'soft').length;
const info = violations.filter((entry) => entry.severity === 'info').length;
check('the summary total matches the violations', report.summary.total === violations.length, `${report.summary.total} vs ${violations.length}`);
check('the summary hard count matches the violations', report.summary.hard === hard, `${report.summary.hard} vs ${hard}`);
check('the summary soft count matches the violations', report.summary.soft === soft, `${report.summary.soft} vs ${soft}`);
check('the summary info count matches the violations', report.summary.info === info, `${report.summary.info} vs ${info}`);
check('the severity counts add up', report.summary.hard + report.summary.soft + report.summary.info === report.summary.total, JSON.stringify(report.summary));
check('the summary reports the evaluated rules', report.summary.checkedRules > 0, String(report.summary.checkedRules));

/* ── 8. the real rule data on the real figure spec ────────────────────── */

const fontFinding = violations.find((entry) => entry.id === 'F-36');
check('F-36 reads the font size 6 pt, not the line width 0.05', fontFinding?.actual === 6, String(fontFinding?.actual));
check('F-36 reports the matched text', fontFinding?.matched === '字号: 6 pt', String(fontFinding?.matched));

const millimetreLine = violations.find((entry) => entry.id === 'F-40');
check('F-40 does not fire on a line width stated in pt', millimetreLine === undefined, JSON.stringify(millimetreLine));

const pointLine = violations.find((entry) => entry.id === 'F-41');
check('F-41 reads the line width 0.05 pt', pointLine?.actual === 0.05, String(pointLine?.actual));

// the width rule belongs to Nature
const natureReport = checkText(spec, { journal: 'nature' });
const widthFinding = natureReport.violations.find((entry) => entry.id === 'F-25');
check('F-25 reads the width 220 mm, not 20', widthFinding?.actual === 220, String(widthFinding?.actual));
check('F-25 reports the matched text', widthFinding?.matched === '图宽: 220 mm', String(widthFinding?.matched));

// the width rule of a journal that allows 237 mm stays silent
const appReport = checkText(spec, { journal: 'acta-palaeontologica-polonica' });
check(
  'a width inside the journal band is not reported',
  appReport.violations.find((entry) => entry.id === 'F-26') === undefined,
  JSON.stringify(appReport.violations.find((entry) => entry.id === 'F-26')),
);

// a resolution written the usual way ("150 dpi") is judged as a number
const dpiReport = checkText('Figures\n\nFigure 1. 150 dpi. 图宽: 220 mm. 字号: 6 pt.');
const dpiFinding = dpiReport.violations.find((entry) => entry.id === 'F-01');
check('F-01 reads the resolution 150 dpi', dpiFinding?.actual === 150, String(dpiFinding?.actual));
check('F-01 is a hard violation', dpiFinding?.severity === 'hard', String(dpiFinding?.severity));

// the whole-database run still finds the same numbers for every match
const multiDpi = checkText('Figures\n\nFigure 1. 150 dpi. Figure 2. 300 dpi.');
const dpiFindings = multiDpi.violations.filter((entry) => entry.id === 'F-01');
check('a resolution rule judges EVERY match', dpiFindings.length === 1, String(dpiFindings.length));
check('the mixed resolution is reported softer', dpiFindings[0]?.severity === 'soft', String(dpiFindings[0]?.severity));
check('the mixed resolution lists the out-of-band value', same(dpiFindings[0]?.values, [150]), JSON.stringify(dpiFindings[0]?.values));

/* ── 9. the violation shape is unchanged ──────────────────────────────── */

const shape = violations[0] ?? {};
for (const field of ['id', 'ruleId', 'title', 'severity', 'section', 'statement', 'fix', 'source']) {
  check(`a violation still carries ${field}`, Object.prototype.hasOwnProperty.call(shape, field));
}
check('a violation still carries the source file', typeof shape.source?.file === 'string', JSON.stringify(shape.source));
check('a violation still carries the source line', typeof shape.source?.line === 'number', JSON.stringify(shape.source));
check('the numeric values never exceed ten', violations.every((entry) => !entry.values || entry.values.length <= 10));

if (failures > 0) {
  console.log(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log(`\nchecker verified — ${assertions} assertions`);
