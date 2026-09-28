'use strict';

const DB_NAME = 'challenge';
const DB_VERSION = 1;
const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];
const CHALLENGE_GOAL_DAYS = 100;

const $ = s => document.querySelector(s);
const pad = n => String(n).padStart(2, '0');
const toKey = date => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const parseKey = key => { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d, 12); };
const today = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 12); };
const diffDays = (later, earlier) => Math.round((Date.UTC(later.getFullYear(), later.getMonth(), later.getDate()) - Date.UTC(earlier.getFullYear(), earlier.getMonth(), earlier.getDate())) / 86400000);
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);
const escapeHtml = (s = '') => String(s).replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));

const DEFAULT_CHALLENGES = [
  { id: 'writing', name: '글쓰기', type: 'write', emoji: '✍️', order: 0 },
  { id: 'ramen', name: '라면 안 먹기', type: 'avoid', emoji: '🍜', order: 1 },
  { id: 'dessert', name: '디저트 안 먹기', type: 'avoid', emoji: '🍰', order: 2 },
];

// One-time seed from her own photographed writing-prompt book (added 2026-09-28).
// Merged into the prompts store on every load by text match, not just on first run,
// so it's safe to re-deploy without duplicating or clobbering prompts she's since added herself.
const DEFAULT_PROMPTS = [
  '어떤 색깔을 가장 좋아해?',
  '하루 중 집중이 가장 잘 되는 시간은 언제야?',
  '오늘 하루 중 가장 기억에 남는 장면이 있다면 묘사해줄래?',
  '지난 일주일 중에 가장 컨디션이 좋은 요일이 언제였어?',
  '네가 가장 편안함을 느끼는 장소는 어디야?',
  '어떤 삶을 살고 싶어?',
  '가장 멀리 사는 친구는 누구야?',
  '스트레스를 해소하는 너만의 방법은?',
  '처음 만나는 사람에게 먼저 말을 거는 편이야? 만약 그렇다면 첫 질문은?',
  '최근에 가장 너를 슬프게 했던 일은 뭐야?',
  '내일의 계획을 들려줘.',
  '얼마나 오랫동안 다른 사람을 기다릴 수 있니?',
  '너의 전 재산이 얼마인지 알고 있어?',
  '궁금한 게 생겼을 때 주로 어디서 정보를 얻어?',
  '최근에 들었던 말 중 가장 기분 좋은 말은?',
  '네가 가장 좋아하는 음식은 뭐야?',
  '오늘 하루를 망친 단 한 가지 원인을 꼽아본다면 뭐가 있을까?',
  '혼자만의 시간을 얼마나 자주 갖는지 궁금해.',
  '제시간에 퇴근하고 있어?',
  '최근 새롭게 흥미를 느끼게 된 분야가 있어?',
  '술을 얼마나 마실 수 있어?',
  '애완동물을 기른다면 어떤 동물이 좋아?',
  '네가 생각하는 꿈의 직장은 어디야?',
  '어제 몇 시에 잠자리에 들었어?',
  '연주할 수 있는 악기가 있어? 혹시 없다면 어떤 악기를 배우고 싶어?',
  '몸에서 가장 아픈 부위는 어디야?',
  '네가 사람을 사귈 때 가장 중요하게 생각하는 가치는 뭐야?',
  '가장 좋아하는 향기를 두 문장 이상으로 설명한다면?',
  '가지고 있는 것 중에 가장 오래된 선물은 뭐고 누가 준 거야?',
  '너는 아침형 인간일까, 저녁형 인간일까?',
  '지금 네 헤어스타일을 가능한 한 낭만적으로 묘사해줘.',
  '평생 화해할 수 없을 것 같은 사람이 있어? 왜 화해할 수 없을 것 같아?',
  '목표를 이루기 위해 무슨 일까지 할 수 있을 것 같아?',
  '이번 주에 가장 무리했던 일은 뭐였어?',
  '가장 좋아하는 액세서리는 어떤 거야? 얼마나 자주 착용해?',
  '네가 가장 자신 있게 만들 수 있는 요리는?',
  '오늘의 아침, 점심, 저녁 메뉴는?',
  '외롭다고 느낄 때가 있어? 언제 그렇니?',
  '오늘 네가 가장 듣고 싶은 말은?',
  '살아오면서 가장 행복했던 시간은?',
  '지금까지의 인생에서 가장 힘들었던 시간은?',
  '아침에 일어나서 가장 먼저 하는 일은?',
  '사소해도 좋아, 오늘 하루 감사했던 일을 찾아보자.',
  '최근에 성취감을 느낀 것은 어떤 때였어?',
  '너를 즐겁게 해주는 것은 뭐야?',
  '최근에 가장 화가 났던 때는 언제야? 무슨 일로 그랬어?',
  '너에게 부족한 점은 무엇이라고 생각해?',
  '10년, 20년, 30년이 지나도 변하지 않았으면 하는 네 모습에는 뭐가 있니?',
  '스스로 완벽주의자라고 생각해?',
  '오늘 하루 물을 몇 잔이나 마셨는지 기억나?',
  '지금 가장 가고 싶은 장소는?',
  '좋아하는 노래 중 가장 좋아하는 가사를 알려줘.',
  '4년에 한 번 있는 오늘, 무엇을 하면서 보냈어?',
  '너만의 징크스가 있다면 소개해줄래?',
  '너의 가장 큰 장점은 어떤 거야?',
  '너의 가장 큰 단점은 뭐라고 생각해?',
  '다른 사람들 눈에 어떻게 보이고 싶어?',
  '네가 생각하는 참다운 친구는 어떤 사람이야?',
  '앞으로 어떤 사랑을 하고 싶어?',
  '사랑하는 사람에게 가장 듣고 싶은 말이 뭐야?',
  '최근에 겪은 가장 억울하고 분했던 일은?',
  '너 자신을 사랑하니?',
  '네가 지금 가장 부러워하는 대상은 누구야?',
  '노력이 상황을 바꿀 수 있다고 생각해?',
  '네 삶의 원동력은 뭐야?',
  '지금까지의 인생에서 돌아가고 싶은 순간이 있어?',
  '지금보다 나은 내일을 위해서 어떤 일을 시도하고 있니?',
  '현재 프로필 사진은 어떤 거야?',
  '두려움을 극복하고 뭔가에 도전한 일이 있어?',
  '더 가까워지고 싶은 사람이 있어?',
  '오늘 누군가에게 초콜릿을 선물했어? 그 사람은 너에게 어떤 의미야?',
  '네 이름으로 삼행시를 지어봐.',
  '너를 미워하는 사람에게 어떤 말을 해주고 싶어?',
  '누군가를 울린 기억이 있어?',
  '오늘의 자신을 세 단어로 표현해본다면?',
  '인생의 전환점이었다고 생각하는 때는 언제야?',
  '첫눈에 반했던 사물이 있어? 어떤 거였어?',
  '어린 시절을 떠올릴 때 가장 포근했던 기억은?',
  '참기 힘든 유혹을 느낄 땐 어떻게 해?',
  '헤쳐나가야 할 네 몫의 역경이 있니?',
  '빨강 머리로 태어난다면 어떨 것 같아?',
  '어떤 단어가 가장 너를 잘 표현한다고 생각해?',
  '내일을 생각하면 어떤 기분이 들어?',
  '지금 나이가 되어서 좋은 점은 뭐가 있을까?',
  '인생에서 가장 지우고 싶은 때가 있니?',
  '스무 살의 너에게 하고 싶은 말은?',
  '지금 누구랑 같이 살고 있어?',
  '오늘의 나를 색으로 표현해보자.',
  '지금 지갑 속에 들어 있는 것들을 적어보자.',
  '예순 살이 되었을 때 너는 어디에서 살고 있을까?',
  '네 삶에서 가장 끊어내고 싶은 것이 있다면?',
  '금요일이나 토요일을 보내는 특별한 방법이 있니?',
  '긴장할 때 튀어나오는 버릇이 있어?',
  '오늘 너에게 친절히 대해준 사람이 있어?',
  '너의 인생을 책으로 쓴다면 제목은 무엇이 될까?',
  '외출할 때 꼭 챙겨야 하는 것들이 있어?',
  '좋아하는 동물이 있어?',
  '대화할 때 말하는 편이야, 듣는 편이야?',
  '중요한 결정을 내릴 때 마음이 시키는 대로 따르는 편이야?',
  '오늘 너를 웃게 한 존재는 누구야?',
  '함께 사는 사람 중 가장 가까운 사람은 누구야?',
];

