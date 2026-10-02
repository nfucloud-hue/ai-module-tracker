/**
 * AI模組跨領域應用推廣計畫 專案進度管理 — Google Apps Script 後端
 * 資料存在本試算表的「工作項目」「回報紀錄」「協助請求」「模組看板」「查核點」「人員」「設定」分頁。
 * 第一次使用：重新整理試算表 → 上方選單「專案管理」→「初始設定（第一次使用）」，再部署為網頁應用程式。
 */
const SITE_URL = 'https://ai-module-tracker.vercel.app'; // 網站正式網址（產生專屬連結用）
const OPEN_LOGIN = false; // false＝每人須用個人專屬連結（金鑰）登入；true＝登入畫面點名字即可進入（不符個資保護，勿開啟）
const TZ = 'Asia/Taipei';
const DIGEST_DAY = ScriptApp.WeekDay.FRIDAY, DIGEST_HOUR = 17; // 每週摘要寄送時間：週五 17:00

const SHEETS = {
  tasks: {name: '工作項目', cols: ['id', 'code', 'group', 'name', 'deliverable', 'owner', 'helpers', 'start', 'end', 'weight', 'checkpoint', 'note'],
    head: ['ID', '編號', '分項', '工作項目', '產出／交付文件', '主責', '協辦（以、分隔）', '起始日', '完成日', '權重%', '對應查核點', '備註']},
  reports: {name: '回報紀錄', cols: ['id', 'createdAt', 'taskId', 'reporter', 'progress', 'status', 'done', 'next', 'issue', 'reply', 'replyAt'],
    head: ['ID', '回報時間', '工作項目ID', '回報人', '完成度%', '狀態', '本次完成', '下一步', '遇到的難題', '主管回覆', '回覆時間']},
  helps: {name: '協助請求', cols: ['id', 'createdAt', 'taskId', 'requester', 'helper', 'content', 'status', 'response', 'updatedAt'],
    head: ['ID', '建立時間', '工作項目ID', '請求人', '協助人', '需要協助的內容', '狀態', '協助回覆', '更新時間']},
  modules: {name: '模組看板', cols: ['id', 'name', 'owner', 'sec', 'secHigh', 'cloud', 'note', 'updatedBy', 'updatedAt'],
    head: ['代號', '模組名稱', '負責人', '資安檢測(1-1)', '未修補高風險數', '雲端上架(1-2)', '備註', '更新人', '更新時間']},
  evidence: {name: '佐證檔案', cols: ['id', 'taskId', 'title', 'url', 'addedBy', 'addedAt'],
    head: ['ID', '工作項目ID', '檔案名稱', '連結', '上傳人', '上傳時間']},
  checkpoints: {name: '查核點', cols: ['id', 'due', 'title', 'target', 'current', 'auto', 'note', 'updatedBy', 'updatedAt'],
    head: ['查核點', '完成期限', '查核點概述', '目標值', '目前達成值', '自動計算來源', '備註', '更新人', '更新時間']},
  people: {name: '人員', cols: ['name', 'title', 'pm', 'focus', 'pin', 'link', 'email', 'role'],
    head: ['姓名', '職級', '本區間人月', '本區間工作重點', '個人金鑰（勿外流）', '專屬連結（複製後私訊給本人）', '通知 Email（收協助請求與主管回覆）', '角色（主管／空白＝成員）']},
};
const STATUS = ['未開始', '進行中', '遇到困難', '已完成'];
const HELP_STATUS = ['待回應', '協助中', '已解決'];
const SEC = ['未開始', '檢測中', '修補中', '複測通過'];
const CLOUD = ['未開始', '部署中', '功能驗證', '送審中', '已上架'];

