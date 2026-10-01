/**
 * AI模組跨領域應用推廣計畫 專案進度管理 — Google Apps Script 後端
 * 資料存在本試算表的「工作項目」「回報紀錄」「協助請求」「模組看板」「查核點」「人員」「設定」分頁。
 * 第一次使用：重新整理試算表 → 上方選單「專案管理」→「初始設定（第一次使用）」，再部署為網頁應用程式。
 */
const SITE_URL = 'https://ai-module-tracker.vercel.app'; // 網站正式網址（產生專屬連結用）
const OPEN_LOGIN = true; // true＝成員免密碼，登入畫面點名字即可進入（主管功能仍需主管密碼）

const SHEETS = {
  tasks: {name: '工作項目', cols: ['id', 'code', 'group', 'name', 'deliverable', 'owner', 'helpers', 'start', 'end', 'weight', 'checkpoint', 'note'],
    head: ['ID', '編號', '分項', '工作項目', '產出／交付文件', '主責', '協辦（以、分隔）', '起始日', '完成日', '權重%', '對應查核點', '備註']},
  reports: {name: '回報紀錄', cols: ['id', 'createdAt', 'taskId', 'reporter', 'progress', 'status', 'done', 'next', 'issue', 'reply', 'replyAt'],
    head: ['ID', '回報時間', '工作項目ID', '回報人', '完成度%', '狀態', '本次完成', '下一步', '遇到的難題', '主管回覆', '回覆時間']},
  helps: {name: '協助請求', cols: ['id', 'createdAt', 'taskId', 'requester', 'helper', 'content', 'status', 'response', 'updatedAt'],
    head: ['ID', '建立時間', '工作項目ID', '請求人', '協助人', '需要協助的內容', '狀態', '協助回覆', '更新時間']},
  modules: {name: '模組看板', cols: ['id', 'name', 'owner', 'sec', 'secHigh', 'cloud', 'note', 'updatedBy', 'updatedAt'],
    head: ['代號', '模組名稱', '負責人', '資安檢測(1-1)', '未修補高風險數', '雲端上架(1-2)', '備註', '更新人', '更新時間']},
  checkpoints: {name: '查核點', cols: ['id', 'due', 'title', 'target', 'current', 'auto', 'note', 'updatedBy', 'updatedAt'],
    head: ['查核點', '完成期限', '查核點概述', '目標值', '目前達成值', '自動計算來源', '備註', '更新人', '更新時間']},
  people: {name: '人員', cols: ['name', 'title', 'pm', 'focus', 'pin', 'link'],
    head: ['姓名', '職級', '本區間人月', '本區間工作重點', '個人密碼', '專屬連結（複製後私訊給本人）']},
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
  ['c2', 'C2', '1-3 模組擴散應用', '目標工具機廠名單建立與洽談簽署(≥2家)', '合作意向書／參與同意書', '覺文郁', '莊嘉雲', '2026-10-05', '2026-10-25', 4, '1-3', ''],
  ['c3', 'C3', '1-3 模組擴散應用', '終端擴散企業名單開發與邀約(累計≥25家)', '擴散企業名冊', '莊嘉雲', '周芷涵、林永祥', '2026-10-12', '2026-11-22', 5, '1-3', ''],
  ['c4', 'C4', '1-3 模組擴散應用', '工具機廠導入需求訪談與模組媒合、技術輔導', '需求訪談暨媒合紀錄', '覺文郁', '郭泰均', '2026-10-26', '2026-11-22', 4, '1-3', ''],
  ['c5', 'C5', '1-3 模組擴散應用', '推廣說明會／成果展示會辦理(2場)', '會議簽到表、照片、問卷', '周芷涵', '林永祥、莊嘉雲', '2026-11-02', '2026-11-29', 5, '1-3', ''],
  ['c6', 'C6', '1-3 模組擴散應用', '導入案例紀錄與擴散家數統計表建置', '擴散家數統計表暨案例集', '林永祥', '莊嘉雲', '2026-11-09', '2026-11-30', 3, '1-3', '為 12/10 查核點預備'],
  ['m1', 'M1', '計畫管理', '雙週進度管控會議(10/9、10/23、11/6、11/20、11/30)', '會議紀錄', '蘇順豐', '覺文郁、郭泰均、許禮維、王振宇、莊嘉雲、周芷涵、林永祥', '2026-10-01', '2026-11-30', 2, '', ''],
  ['m2', 'M2', '計畫管理', '經費執行管控(材料費115萬／代辦加工45萬／業務費)與核銷', '經費執行進度表', '莊嘉雲', '林永祥', '2026-10-01', '2026-11-30', 2, '', ''],
  ['m3', 'M3', '計畫管理', '查核點佐證文件彙整與期末報告初稿準備', '查核點佐證資料夾', '林永祥', '周芷涵', '2026-11-16', '2026-11-30', 2, '', ''],
];
const SEED_PEOPLE = [
  ['蘇順豐', '計畫主持人', 1.6, '計畫整體規劃、跨單位協調、查核點核定、成果對外代表'],
  ['覺文郁', '共同主持人', 1.6, '工具機廠洽談與擴散策略、技術審查、產學媒合'],
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
    .addToUi();
}