let db;
let writings = new Map();
let prompts = new Map();
let checkins = new Map();
let challenges = [];
let calendarMonth = today();
let expandedChallenge = null;
let pendingWritingDate = null;
let promptPickMode = false;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const database = req.result;
      if (!database.objectStoreNames.contains('writings')) database.createObjectStore('writings', { keyPath: 'id' });
      if (!database.objectStoreNames.contains('prompts')) database.createObjectStore('prompts', { keyPath: 'id' });
      if (!database.objectStoreNames.contains('checkins')) database.createObjectStore('checkins', { keyPath: 'id' });
      if (!database.objectStoreNames.contains('challenges')) database.createObjectStore('challenges', { keyPath: 'id' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function tx(store, mode = 'readonly') { return db.transaction(store, mode).objectStore(store); }
function idbGetAll(store) {
  return new Promise((resolve, reject) => {
    const req = tx(store).getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
function idbPut(store, value) {
  return new Promise((resolve, reject) => {
    const req = tx(store, 'readwrite').put(value);
    req.onsuccess = resolve;
    req.onerror = () => reject(req.error);
  });
}
function idbDelete(store, key) {
  return new Promise((resolve, reject) => {
    const req = tx(store, 'readwrite').delete(key);
    req.onsuccess = resolve;
    req.onerror = () => reject(req.error);
  });
}

async function loadAll() {
  const w = await idbGetAll('writings');
  writings = new Map(w.map(r => [r.date, r]));
  let p = await idbGetAll('prompts');
  // One-time seed, gated by a flag rather than "does this text exist" -- otherwise a
  // deleted default prompt would silently reappear on every reload (same "deleted-never-
  // returns" pitfall as her Notion curation rules; a bug caught here by testing a reload
  // after deleting one, not just testing the happy path).
  if (!localStorage.getItem('challenge-prompts-seeded')) {
    const now = new Date().toISOString();
    for (const text of DEFAULT_PROMPTS) {
      const rec = { id: uuid(), text, used: false, createdAt: now };
      await idbPut('prompts', rec);
      p.push(rec);
    }
    localStorage.setItem('challenge-prompts-seeded', '1');
  }
  prompts = new Map(p.map(r => [r.id, r]));
  const c = await idbGetAll('checkins');
  checkins = new Map(c.map(r => [r.id, r]));
  let ch = await idbGetAll('challenges');
  if (!ch.length) {
    const now = new Date().toISOString();
    ch = DEFAULT_CHALLENGES.map(c => ({ ...c, startDate: toKey(today()), createdAt: now }));
    for (const c of ch) await idbPut('challenges', c);
  }
  // IndexedDB getAll() returns rows ordered by the keyPath ('id'), not insertion order --
  // without this, reloading always shows challenges alphabetically (dessert/ramen/writing)
  // instead of her intended writing-first order.
  challenges = ch.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}

let toastTimer;
function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2200);
}

// ---------- D-day ----------
function loadDday() {
  return {
    date: localStorage.getItem('challenge-dday-date') || '2027-01-01',
    label: localStorage.getItem('challenge-dday-label') || '2027년 1월 1일',
  };
}
function saveDday(date, label) {
  localStorage.setItem('challenge-dday-date', date);
  localStorage.setItem('challenge-dday-label', label);
}
function renderDday() {
  const { date, label } = loadDday();
  const target = parseKey(date);
  const n = diffDays(target, today());
  $('#ddayLabel').textContent = label;
  $('#ddayNumber').textContent = n > 0 ? `D-${n}` : n === 0 ? 'D-DAY' : `D+${-n}`;
}

// ---------- Writing ----------
function renderWritingCard() {
  const key = toKey(today());
  const entry = writings.get(key);
  if (entry) {
    $('#writingStatus').textContent = `오늘 "${entry.topic || '(제목 없음)'}" 글을 썼어요 (${entry.charCount}자)`;
    $('#writeTodayButton').textContent = '오늘 글 수정하기';
  } else {
    $('#writingStatus').textContent = '아직 오늘의 글을 안 썼어요.';
    $('#writeTodayButton').textContent = '오늘 글쓰기';
  }
}

function openWritingSheet(dateKey) {
  pendingWritingDate = dateKey;
  const entry = writings.get(dateKey);
  const date = parseKey(dateKey);
  $('#writingSheetTitle').textContent = `${date.getMonth() + 1}월 ${date.getDate()}일 글쓰기`;
  $('#topicInput').value = entry ? entry.topic : '';
  $('#contentInput').value = entry ? entry.content : '';
  updateCharCount();
  $('#deleteWriting').hidden = !entry;
  $('#writingSheet').hidden = false;
}
function closeWritingSheet() { $('#writingSheet').hidden = true; pendingWritingDate = null; }
function updateCharCount() {
  $('#charCount').textContent = `${$('#contentInput').value.length}자`;
}

async function saveWriting() {
  const topic = $('#topicInput').value.trim();
  const content = $('#contentInput').value;
  if (!topic && !content.trim()) { toast('주제나 내용을 입력해 주세요.'); return; }
  const now = new Date().toISOString();
  const existing = writings.get(pendingWritingDate);
  const entry = {
    id: existing ? existing.id : uuid(),
    date: pendingWritingDate,
    topic,
    content,
    charCount: content.length,
    createdAt: existing ? existing.createdAt : now,
    updatedAt: now,
  };
  await idbPut('writings', entry);
  writings.set(entry.date, entry);
  closeWritingSheet();
  renderWritingCard();
  if (expandedChallenge === 'writing') renderAccordion();
  toast('글을 저장했어요.');
}
async function deleteWriting() {
  if (!pendingWritingDate) return;
  const entry = writings.get(pendingWritingDate);
  if (!entry) return;
  await idbDelete('writings', entry.id);
  writings.delete(pendingWritingDate);
  closeWritingSheet();
  renderWritingCard();
  if (expandedChallenge === 'writing') renderAccordion();
  toast('글을 삭제했어요.');
}

// ---------- Prompt bank ----------
function renderPromptList() {
  const list = Array.from(prompts.values()).sort((a, b) => (a.used === b.used ? a.createdAt.localeCompare(b.createdAt) : a.used ? 1 : -1));
  $('#promptList').innerHTML = list.length ? list.map(p => `
    <div class="prompt-row${p.used ? ' used' : ''}" data-id="${p.id}">
      <button type="button" class="prompt-text">${escapeHtml(p.text)}</button>
      <button type="button" class="prompt-delete" aria-label="삭제">×</button>
    </div>
  `).join('') : '<p class="entry-empty">저장한 글감이 없어요. 아래에서 추가해 보세요.</p>';
}
function openPromptSheet(pickMode) {
  promptPickMode = pickMode;
  renderPromptList();
  $('#promptSheet').hidden = false;
}
function closePromptSheet() { $('#promptSheet').hidden = true; promptPickMode = false; }

async function pickPrompt(id) {
  const p = prompts.get(id);
  if (!p) return;
  $('#topicInput').value = p.text;
  p.used = true;
  await idbPut('prompts', p);
  prompts.set(p.id, p);
  closePromptSheet();
}
async function deletePrompt(id) {
  await idbDelete('prompts', id);
  prompts.delete(id);
  renderPromptList();
}

// ---------- Avoid challenges (ramen/dessert) ----------
function checkinId(challengeId, date) { return `${challengeId}:${date}`; }
function successCountFor(challengeId) {
  let n = 0;
  for (const c of checkins.values()) if (c.challengeId === challengeId && c.success) n += 1;
  return n;
}
async function toggleCheckin(challengeId, date) {
  const id = checkinId(challengeId, date);
  if (checkins.has(id)) {
    await idbDelete('checkins', id);
    checkins.delete(id);
  } else {
    const rec = { id, challengeId, date, success: true, createdAt: new Date().toISOString() };
    await idbPut('checkins', rec);
    checkins.set(id, rec);
  }
  renderAvoidCards();
  renderAccordion();
}

function renderAvoidCards() {
  const key = toKey(today());
  const wrap = $('#avoidCards');
  wrap.innerHTML = challenges.filter(c => c.type === 'avoid').map(c => {
    const start = parseKey(c.startDate);
    const dayNum = Math.max(1, diffDays(today(), start) + 1);
    const done = checkins.has(checkinId(c.id, key));
    return `
      <div class="card avoid-card">
        <div class="section-head">
          <h2>${c.emoji} ${escapeHtml(c.name)}</h2>
          <span class="progress-pill">${Math.min(dayNum, CHALLENGE_GOAL_DAYS)}/${CHALLENGE_GOAL_DAYS}일째</span>
        </div>
        <p class="avoid-summary">지금까지 성공 ${successCountFor(c.id)}일</p>
        <button type="button" class="toggle-button${done ? ' active' : ''}" data-challenge="${c.id}">${done ? '⭕ 오늘 성공! (다시 누르면 취소)' : '오늘도 안 먹었으면 눌러요'}</button>
      </div>
    `;
  }).join('');
}

// ---------- Calendar accordion ----------
function weekdayHeader() {
  return `<div class="weekday-row">${WEEKDAY.map(w => `<span>${w}</span>`).join('')}</div>`;
}

function monthGridFor(challenge) {
  const year = calendarMonth.getFullYear();
  const month = calendarMonth.getMonth();
  const first = new Date(year, month, 1, 12);
  const last = new Date(year, month + 1, 0, 12);
  let cells = '';
  for (let i = 0; i < first.getDay(); i++) cells += '<span class="day-cell blank"></span>';
  for (let day = 1; day <= last.getDate(); day++) {
    const date = new Date(year, month, day, 12);
    const key = toKey(date);
    const isToday = key === toKey(today());
    if (challenge.type === 'avoid') {
      const done = checkins.has(checkinId(challenge.id, key));
      cells += `<button type="button" class="day-cell${isToday ? ' today' : ''}${done ? ' success' : ''}" data-date="${key}" data-challenge="${challenge.id}">
        <span class="day-num">${day}</span>${done ? '<span class="day-mark">⭕</span>' : ''}
      </button>`;
    } else {
      const entry = writings.get(key);
      cells += `<button type="button" class="day-cell${isToday ? ' today' : ''}${entry ? ' success' : ''}" data-date="${key}" data-challenge="${challenge.id}">
        <span class="day-num">${day}</span>${entry ? '<span class="day-mark">✍️</span>' : ''}
      </button>`;
    }
  }
  return `<div class="calendar-grid">${cells}</div>`;
}

function renderAccordion() {
  $('#calendarTitle').textContent = `${calendarMonth.getFullYear()}년 ${calendarMonth.getMonth() + 1}월`;
  const wrap = $('#challengeAccordion');
  wrap.innerHTML = challenges.map(c => {
    const isOpen = expandedChallenge === c.id;
    const summary = c.type === 'avoid'
      ? `성공 ${successCountFor(c.id)}일`
      : `${writings.size}일 작성`;
    return `
      <div class="accordion-section${isOpen ? ' open' : ''}">
        <button type="button" class="accordion-header" data-challenge="${c.id}">
          <span>${c.emoji} ${escapeHtml(c.name)}</span>
          <span class="accordion-summary">${summary} <span class="chevron">${isOpen ? '︿' : '﹀'}</span></span>
        </button>
        ${isOpen ? `<div class="accordion-body">${weekdayHeader()}${monthGridFor(c)}</div>` : ''}
      </div>
    `;
  }).join('');
}

// ---------- PDF export ----------
async function exportWritingsToPdf() {
  const list = Array.from(writings.values()).sort((a, b) => a.date.localeCompare(b.date));
  if (!list.length) { toast('아직 저장된 글이 없어요.'); return; }
  toast('PDF 준비 중...');

  const root = document.createElement('div');
  root.style.cssText = 'position:fixed;left:-9999px;top:0;width:760px;background:#fff;color:#2b2b2b;font-family:"KkuBulLim",sans-serif;padding:40px;';
  root.innerHTML = `<h1 style="font-size:28px;margin:0 0 24px;">글쓰기 챌린지 모음</h1>` + list.map(w => `
    <div style="margin-bottom:28px;padding-bottom:20px;border-bottom:1px solid #ddd;">
      <p style="font-size:13px;color:#888;margin:0 0 6px;">${w.date}</p>
      <h2 style="font-size:19px;margin:0 0 10px;">${escapeHtml(w.topic || '(제목 없음)')}</h2>
      <p style="font-size:15px;line-height:1.7;white-space:pre-wrap;margin:0;">${escapeHtml(w.content)}</p>
    </div>
  `).join('');
  document.body.appendChild(root);

  try {
    const canvas = await html2canvas(root, { scale: 2, backgroundColor: '#ffffff' });
    const pdf = new window.jspdf.jsPDF({ unit: 'mm', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidthMm = pageWidth;
    const pxPerMm = canvas.width / imgWidthMm;
    const pageHeightPx = Math.floor(pageHeight * pxPerMm);

    let renderedPx = 0;
    let first = true;
    while (renderedPx < canvas.height) {
      const sliceHeightPx = Math.min(pageHeightPx, canvas.height - renderedPx);
      const sliceCanvas = document.createElement('canvas');
      sliceCanvas.width = canvas.width;
      sliceCanvas.height = sliceHeightPx;
      const ctx = sliceCanvas.getContext('2d');
      ctx.drawImage(canvas, 0, renderedPx, canvas.width, sliceHeightPx, 0, 0, canvas.width, sliceHeightPx);
      const imgData = sliceCanvas.toDataURL('image/png');
      if (!first) pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidthMm, sliceHeightPx / pxPerMm);
      renderedPx += sliceHeightPx;
      first = false;
    }
    pdf.save(`글쓰기챌린지_${toKey(today())}.pdf`);
    toast('PDF를 저장했어요.');
  } catch (e) {
    toast('PDF 만들기에 실패했어요.');
  } finally {
    root.remove();
  }
}

// ---------- Screen switching ----------
function switchScreen(name) {
  $('#home-screen').hidden = name !== 'home';
  $('#calendar-screen').hidden = name !== 'calendar';
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.screen === name));
  if (name === 'calendar') renderAccordion();
}

function bindEvents() {
  document.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => switchScreen(t.dataset.screen)));

  $('#ddayCard').addEventListener('click', () => {
    const { date, label } = loadDday();
    $('#ddayDateInput').value = date;
    $('#ddayNameInput').value = label;
    $('#ddaySheet').hidden = false;
  });
  $('#cancelDday').addEventListener('click', () => { $('#ddaySheet').hidden = true; });
  $('#saveDday').addEventListener('click', () => {
    const date = $('#ddayDateInput').value;
    if (!date) { toast('날짜를 선택해 주세요.'); return; }
    const label = $('#ddayNameInput').value.trim() || date;
    saveDday(date, label);
    $('#ddaySheet').hidden = true;
    renderDday();
  });

  $('#writeTodayButton').addEventListener('click', () => openWritingSheet(toKey(today())));
  $('#cancelWriting').addEventListener('click', closeWritingSheet);
  $('#saveWriting').addEventListener('click', saveWriting);
  $('#deleteWriting').addEventListener('click', deleteWriting);
  $('#contentInput').addEventListener('input', updateCharCount);
  $('#pickPromptInline').addEventListener('click', () => openPromptSheet(true));

  $('#openPromptBank').addEventListener('click', () => openPromptSheet(false));
  $('#closePromptSheet').addEventListener('click', closePromptSheet);
  $('#exportPdfButton').addEventListener('click', exportWritingsToPdf);
  $('#addPromptForm').addEventListener('submit', async e => {
    e.preventDefault();
    const text = $('#newPromptInput').value.trim();
    if (!text) return;
    const p = { id: uuid(), text, used: false, createdAt: new Date().toISOString() };
    await idbPut('prompts', p);
    prompts.set(p.id, p);
    $('#newPromptInput').value = '';
    renderPromptList();
  });
  $('#promptList').addEventListener('click', e => {
    const row = e.target.closest('.prompt-row');
    if (!row) return;
    const id = row.dataset.id;
    if (e.target.closest('.prompt-delete')) { deletePrompt(id); return; }
    if (e.target.closest('.prompt-text') && promptPickMode) pickPrompt(id);
  });

  $('#avoidCards').addEventListener('click', e => {
    const btn = e.target.closest('.toggle-button');
    if (!btn) return;
    toggleCheckin(btn.dataset.challenge, toKey(today()));
  });

  $('#prevMonth').addEventListener('click', () => { calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1, 12); renderAccordion(); });
  $('#nextMonth').addEventListener('click', () => { calendarMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1, 12); renderAccordion(); });

  $('#challengeAccordion').addEventListener('click', e => {
    const header = e.target.closest('.accordion-header');
    if (header) {
      const id = header.dataset.challenge;
      expandedChallenge = expandedChallenge === id ? null : id;
      renderAccordion();
      return;
    }
    const cell = e.target.closest('.day-cell');
    if (!cell || cell.classList.contains('blank')) return;
    const { date, challenge: challengeId } = cell.dataset;
    const challenge = challenges.find(c => c.id === challengeId);
    if (!challenge) return;
    if (challenge.type === 'avoid') toggleCheckin(challengeId, date);
    else openWritingSheet(date);
  });
}

async function init() {
  bindEvents();
  try {
    db = await openDB();
    await loadAll();
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  } catch (e) { /* IndexedDB unavailable */ }
  renderDday();
  renderWritingCard();
  renderAvoidCards();
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' }).then(reg => reg.update()).catch(() => {});
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => { if (reloading) return; reloading = true; location.reload(); });
  }
}

init();