const SEED_TASKS = [
  ['a1', 'A1', '1-1 模組資安檢測', '9項AI模組盤點與檢測範圍、風險項目確認', '模組清單暨檢測範圍確認表', '郭泰均', '許禮維', '2026-10-01', '2026-10-04', 3, '1-1', ''],
  ['a2', 'A2', '1-1 模組資安檢測', '檢測環境建置與工具準備(SAST／DAST／API掃描)', '檢測環境與工具設定紀錄', '許禮維', '王振宇', '2026-10-01', '2026-10-07', 3, '1-1', ''],
  ['a3', 'A3', '1-1 模組資安檢測', '模組1–5 資安檢測執行(程式／Web／API／帳號權限／資料傳輸)', '模組1–5檢測原始報告', '郭泰均', '莊嘉雲', '2026-10-05', '2026-10-09', 6, '1-1', ''],
  ['a4', 'A4', '1-1 模組資安檢測', '模組6–9 資安檢測執行(程式／Web／API／帳號權限／資料傳輸)', '模組6–9檢測原始報告', '許禮維', '王振宇', '2026-10-05', '2026-10-11', 6, '1-1', ''],
  ['a5', 'A5', '1-1 模組資安檢測', '弱點分析、風險分級與程式漏洞修補', '弱點修補對照表(修補前後)', '王振宇', '郭泰均、許禮維', '2026-10-08', '2026-10-14', 8, '1-1', ''],
  ['a6', 'A6', '1-1 模組資安檢測', '複測驗證與資安檢測總報告彙整', '資安檢測及弱點改善成果報告', '郭泰均', '莊嘉雲、覺文郁', '2026-10-12', '2026-10-15', 6, '1-1', '查核點 1-1 交付'],
  ['b1', 'B1', '1-2 模組上架', '公有軟體雲上架規範研析、申請文件與帳號權限備齊', '上架申請文件包', '莊嘉雲', '周芷涵', '2026-10-06', '2026-10-18', 4, '1-2', ''],
  ['b2', 'B2', '1-2 模組上架', '模組1–5 環境調整、容器化封裝與部署測試', '模組1–5部署測試紀錄', '郭泰均', '王振宇', '2026-10-16', '2026-11-01', 8, '1-2', ''],
  ['b3', 'B3', '1-2 模組上架', '模組6–9 環境調整、容器化封裝與部署測試', '模組6–9部署測試紀錄', '許禮維', '王振宇', '2026-10-16', '2026-11-08', 8, '1-2', ''],
  ['b4', 'B4', '1-2 模組上架', '雲端功能驗證與使用者情境操作測試(9項)', '功能驗證測試報告', '王振宇', '郭泰均、許禮維', '2026-11-02', '2026-11-15', 7, '1-2', ''],
  ['b5', 'B5', '1-2 模組上架', '上架素材製作(模組說明頁、操作手冊、示範影片)', '上架素材檔(9套)', '周芷涵', '林永祥', '2026-10-26', '2026-11-22', 5, '1-2', ''],
  ['b6', 'B6', '1-2 模組上架', '正式送審、上架掛載與連結確認', '9項模組上架截圖與網址清單', '莊嘉雲', '郭泰均、蘇順豐', '2026-11-16', '2026-11-30', 6, '1-2', '查核點 1-2 交付'],
  ['c1', 'C1', '1-3 模組擴散應用', '12項GAI模組推廣型錄、應用情境與簡報彙編', '推廣型錄暨簡報', '周芷涵', '林永祥', '2026-10-01', '2026-10-18', 3, '1-3', ''],
  ['c2', 'C2', '1-3 模組擴散應用', '目標工具機廠名單建立與洽談簽署(≥2家)', '合作意向書／參與同意書', '專案管理者', '莊嘉雲', '2026-10-05', '2026-10-25', 4, '1-3', ''],
  ['c3', 'C3', '1-3 模組擴散應用', '終端擴散企業名單開發與邀約(累計≥25家)', '擴散企業名冊', '莊嘉雲', '周芷涵、林永祥', '2026-10-12', '2026-11-22', 5, '1-3', ''],
  ['c4', 'C4', '1-3 模組擴散應用', '工具機廠導入需求訪談與模組媒合、技術輔導', '需求訪談暨媒合紀錄', '專案管理者', '郭泰均', '2026-10-26', '2026-11-22', 4, '1-3', ''],
  ['c5', 'C5', '1-3 模組擴散應用', '推廣說明會／成果展示會辦理(2場)', '會議簽到表、照片、問卷', '周芷涵', '林永祥、莊嘉雲', '2026-11-02', '2026-11-29', 5, '1-3', ''],
  ['c6', 'C6', '1-3 模組擴散應用', '導入案例紀錄與擴散家數統計表建置', '擴散家數統計表暨案例集', '林永祥', '莊嘉雲', '2026-11-09', '2026-11-30', 3, '1-3', '為 12/10 查核點預備'],
  ['m1', 'M1', '計畫管理', '雙週進度管控會議(10/9、10/23、11/6、11/20、11/30)', '會議紀錄', '專案管理者', '郭泰均、許禮維、王振宇、莊嘉雲、周芷涵、林永祥', '2026-10-01', '2026-11-30', 2, '', ''],
  ['m2', 'M2', '計畫管理', '經費執行管控(材料費115萬／代辦加工45萬／業務費)與核銷', '經費執行進度表', '莊嘉雲', '林永祥', '2026-10-01', '2026-11-30', 2, '', ''],
  ['m3', 'M3', '計畫管理', '查核點佐證文件彙整與期末報告初稿準備', '查核點佐證資料夾', '林永祥', '周芷涵', '2026-11-16', '2026-11-30', 2, '', ''],
];
const SEED_PEOPLE = [
  ['蘇順豐', '計畫主持人', 1.6, '計畫整體規劃、跨單位協調、查核點核定、成果對外代表', '主管'],
  ['覺文郁', '共同主持人', 1.6, '工具機廠洽談與擴散策略、技術審查、產學媒合', '主管'],
  ['專案管理者', '專案管理者', 0, '雙週進度管控會議、工具機廠洽談與導入訪談'],
  ['郭泰均', '助理研究員', 1.3, '模組1–5資安檢測與部署、檢測報告彙整'],
  ['許禮維', '助理研究員', 1.3, '檢測環境建置、模組6–9資安檢測與部署'],
  ['王振宇', '助理研究員', 1.3, '弱點修補、雲端功能驗證與操作測試'],
  ['莊嘉雲', '助理研究員', 1.1, '上架申請文件、擴散企業名單開發、經費執行管控'],
  ['周芷涵', '助理研究員', 0.6, '推廣型錄與上架素材製作、說明會辦理'],
  ['林永祥', '助理研究員', 0.6, '案例與擴散家數統計、查核點佐證文件彙整'],
];
const SEED_MODULES = [
  ['M1', 'CNC設備保養精度維護與調教生成式虛擬助手', '郭泰均'],
  ['M2', '綜合加工機操作助手', '郭泰均'],
  ['M3', '數控車床操作助手', '郭泰均'],
  ['M4', '綜合加工機設備推薦助手', '郭泰均'],
  ['M5', '數控車床設備推薦助手', '郭泰均'],
  ['M6', '工具機故障簡易排除助手', '許禮維'],
  ['M7', '115年度模組①（待填名稱）', '許禮維'],
  ['M8', '115年度模組②（待填名稱）', '許禮維'],
  ['M9', '115年度模組③（待填名稱）', '許禮維'],
];
const SEED_CHECKPOINTS = [
  ['1-1', '2026-10-15', '完成9項(含)以上工具機AI模組資安檢測及弱點改善', 9, 0, 'sec'],
  ['1-2', '2026-11-30', '完成9項(含)以上工具機AI模組公有軟體雲上架', 9, 0, 'cloud'],
  ['1-3a', '2026-12-10', '推動工具機廠跨終端領域擴散應用（家）', 2, 0, ''],
  ['1-3b', '2026-12-10', '工具機廠及終端企業累計擴散應用（家）', 25, 0, ''],
];