/** 第一次使用時執行一次：建立分頁、匯入工作彙整表、產生密碼。可重複執行，不會覆蓋已有資料。 */
function setup() {
  const ss = SpreadsheetApp.getActive();
  const seed = {tasks: SEED_TASKS, modules: SEED_MODULES.map(m => [m[0], m[1], m[2], '未開始', 0, '未開始', '', '', '']),
    checkpoints: SEED_CHECKPOINTS.map(c => c.concat(['', '', ''])), people: SEED_PEOPLE.map(p => p.concat(['', '']))};
  Object.keys(SHEETS).forEach(k => {
    const def = SHEETS[k];
    let s = ss.getSheetByName(def.name);
    if (!s) s = ss.insertSheet(def.name);
    if (s.getLastRow() === 0) {
      s.appendRow(def.head); s.setFrozenRows(1);
      s.getRange(1, 1, 1, def.head.length).setFontWeight('bold').setBackground('#eef2ff');
    }
    s.getRange(1, 1, s.getMaxRows(), def.cols.length).setNumberFormat('@'); // 全部以文字儲存，避免日期／密碼被自動轉換
    if (seed[k] && s.getLastRow() < 2) s.getRange(2, 1, seed[k].length, def.cols.length).setValues(seed[k].map(r => r.map(String)));
  });
  let c = ss.getSheetByName('設定');
  if (!c) {
    c = ss.insertSheet('設定');
    c.getRange('A1:B2').setValues([
      ['主管密碼', pin_([])],
      ['說明', '主管密碼可看全部、回覆、編輯工作項目。成員各自的密碼在「人員」分頁 E 欄，改密碼直接修改即可，舊連結立即失效。'],
    ]);
    c.getRange('B1').setNumberFormat('@');
    c.getRange('A3:B3').setValues([['主管專屬連結', '="' + SITE_URL + '/#k="&B1']]);
    c.setColumnWidth(1, 110); c.setColumnWidth(2, 560);
  }
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
    if (!r[4].trim()) { r[4] = pin_(used); used.push(r[4]); n++; }
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
      return out_({ok: true, open: OPEN_LOGIN, people: OPEN_LOGIN ? read_('people').map(x => ({name: x.name, title: x.title})) : []});
    const who = auth_(p.pin, p.as);
    if (!who) return out_({ok: false, error: 'pin'});
    const admin = who.role === 'admin';
    const deny = () => out_({ok: false, error: '只有主管可以執行這個動作'});
    switch (p.action) {
      case 'data': return out_(Object.assign({ok: true, role: who.role, me: who.name}, readAll_()));
      case 'report': return locked_(() => addReport_(p.report || {}, who));
      case 'reply': return admin ? locked_(() => patch_('reports', p.id, {reply: clean_(p.reply, 2000), replyAt: now_()})) : deny();
      case 'deleteReport': return admin ? locked_(() => deleteRow_('reports', p.id)) : deny();
      case 'saveTask': return admin ? locked_(() => saveTask_(p.task || {})) : deny();
      case 'deleteTask': return admin ? locked_(() => deleteRow_('tasks', p.id)) : deny();
      case 'help': return locked_(() => addHelp_(p.help || {}, who));
      case 'helpUpdate': return locked_(() => updateHelp_(p, who));
      case 'saveModule': return locked_(() => saveModule_(p.module || {}, who));
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
  if (p) return {role: 'member', name: p.name};
  const n = OPEN_LOGIN && as ? people.filter(x => x.name === String(as).trim())[0] : null;
  return n ? {role: 'member', name: n.name} : null;
}

function readAll_() {
  const people = read_('people').map(p => ({name: p.name, title: p.title, pm: Number(p.pm) || 0, focus: p.focus}));
  return {
    tasks: read_('tasks').map(t => Object.assign(t, {weight: Number(t.weight) || 0})),
    reports: read_('reports').map(r => Object.assign(r, {progress: Number(r.progress) || 0})),
    helps: read_('helps'),
    modules: read_('modules').map(m => Object.assign(m, {secHigh: Number(m.secHigh) || 0})),
    checkpoints: read_('checkpoints').map(c => Object.assign(c, {target: Number(c.target) || 0, current: Number(c.current) || 0})),
    people: people,
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
  (Array.isArray(r.helpers) ? r.helpers : []).filter(n => names.indexOf(n) >= 0 && n !== row.reporter).forEach(n => {
    append_('helps', {id: Utilities.getUuid(), createdAt: now_(), taskId: task.id, requester: row.reporter, helper: n,
      content: clean_(r.helpText || r.issue, 2000), status: '待回應', response: '', updatedAt: now_()});
  });
  return out_({ok: true, id: row.id});
}

function addHelp_(h, who) {
  const names = read_('people').map(p => p.name);
  const requester = who.role === 'admin' ? String(h.requester || '') : (h.offer ? String(h.requester || '') : who.name);
  const helper = h.offer && who.role !== 'admin' ? who.name : String(h.helper || '');
  if (names.indexOf(requester) < 0 || names.indexOf(helper) < 0 || requester === helper) return out_({ok: false, error: '請選擇協助對象'});
  if (!String(h.content || '').trim()) return out_({ok: false, error: '請寫下需要協助的內容'});
  append_('helps', {id: Utilities.getUuid(), createdAt: now_(), taskId: String(h.taskId || ''), requester: requester, helper: helper,
    content: clean_(h.content, 2000), status: h.offer ? '協助中' : '待回應', response: '', updatedAt: now_()});
  return out_({ok: true});
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

/* ---------- helpers ---------- */
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
function pin_(used) {
  let p;
  do { p = String(Math.floor(100000 + Math.random() * 900000)); } while (used.indexOf(p) >= 0);
  return p;
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
