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
  const p = await idbGetAll('prompts');
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