/** 試算表上方的「專案管理」選單 */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('專案管理')
    .addItem('初始設定（第一次使用）', 'setup')
    .addItem('補發新成員的個人密碼', 'setupPins')
    .addItem('資安：全部重新產生專屬連結（舊連結失效）', 'rotateKeys')
    .addItem('套用：蘇、覺老師改主管／新增專案管理者', 'migrateManagers')
    .addSeparator()
    .addItem('立即寄出本週摘要（測試）', 'weeklyDigest')
    .addToUi();
}

/** 第一次使用時執行一次：建立分頁、匯入工作彙整表、產生密碼。可重複執行，不會覆蓋已有資料。 */
function setup() {
  const ss = SpreadsheetApp.getActive();
  const seed = {tasks: SEED_TASKS, modules: SEED_MODULES.map(m => [m[0], m[1], m[2], '未開始', 0, '未開始', '', '', '']),
    checkpoints: SEED_CHECKPOINTS.map(c => c.concat(['', '', ''])), people: SEED_PEOPLE.map(p => p.slice(0, 4).concat(['', '', '', p[4] || '']))};
  Object.keys(SHEETS).forEach(k => {
    const def = SHEETS[k];
    let s = ss.getSheetByName(def.name);
    if (!s) s = ss.insertSheet(def.name);
    // 每次都重寫表頭，新增欄位（例如人員的通知 Email）時舊試算表也會補上
    s.getRange(1, 1, 1, def.head.length).setValues([def.head]).setFontWeight('bold').setBackground('#eef2ff');
    s.setFrozenRows(1);
    s.getRange(1, 1, s.getMaxRows(), def.cols.length).setNumberFormat('@'); // 全部以文字儲存，避免日期／密碼被自動轉換
    if (seed[k] && s.getLastRow() < 2) s.getRange(2, 1, seed[k].length, def.cols.length).setValues(seed[k].map(r => r.map(String)));
  });
  let c = ss.getSheetByName('設定');
  if (!c) {
    c = ss.insertSheet('設定');
    c.getRange('A1:B2').setValues([
      ['主管金鑰', token_()],
      ['說明', '主管密碼可看全部、回覆、編輯工作項目。成員各自的密碼在「人員」分頁 E 欄，改密碼直接修改即可，舊連結立即失效。'],
    ]);
    c.getRange('B1').setNumberFormat('@');
    c.getRange('A3:B3').setValues([['主管專屬連結', '="' + SITE_URL + '/#k="&B1']]);
    c.setColumnWidth(1, 110); c.setColumnWidth(2, 560);
  }
  if (!String(c.getRange('A4').getDisplayValue()).trim()) {
    c.getRange('A4:C4').setValues([['主管通知 Email', Session.getEffectiveUser().getEmail(), '← 卡關通知與每週摘要寄到這裡，多個以逗號分隔']]);
  }
  // 每週摘要：先移除舊的排程再建立，避免重複寄送
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'weeklyDigest').forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('weeklyDigest').timeBased().onWeekDay(DIGEST_DAY).atHour(DIGEST_HOUR).inTimezone(TZ).create();
  setupPins();
}

/** 一次性調整（2026-10）：蘇順豐、覺文郁改為主管；新增「專案管理者」接手 M1、C2、C4。可重複執行。 */
function migrateManagers() {
  setup(); // 補上新欄位表頭
  const ps = SpreadsheetApp.getActive().getSheetByName(SHEETS.people.name), pc = SHEETS.people.cols;
  const names = ps.getRange(2, 1, Math.max(1, ps.getLastRow() - 1), 1).getDisplayValues().map(r => r[0].trim());
  ['蘇順豐', '覺文郁'].forEach(n => { const i = names.indexOf(n); if (i >= 0) ps.getRange(i + 2, pc.indexOf('role') + 1).setValue('主管'); });
  if (names.indexOf('專案管理者') < 0) append_('people', {name: '專案管理者', title: '專案管理者', pm: '0', focus: '雙週進度管控會議、工具機廠洽談與導入訪談'});
  const ts = SpreadsheetApp.getActive().getSheetByName(SHEETS.tasks.name), tc = SHEETS.tasks.cols;
  read_('tasks').forEach(t => {
    if (['m1', 'c2', 'c4'].indexOf(t.id) >= 0 && (t.owner === '蘇順豐' || t.owner === '覺文郁')) {
      const r = findRow_('tasks', t.id);
      ts.getRange(r, tc.indexOf('owner') + 1).setValue('專案管理者');
      if (t.id === 'm1') ts.getRange(r, tc.indexOf('helpers') + 1).setValue(names.filter(n => n && n !== '蘇順豐' && n !== '覺文郁' && n !== '專案管理者').join('、'));
    }
  });
  setupPins();
}

/** 「人員」分頁中還沒有密碼的人自動產生 6 位數密碼與專屬連結。 */
function setupPins() {
  const s = SpreadsheetApp.getActive().getSheetByName(SHEETS.people.name);
  const rows = s.getLastRow() < 2 ? [] : s.getRange(2, 1, s.getLastRow() - 1, 6).getDisplayValues();
  const used = rows.map(r => r[4]).concat([adminPin_()]);
  let n = 0;
  rows.forEach((r, i) => {
    if (!r[0].trim()) return;
    if (!r[4].trim()) { r[4] = token_(); n++; }
    s.getRange(i + 2, 5).setValue(r[4]);
    s.getRange(i + 2, 6).setNumberFormat('General').setFormula('="' + SITE_URL + '/#k="&E' + (i + 2));
  });
  s.setColumnWidth(4, 320); s.setColumnWidth(6, 380);
  const ss = SpreadsheetApp.getActive();
  const msg = '完成！新增 ' + n + ' 組個人密碼。資料存在試算表「' + ss.getName() + '」：' + ss.getUrl() + ' （成員名單在「人員」分頁，主管密碼在「設定」B1）';
  Logger.log(msg);
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) { /* 從編輯器執行時沒有試算表畫面 */ }
}

function doGet(e) { return handle_(e.parameter || {}); }
function doPost(e) {
  let p = {};
  try { p = JSON.parse(e.postData.contents); } catch (x) { return out_({ok: false, error: 'bad_request'}); }
  return handle_(p);
}

function handle_(p) {
  try {
    if (p.action === 'people') // 登入畫面用的名單（不含密碼）
      return out_({ok: true, open: OPEN_LOGIN, people: OPEN_LOGIN ? read_('people').filter(x => !isMgr_(x)).map(x => ({name: x.name, title: x.title})) : []});
    if (tooManyFails_()) return out_({ok: false, error: '嘗試次數過多，請 10 分鐘後再試'});
    const who = auth_(p.pin, p.as);
    if (!who) { if (p.pin) noteFail_(); return out_({ok: false, error: 'pin'}); }
    const admin = who.role === 'admin';
    const deny = () => out_({ok: false, error: '只有主管可以執行這個動作'});
    const full = admin && !who.limited; // 點名字登入的主管：可看全部、回覆，但不能刪除或修改工作項目
    const denyFull = () => out_({ok: false, error: '刪除與修改工作項目請用「主管登入」或主管專屬連結'});
    switch (p.action) {
      case 'data': return out_(Object.assign({ok: true, role: who.role, me: who.name, limited: !!who.limited}, readAll_()));
      case 'report': return locked_(() => addReport_(p.report || {}, who));
      case 'reply': return admin ? locked_(() => replyReport_(p.id, p.reply)) : deny();
      case 'deleteReport': return full ? locked_(() => deleteRow_('reports', p.id)) : admin ? denyFull() : deny();
      case 'saveTask': return full ? locked_(() => saveTask_(p.task || {})) : admin ? denyFull() : deny();
      case 'deleteTask': return full ? locked_(() => deleteRow_('tasks', p.id)) : admin ? denyFull() : deny();
      case 'help': return locked_(() => addHelp_(p.help || {}, who));
      case 'helpUpdate': return locked_(() => updateHelp_(p, who));
      case 'saveModule': return locked_(() => saveModule_(p.module || {}, who));
      case 'addEvidence': return locked_(() => addEvidence_(p.evidence || {}, who));
      case 'deleteEvidence': return locked_(() => deleteEvidence_(p.id, who, full));
      case 'packEvidence': return full ? packEvidence_(p.checkpoint) : admin ? denyFull() : deny();
      case 'saveCheckpoint': return locked_(() => patch_('checkpoints', p.id, {current: String(Math.max(0, Number(p.current) || 0)), note: clean_(p.note, 300), updatedBy: who.name || '主管', updatedAt: now_()}));
      default: return out_({ok: false, error: 'unknown_action'});
    }
  } catch (err) {
    return out_({ok: false, error: String(err && err.message || err)});
  }
}

/** 「設定」B1 → 主管；「人員」E 欄 → 該成員；OPEN_LOGIN 時也可只用姓名登入為成員。 */
function auth_(pin, as) {
  pin = String(pin || '').trim();
  if (pin && pin === adminPin_()) return {role: 'admin', name: ''};
  const people = read_('people');
  const p = pin ? people.filter(x => String(x.pin).trim() === pin)[0] : null;
  if (p) return {role: isMgr_(p) ? 'admin' : 'member', name: p.name}; // 角色為「主管」者用個人密碼／專屬連結登入即有主管權限
  const n = OPEN_LOGIN && as ? people.filter(x => x.name === String(as).trim())[0] : null;
  return n && !isMgr_(n) ? {role: 'member', name: n.name} : null; // 主管不能只用姓名登入，須用個人專屬連結（防冒名）
}
function isMgr_(p) { return String(p.role || '').trim() === '主管'; }

function readAll_() {
  const people = read_('people').map(p => ({name: p.name, title: p.title, pm: Number(p.pm) || 0, focus: p.focus, manager: isMgr_(p)}));
  return {
    tasks: read_('tasks').map(t => Object.assign(t, {weight: Number(t.weight) || 0})),
    reports: read_('reports').map(r => Object.assign(r, {progress: Number(r.progress) || 0})),
    helps: read_('helps'),
    modules: read_('modules').map(m => Object.assign(m, {secHigh: Number(m.secHigh) || 0})),
    checkpoints: read_('checkpoints').map(c => Object.assign(c, {target: Number(c.target) || 0, current: Number(c.current) || 0})),
    people: people,
    evidence: read_('evidence'),
  };
}

function addReport_(r, who) {
  const task = read_('tasks').filter(t => t.id === String(r.taskId))[0];
  if (!task) return out_({ok: false, error: '找不到這個工作項目'});
  if (who.role !== 'admin') {
    if (!involved_(task, who.name)) return out_({ok: false, error: '只能回報自己主責或協辦的工作'});
    r.reporter = who.name;
  }
  if (!String(r.reporter || '').trim()) return out_({ok: false, error: '請選擇回報人'});
  const row = {
    id: Utilities.getUuid(), createdAt: now_(), taskId: task.id, reporter: clean_(r.reporter, 40),
    progress: String(Math.max(0, Math.min(100, Math.round(Number(r.progress) || 0)))),
    status: STATUS.indexOf(r.status) >= 0 ? r.status : '進行中',
    done: clean_(r.done, 2000), next: clean_(r.next, 2000), issue: clean_(r.issue, 2000), reply: '', replyAt: '',
  };
  append_('reports', row);
  // 回報時勾選「需要誰協助」→ 自動建立協助請求
  const names = read_('people').map(p => p.name);
  const helpers = (Array.isArray(r.helpers) ? r.helpers : []).filter(n => names.indexOf(n) >= 0 && n !== row.reporter);
  const helpText = clean_(r.helpText || r.issue, 2000);
  helpers.forEach(n => {
    append_('helps', {id: Utilities.getUuid(), createdAt: now_(), taskId: task.id, requester: row.reporter, helper: n,
      content: helpText, status: '待回應', response: '', updatedAt: now_()});
    notifyHelp_(row.reporter, n, task, helpText);
  });
  if (row.status === '遇到困難') {
    mail_(adminEmails_(), `${task.code} 遇到困難：${row.reporter}`, box_('#d92d3a',
      `<b>${esc_(row.reporter)}</b> 回報 <b>${esc_(task.code)} ${esc_(task.name)}</b> 遇到困難（目前 ${row.progress}%）` +
      quote_(row.issue) + (row.done ? `<p style="margin:8px 0 0">本次完成：${esc_(row.done)}</p>` : '') +
      (helpers.length ? `<p style="margin:8px 0 0">已請 ${esc_(helpers.join('、'))} 協助</p>` : '<p style="margin:8px 0 0;color:#c27100">尚未指定協助人，可能需要主管協調。</p>') +
      `<p style="margin:12px 0 0">登入後到「工作進度」點 ${esc_(task.code)} 即可回覆指示。</p>`));
  }
  return out_({ok: true, id: row.id});
}

function replyReport_(id, text) {
  const r = read_('reports').filter(x => x.id === String(id))[0];
  if (!r) return out_({ok: false, error: '找不到這筆回報'});
  const res = patch_('reports', r.id, {reply: clean_(text, 2000), replyAt: now_()});
  const task = read_('tasks').filter(t => t.id === r.taskId)[0] || {code: '', name: ''};
  mail_(emailOf_(r.reporter), `主管回覆了你的 ${task.code} 回報`, box_('#4f46e5',
    `<b>${esc_(task.code)} ${esc_(task.name)}</b><p style="margin:8px 0 0">你的回報：${esc_(r.issue || r.done || r.next)}</p>` + quote_('主管回覆：' + text)));
  return res;
}

function addHelp_(h, who) {
  const names = read_('people').map(p => p.name);
  const requester = who.role === 'admin' ? String(h.requester || '') : (h.offer ? String(h.requester || '') : who.name);
  const helper = h.offer && who.role !== 'admin' ? who.name : String(h.helper || '');
  if (names.indexOf(requester) < 0 || names.indexOf(helper) < 0 || requester === helper) return out_({ok: false, error: '請選擇協助對象'});
  if (!String(h.content || '').trim()) return out_({ok: false, error: '請寫下需要協助的內容'});
  const content = clean_(h.content, 2000);
  append_('helps', {id: Utilities.getUuid(), createdAt: now_(), taskId: String(h.taskId || ''), requester: requester, helper: helper,
    content: content, status: h.offer ? '協助中' : '待回應', response: '', updatedAt: now_()});
  const task = read_('tasks').filter(t => t.id === String(h.taskId || ''))[0];
  if (h.offer) mail_(emailOf_(requester), `${helper} 主動協助你${task ? '處理 ' + task.code : ''}`,
    box_('#15924a', `<b>${esc_(helper)}</b> 表示可以協助你${task ? '處理 <b>' + esc_(task.code + ' ' + task.name) + '</b>' : ''}` + quote_(content)));
  else notifyHelp_(requester, helper, task, content);
  return out_({ok: true});
}

function notifyHelp_(requester, helper, task, content) {
  mail_(emailOf_(helper), `${requester} 請你協助${task ? '：' + task.code : ''}`, box_('#c27100',
    `<b>${esc_(requester)}</b> 請你協助${task ? '處理 <b>' + esc_(task.code + ' ' + task.name) + '</b>' : ''}` + quote_(content) +
    '<p style="margin:12px 0 0">登入後在「我的日誌」最上方按「接下協助」，處理完按「回覆／結案」。</p>'));
}

function updateHelp_(p, who) {
  const h = read_('helps').filter(x => x.id === String(p.id))[0];
  if (!h) return out_({ok: false, error: '找不到這筆協助請求'});
  if (who.role !== 'admin' && who.name !== h.helper && who.name !== h.requester) return out_({ok: false, error: '只有請求人、協助人或主管可以更新'});
  const patch = {updatedAt: now_()};
  if (HELP_STATUS.indexOf(p.status) >= 0) patch.status = p.status;
  if (p.response != null) patch.response = clean_(p.response, 2000);
  return patch_('helps', h.id, patch);
}

function saveModule_(m, who) {
  const patch = {updatedBy: who.name || '主管', updatedAt: now_()};
  if (SEC.indexOf(m.sec) >= 0) patch.sec = m.sec;
  if (CLOUD.indexOf(m.cloud) >= 0) patch.cloud = m.cloud;
  if (m.secHigh != null) patch.secHigh = String(Math.max(0, Math.round(Number(m.secHigh) || 0)));
  if (m.note != null) patch.note = clean_(m.note, 300);
  if (m.name != null && who.role === 'admin') patch.name = clean_(m.name, 100);
  if (m.owner != null && who.role === 'admin') patch.owner = clean_(m.owner, 40);
  return patch_('modules', m.id, patch);
}

function saveTask_(t) {
  const re = /^\d{4}-\d{2}-\d{2}$/;
  if (!String(t.code || '').trim() || !String(t.name || '').trim()) return out_({ok: false, error: '請填寫編號與工作項目'});
  if (!re.test(t.start) || !re.test(t.end) || t.end < t.start) return out_({ok: false, error: '日期格式錯誤或完成日早於起始日'});
  const row = {
    id: t.id ? String(t.id) : Utilities.getUuid().slice(0, 8), code: clean_(t.code, 20), group: clean_(t.group, 40), name: clean_(t.name, 200),
    deliverable: clean_(t.deliverable, 200), owner: clean_(t.owner, 40), helpers: clean_(t.helpers, 200), start: t.start, end: t.end,
    weight: String(Math.max(0, Number(t.weight) || 0)), checkpoint: clean_(t.checkpoint, 10), note: clean_(t.note, 500),
  };
  if (t.id && findRow_('tasks', row.id)) return patch_('tasks', row.id, row);
  append_('tasks', row);
  return out_({ok: true, id: row.id});
}

/* ---------- 每週摘要（排程：週五 17:00，也可從選單手動寄出） ---------- */
function weeklyDigest() {
  const to = adminEmails_();
  if (!to.length) { Logger.log('「設定」B4 沒有主管 Email，未寄出'); return; }
  const today = ymdTz_(new Date()), weekAgo = ymdTz_(new Date(Date.now() - 7 * 864e5));
  const d = readAll_();
  const reports = d.reports.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  const at = (t, day) => { const r = reports.filter(x => x.taskId === t.id && ymdTz_(new Date(x.createdAt)) <= day)[0]; return r ? r.progress : 0; };
  const exp = (t, day) => day < t.start ? 0 : day >= t.end ? 100 : Math.round((dn_(day) - dn_(t.start) + 1) / (dn_(t.end) - dn_(t.start) + 1) * 100);
  const latest = {};
  reports.forEach(r => { if (!latest[r.taskId]) latest[r.taskId] = r; });
  d.tasks.forEach(t => {
    const l = latest[t.id];
    t.progress = l ? l.progress : 0;
    t.status = l ? (l.progress >= 100 ? '已完成' : l.status) : '未開始';
    t.issue = l && t.status !== '已完成' ? l.issue : '';
    t.exp = exp(t, today); t.last = l;
  });
  const W = d.tasks.reduce((s, t) => s + t.weight, 0) || 1;
  const actual = d.tasks.reduce((s, t) => s + t.weight * t.progress, 0) / W;
  const before = d.tasks.reduce((s, t) => s + t.weight * at(t, weekAgo), 0) / W;
  const planned = d.tasks.reduce((s, t) => s + t.weight * t.exp, 0) / W;
  const weekReps = reports.filter(r => ymdTz_(new Date(r.createdAt)) > weekAgo);
  const active = d.tasks.filter(t => t.start <= today && t.end > weekAgo);
  const owners = active.map(t => t.owner).filter((n, i, a) => n && a.indexOf(n) === i);
  const silent = owners.filter(n => !weekReps.some(r => r.reporter === n));
  const blocked = d.tasks.filter(t => t.status === '遇到困難');
  const overdue = d.tasks.filter(t => t.status !== '已完成' && today > t.end);
  const behind = d.tasks.filter(t => t.status !== '已完成' && today <= t.end && t.exp - t.progress >= 25);
  const waiting = d.helps.filter(h => h.status === '待回應');
  const nextWeek = ymdTz_(new Date(Date.now() + 7 * 864e5));
  const due = d.tasks.filter(t => t.status !== '已完成' && t.end >= today && t.end <= nextWeek);
  d.checkpoints.forEach(c => {
    if (c.auto === 'sec') c.current = d.modules.filter(m => m.sec === '複測通過').length;
    if (c.auto === 'cloud') c.current = d.modules.filter(m => m.cloud === '已上架').length;
  });
  const pct = v => Math.round(v) + '%', gap = actual - planned;
  const li = arr => arr.length ? '<ul style="margin:6px 0 0;padding-left:20px">' + arr.join('') + '</ul>' : '<p style="margin:6px 0 0;color:#8a91a3">無</p>';
  const tl = t => `<b>${esc_(t.code)}</b> ${esc_(t.name)}（${esc_(t.owner)}）`;
  const sec = (title, color, body) => `<h3 style="margin:22px 0 4px;font-size:15px;color:${color}">${title}</h3>${body}`;
  const html =
    `<div style="font-family:'Noto Sans TC','Microsoft JhengHei',sans-serif;max-width:640px;color:#1e2433;line-height:1.6">
     <h2 style="margin:0 0 4px">專案週報 ${md_(weekAgo)}–${md_(today)}</h2><div style="color:#8a91a3">AI模組跨領域應用推廣計畫</div>
     <table style="margin-top:16px;border-collapse:collapse;width:100%"><tr>
       ${[['整體完成率', pct(actual), `本週 ${actual - before >= 0 ? '+' : ''}${pct(actual - before)}`],
          ['依時程應達', pct(planned), gap < -5 ? `<span style="color:#d92d3a">落後 ${pct(-gap)}</span>` : gap > 5 ? `<span style="color:#15924a">超前 ${pct(gap)}</span>` : '符合進度'],
          ['本週回報', `${owners.length - silent.length}/${owners.length} 人`, `共 ${weekReps.length} 筆`],
          ['卡關／逾期', `${blocked.length}／${overdue.length}`, `待回應協助 ${waiting.length}`]]
         .map(k => `<td style="background:#f4f5fa;border:4px solid #fff;padding:10px;border-radius:10px;vertical-align:top"><div style="font-size:12px;color:#8a91a3">${k[0]}</div><div style="font-size:22px;font-weight:700">${k[1]}</div><div style="font-size:12px">${k[2]}</div></td>`).join('')}
     </tr></table>` +
    sec('查核點', '#4f46e5', li(d.checkpoints.map(c => `<li><b>${esc_(c.id)}</b>（${md_(c.due)}，剩 ${dn_(c.due) - dn_(today)} 天）${c.current}／${c.target}${c.current >= c.target ? ' ✅' : ''}</li>`))) +
    sec('🔴 遇到困難', '#d92d3a', li(blocked.map(t => `<li>${tl(t)}：${esc_(t.issue || '（未說明）')}${t.last && t.last.reply ? '<br><span style="color:#4f46e5">主管已回覆：' + esc_(t.last.reply) + '</span>' : ''}</li>`))) +
    sec('⏰ 逾期與落後', '#c27100', li(overdue.map(t => `<li>${tl(t)} 逾期 ${dn_(today) - dn_(t.end)} 天，${t.progress}%</li>`)
      .concat(behind.map(t => `<li>${tl(t)} ${t.progress}%，應達 ${t.exp}%</li>`)))) +
    sec('🙋 尚未回報（本週有進行中工作）', '#c27100', silent.length ? `<p style="margin:6px 0 0">${esc_(silent.join('、'))}</p>` : '<p style="margin:6px 0 0;color:#15924a">全員都已回報 👍</p>') +
    sec('🤝 等待回應的協助請求', '#c27100', li(waiting.map(h => `<li>${esc_(h.requester)} → ${esc_(h.helper)}：${esc_(h.content)}</li>`))) +
    sec('✅ 本週回報內容', '#15924a', li(weekReps.filter(r => r.done).slice(0, 25).map(r => { const t = d.tasks.filter(x => x.id === r.taskId)[0] || {code: ''}; return `<li><b>${esc_(t.code)}</b> ${esc_(r.reporter)}（${r.progress}%）：${esc_(r.done)}</li>`; }))) +
    sec('📅 未來 7 天到期', '#4f46e5', li(due.map(t => `<li>${tl(t)} ${md_(t.end)} 到期，目前 ${t.progress}%</li>`))) +
    `<p style="margin:26px 0 0"><a href="${SITE_URL}" style="background:#4f46e5;color:#fff;padding:10px 18px;border-radius:10px;text-decoration:none">開啟專案進度管理</a></p></div>`;
  MailApp.sendEmail({to: to.join(','), subject: `【專案週報】${md_(weekAgo)}–${md_(today)} 完成率 ${pct(actual)}${blocked.length ? '，' + blocked.length + ' 項卡關' : ''}`,
    htmlBody: html, name: 'AI模組推廣計畫 專案管理'});
  Logger.log('週報已寄給 ' + to.join(','));
}

/* ---------- Email 通知 ---------- */
function mail_(to, subject, html) {
  to = [].concat(to).filter(x => /@/.test(String(x || '')));
  if (!to.length) return;
  try {
    MailApp.sendEmail({to: to.join(','), subject: '【專案管理】' + subject, name: 'AI模組推廣計畫 專案管理',
      htmlBody: `<div style="font-family:'Noto Sans TC','Microsoft JhengHei',sans-serif;max-width:600px;color:#1e2433;line-height:1.6">${html}
        <p style="margin:20px 0 0"><a href="${SITE_URL}" style="background:#4f46e5;color:#fff;padding:9px 16px;border-radius:10px;text-decoration:none">開啟專案進度管理</a></p></div>`});
  } catch (e) { Logger.log('寄信失敗：' + e); } // 寄信失敗不影響回報本身
}
function adminEmails_() {
  const c = SpreadsheetApp.getActive().getSheetByName('設定');
  return c ? String(c.getRange('B4').getDisplayValue()).split(/[,，;；\s]+/).filter(x => /@/.test(x)) : [];
}
function emailOf_(name) {
  const p = read_('people').filter(x => x.name === name)[0];
  return p && /@/.test(p.email || '') ? p.email : '';
}
function box_(color, inner) { return `<div style="border-left:4px solid ${color};padding:4px 0 4px 14px">${inner}</div>`; }
function quote_(s) { return s ? `<div style="background:#f4f5fa;border-radius:8px;padding:8px 12px;margin-top:8px;white-space:pre-wrap">${esc_(s)}</div>` : ''; }
function esc_(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c])); }
function ymdTz_(d) { return Utilities.formatDate(d, TZ, 'yyyy-MM-dd'); }
function dn_(s) { return Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / 864e5; }
function md_(s) { return +s.slice(5, 7) + '/' + +s.slice(8, 10); }

/* ---------- helpers ---------- */
/* ---------- 佐證檔案 ---------- */
function addEvidence_(e, who) {
  const task = read_('tasks').filter(t => t.id === String(e.taskId))[0];
  if (!task) return out_({ok: false, error: '找不到這個工作項目'});
  if (who.role !== 'admin' && task.owner !== who.name) return out_({ok: false, error: '只有主責人可以上傳佐證'});
  const url = String(e.url || '').trim();
  if (!/^https?:\/\/\S+$/i.test(url) || url.length > 1000) return out_({ok: false, error: '請貼上 http 或 https 開頭的完整連結'});
  if (!String(e.title || '').trim()) return out_({ok: false, error: '請填寫檔案名稱'});
  append_('evidence', {id: Utilities.getUuid(), taskId: task.id, title: clean_(e.title, 120), url: url,
    addedBy: who.name || '主管', addedAt: now_()});
  return out_({ok: true});
}
function deleteEvidence_(id, who, full) {
  const e = read_('evidence').filter(x => x.id === String(id))[0];
  if (!e) return out_({ok: false, error: '找不到這筆佐證'});
  if (!full && e.addedBy !== who.name) return out_({ok: false, error: '只能刪除自己上傳的佐證'});
  return deleteRow_('evidence', e.id);
}
/**
 * 一鍵打包：在你的 Google Drive 建立「查核點X_佐證_日期」資料夾，
 * Google Drive 檔案複製進去、Drive 資料夾建立捷徑，並附一份「佐證清單」試算表（含所有連結與處理結果）。
 * checkpoint 為工作項目的「對應查核點」（1-1、1-2、1-3）；空白代表計畫管理；'all' 代表全部。
 */
function packEvidence_(checkpoint) {
  const cp = String(checkpoint == null ? 'all' : checkpoint);
  const tasks = read_('tasks').filter(t => cp === 'all' || (t.checkpoint || '') === cp);
  const ids = tasks.map(t => t.id), ev = read_('evidence').filter(e => ids.indexOf(e.taskId) >= 0);
  if (!ev.length) return out_({ok: false, error: '這個查核點還沒有任何佐證連結'});
  const label = cp === 'all' ? '全部查核點' : cp ? '查核點' + cp : '計畫管理';
  const folder = DriveApp.createFolder(label + '_佐證_' + Utilities.formatDate(new Date(), TZ, 'yyyyMMdd-HHmm'));
  const rows = [['工作編號', '工作項目', '主責', '應交付文件', '檔案名稱', '原始連結', '打包結果', '上傳人', '上傳時間']];
  tasks.forEach(t => {
    const list = ev.filter(e => e.taskId === t.id);
    if (!list.length) rows.push([t.code, t.name, t.owner, t.deliverable, '', '', '⚠ 尚未提供佐證', '', '']);
    list.forEach(e => {
      let result = '外部連結（請手動下載）';
      const m = /\/d\/([\w-]{20,})|[?&]id=([\w-]{20,})|\/folders\/([\w-]{20,})/.exec(e.url);
      try {
        if (m && m[3]) { folder.createShortcut(m[3]); result = '已建立資料夾捷徑'; }
        else if (m) { DriveApp.getFileById(m[1] || m[2]).makeCopy(t.code + '_' + e.title, folder); result = '已複製'; }
      } catch (x) { result = '無法存取（請確認檔案已共用給你）'; }
      rows.push([t.code, t.name, t.owner, t.deliverable, e.title, e.url, result, e.addedBy, Utilities.formatDate(new Date(e.addedAt), TZ, 'yyyy/MM/dd HH:mm')]);
    });
  });
  const idx = SpreadsheetApp.create(label + '_佐證清單');
  const sh = idx.getSheets()[0];
  sh.getRange(1, 1, rows.length, rows[0].length).setValues(rows);
  sh.getRange(1, 1, 1, rows[0].length).setFontWeight('bold').setBackground('#eef2ff');
  sh.setFrozenRows(1); sh.autoResizeColumns(1, rows[0].length);
  DriveApp.getFileById(idx.getId()).moveTo(folder);
  return out_({ok: true, url: folder.getUrl(), files: ev.length});
}

function involved_(task, name) {
  return task.owner === name || String(task.helpers || '').split(/[、,，\/／\s]+/).indexOf(name) >= 0;
}
function sheetOf_(k) { return SpreadsheetApp.getActive().getSheetByName(SHEETS[k].name); }
function read_(k) {
  const s = sheetOf_(k), cols = SHEETS[k].cols;
  if (!s || s.getLastRow() < 2) return [];
  return s.getRange(2, 1, s.getLastRow() - 1, cols.length).getDisplayValues()
    .filter(r => String(r[0]).trim() !== '')
    .map(r => { const o = {}; cols.forEach((c, i) => o[c] = String(r[i]).trim()); return o; });
}
function append_(k, obj) {
  const s = sheetOf_(k), cols = SHEETS[k].cols, r = s.getLastRow() + 1;
  s.getRange(r, 1, 1, cols.length).setNumberFormat('@').setValues([cols.map(c => obj[c] == null ? '' : String(obj[c]))]);
}
function patch_(k, id, patch) {
  const r = findRow_(k, id);
  if (!r) return out_({ok: false, error: '找不到這筆資料'});
  const s = sheetOf_(k), cols = SHEETS[k].cols;
  Object.keys(patch).forEach(c => { const i = cols.indexOf(c); if (i > 0) s.getRange(r, i + 1).setValue(String(patch[c])); });
  return out_({ok: true});
}
function deleteRow_(k, id) {
  const r = findRow_(k, id);
  if (r) sheetOf_(k).deleteRow(r);
  return out_({ok: true});
}
function findRow_(k, id) {
  const s = sheetOf_(k);
  if (!id || s.getLastRow() < 2) return null;
  const ids = s.getRange(2, 1, s.getLastRow() - 1, 1).getDisplayValues();
  for (let i = 0; i < ids.length; i++) if (String(ids[i][0]).trim() === String(id)) return i + 2;
  return null;
}
function adminPin_() {
  const c = SpreadsheetApp.getActive().getSheetByName('設定');
  return c ? String(c.getRange('B1').getDisplayValue()).trim() : '';
}
/** 24 碼隨機金鑰（英數字，約 142 位元），取代易被猜中的 6 位數密碼 */
function token_() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  let t = '';
  for (let i = 0; i < 24; i++) t += chars[Math.floor(Math.random() * chars.length)];
  return t;
}
/** 防暴力猜測：10 分鐘內錯誤超過 100 次即暫停所有金鑰驗證 10 分鐘 */
function tooManyFails_() { return Number(CacheService.getScriptCache().get('authFails') || 0) >= 100; }
function noteFail_() { const c = CacheService.getScriptCache(); c.put('authFails', String(Number(c.get('authFails') || 0) + 1), 600); }

/** 全部重新產生金鑰（主管與每位成員），舊連結立即失效。用於首次強化資安或連結外流時。 */
function rotateKeys() {
  const ss = SpreadsheetApp.getActive(), c = ss.getSheetByName('設定');
  c.getRange('A1').setValue('主管金鑰');
  c.getRange('B1').setNumberFormat('@').setValue(token_());
  c.getRange('A3:B3').setValues([['主管專屬連結', '="' + SITE_URL + '/#k="&B1']]);
  c.getRange('A2:B2').setValues([['說明', '請用 B3 主管專屬連結登入（可加入書籤）。成員專屬連結在「人員」F 欄，請個別私訊；連結外流時執行選單「資安：全部重新產生專屬連結」。']]);
  const s = ss.getSheetByName(SHEETS.people.name);
  if (s.getLastRow() >= 2) {
    const rows = s.getRange(2, 1, s.getLastRow() - 1, 1).getDisplayValues();
    rows.forEach((r, i) => { if (r[0].trim()) s.getRange(i + 2, 5).setNumberFormat('@').setValue(token_()); });
  }
  s.getRange(1, 5).setValue('個人金鑰（勿外流）');
  setupPins();
  const msg = '已重新產生全部專屬連結，舊連結已失效。主管連結在「設定」B3，成員連結在「人員」F 欄，請個別私訊。';
  Logger.log(msg);
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) { /* 從編輯器執行時沒有試算表畫面 */ }
}
function now_() { return new Date().toISOString(); }
/** 去除可能被試算表當成公式的開頭字元，並限制長度。 */
function clean_(v, max) {
  let s = String(v == null ? '' : v).trim().slice(0, max || 500);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}
function locked_(fn) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try { return fn(); } finally { lock.releaseLock(); }
}
function out_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
