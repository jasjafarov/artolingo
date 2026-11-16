/* Artolingo: a Duolingo-style art course as a Telegram Mini App.
   Plain JavaScript, no build step. Content lives in content/*.json. */
(function () {
  "use strict";

  const tg = window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initData !== undefined
    ? window.Telegram.WebApp : null;
  const REVIEW_STEPS = [1, 3, 7, 21];      // days until a missed card comes back
  const XP_LESSON = 10, XP_PERFECT = 5, XP_REVIEW = 2;
  const MAX_REVIEW_IN_LESSON = 2, MAX_REVIEW_SESSION = 10;
  const STORE_KEY = "artolingo_state_v1";
  // Telegram user ids allowed to open the app. Empty = anyone with the link.
  const ALLOWED_USERS = []; // TODO: add the owner's id once confirmed (shown at the bottom of the home screen)

  const UI = {
    en: {
      review: "Review", reviewDue: n => `${n} card${n === 1 ? "" : "s"} to review`, reviewNone: "Nothing to review today",
      check: "Check", cont: "Continue", start: "Start", correct: "Correct!", wrong: "Not quite",
      answerWas: "Correct answer:", pickTwo: n => `Pick ${n}.`, tapOrder: "Tap the paintings from oldest to newest. Tap again to undo.",
      story: "Story", lookCloser: "Look closer", unseen: "Unseen painting", reviewTag: "Review", checkpoint: "Checkpoint",
      done: "Lesson complete!", perfect: "No mistakes!", xp: "XP", mistakes: "Mistakes", streak: "Day streak",
      back: "Back to lessons", goalDone: "Today's lesson is done. See you tomorrow!", goalTodo: "Do one lesson today to keep your streak.",
      cpPass: "Checkpoint passed! You can tell the two movements apart.", cpFail: "Almost. Try again after a review.",
      zoom: "zoomed in", order: "Which came first", locked: "Finish the previous lesson first",
      footer: "Missed cards come back after 1, 3, 7 and 21 days.", reviewDone: "Review done!",
      quit: "Quit this lesson? Progress in it will be lost.",
      intro: "Background", skip: "Skip intro ›", glossary: "Glossary", glossarySub: "Art words explained simply",
      tapWords: "Tip: tap underlined words to see what they mean.", lessonsN: n => `${n} lessons + checkpoint`, close: "Close",
      zoomHint: "Pinch or double-tap to zoom", tapZoom: "tap to zoom",
      ai: "Art helper", aiHello: "Hi! Ask me anything about this painting, the lesson, or art in general. I'll explain it simply.",
      aiPlaceholder: "Ask a question…", aiSend: "Send", aiThinking: "Thinking…", aiNew: "New chat", aiKeyMenu: "AI key",
      aiSetupTitle: "Turn on the helper (once)", aiSetupText: "The helper needs a free key from Google. 1) Tap the button below and press \"Create API key\". 2) Copy the key. 3) Come back and paste it here. Free, no card needed. The key is saved only in your Telegram.",
      aiGetKey: "Get a free key from Google", aiPaste: "Paste key here (starts with AQ. or AIza)", aiSave: "Save and start", aiBadKey: "That doesn't look like a key. A Google key starts with AQ. or AIza.",
      aiRemove: "Remove key", aiError: "Something went wrong:", aiSuggest: ["Explain this simply", "Who painted this and when?", "What should I look at here?", "What does this word mean?"]
    },
    ru: {
      review: "Повторение", reviewDue: n => `Карточек к повторению: ${n}`, reviewNone: "Сегодня повторять нечего",
      check: "Проверить", cont: "Далее", start: "Начать", correct: "Верно!", wrong: "Не совсем",
      answerWas: "Правильный ответ:", pickTwo: n => `Выберите ${n}.`, tapOrder: "Нажимайте на картины от ранней к поздней. Нажмите ещё раз, чтобы отменить.",
      story: "История", lookCloser: "Присмотритесь", unseen: "Новая картина", reviewTag: "Повторение", checkpoint: "Проверка",
      done: "Урок пройден!", perfect: "Без ошибок!", xp: "XP", mistakes: "Ошибки", streak: "Дней подряд",
      back: "К урокам", goalDone: "Урок на сегодня пройден. До завтра!", goalTodo: "Пройдите один урок сегодня, чтобы не прервать серию.",
      cpPass: "Проверка пройдена! Вы различаете два направления.", cpFail: "Почти. Повторите и попробуйте снова.",
      zoom: "крупный план", order: "Что раньше", locked: "Сначала пройдите предыдущий урок",
      footer: "Ошибки возвращаются через 1, 3, 7 и 21 день.", reviewDone: "Повторение закончено!",
      quit: "Выйти из урока? Прогресс в нём не сохранится.",
      intro: "Предыстория", skip: "Пропустить ›", glossary: "Словарик", glossarySub: "Слова из мира искусства простыми словами",
      tapWords: "Совет: нажмите на подчёркнутое слово, чтобы узнать, что оно значит.", lessonsN: n => `${n} уроков + проверка`, close: "Закрыть",
      zoomHint: "Разведите пальцы или нажмите дважды, чтобы приблизить", tapZoom: "нажмите, чтобы увеличить",
      ai: "Помощник", aiHello: "Привет! Спросите меня что угодно об этой картине, уроке или искусстве вообще. Объясню просто.",
      aiPlaceholder: "Задайте вопрос…", aiSend: "Отправить", aiThinking: "Думаю…", aiNew: "Новый чат", aiKeyMenu: "Ключ ИИ",
      aiSetupTitle: "Включить помощника (один раз)", aiSetupText: "Помощнику нужен бесплатный ключ от Google. 1) Нажмите кнопку ниже и затем «Create API key». 2) Скопируйте ключ. 3) Вернитесь и вставьте его сюда. Бесплатно, карта не нужна. Ключ хранится только в вашем Telegram.",
      aiGetKey: "Получить бесплатный ключ Google", aiPaste: "Вставьте ключ (начинается с AQ. или AIza)", aiSave: "Сохранить и начать", aiBadKey: "Это не похоже на ключ. Ключ Google начинается с AQ. или AIza.",
      aiRemove: "Удалить ключ", aiError: "Что-то пошло не так:", aiSuggest: ["Объясни просто", "Кто это написал и когда?", "На что здесь смотреть?", "Что значит это слово?"]
    }
  };

  let paintings = {}, course = null, state = null, glossary = { terms: [], movements: {} }, termRe = {};
  const app = document.getElementById("app");

  // ---------- helpers ----------
  const today = () => { const d = new Date(); return Math.floor((d - d.getTimezoneOffset() * 60000) / 86400000); };
  const weekOf = day => Math.floor((day + 3) / 7);
  const t = () => UI[state.lang];
  const L = obj => (obj ? obj[state.lang] || obj.en : "");
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const imgSrc = id => `images/${id}.jpg`;
  const caption = id => { const p = paintings[id]; return p ? `${L(p.artist)}, ${L(p.title)} (${p.year})` : id; };
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const haptic = kind => { try { tg && tg.HapticFeedback.notificationOccurred(kind); } catch (e) {} };
  const movementOf = id => { const p = paintings[id]; return p && glossary.movements[p.movement] ? L(glossary.movements[p.movement]) : ""; };
  const reEsc = s => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  function buildTermRe() {
    ["en", "ru"].forEach(lang => {
      const pairs = [];
      glossary.terms.forEach(g => (g.match[lang] || []).forEach(m => pairs.push([m.toLowerCase(), g.id])));
      pairs.sort((a, b) => b[0].length - a[0].length);
      termRe[lang] = { re: new RegExp(`(^|[^\\p{L}])(${pairs.map(p => reEsc(p[0])).join("|")})(\\p{L}*)`, "giu"), map: new Map(pairs) };
    });
  }
  // Escapes text and underlines glossary words (first time each term appears) so they can be tapped.
  function rich(str) {
    const tr = termRe[state.lang]; str = String(str || "");
    if (!tr || !tr.map.size) return esc(str);
    const seen = new Set(); let out = "", last = 0, m;
    tr.re.lastIndex = 0;
    while ((m = tr.re.exec(str))) {
      const id = tr.map.get(m[2].toLowerCase()), start = m.index + m[1].length;
      if (!id || seen.has(id)) continue;
      seen.add(id);
      out += esc(str.slice(last, start)) + `<span class="term" data-g="${id}">${esc(m[2] + m[3])}</span>`;
      last = start + m[2].length + m[3].length;
    }
    return out + esc(str.slice(last));
  }
  function showTerm(id) {
    const g = glossary.terms.find(x => x.id === id); if (!g) return;
    const sheet = document.getElementById("sheet");
    sheet.querySelector(".sheet-title").textContent = L(g.term);
    sheet.querySelector(".sheet-text").textContent = L(g.def);
    sheet.querySelector(".sheet-close").textContent = t().close;
    sheet.classList.remove("hidden");
  }
  document.addEventListener("click", e => {
    const el = e.target.closest && e.target.closest(".term");
    if (el) { e.stopPropagation(); showTerm(el.dataset.g); return; }
    const sheet = document.getElementById("sheet");
    if (sheet && !sheet.classList.contains("hidden") && (e.target === sheet || e.target.closest(".sheet-close"))) sheet.classList.add("hidden");
  }, true);
  const h = (html) => { const d = document.createElement("div"); d.innerHTML = html.trim(); return d.firstChild; };

  // ---------- storage (Telegram cloud + local) ----------
  function defaultState() {
    const lang = ((tg && tg.initDataUnsafe && tg.initDataUnsafe.user && tg.initDataUnsafe.user.language_code) || navigator.language || "en")
      .toLowerCase().startsWith("ru") ? "ru" : "en";
    return { lang, xp: 0, streak: 0, lastDay: null, freezeWeek: null, done: {}, reviews: {}, updated: 0 };
  }
  function cloudOK() { return tg && tg.CloudStorage && tg.isVersionAtLeast && tg.isVersionAtLeast("6.9"); }
  function loadState() {
    let local = null;
    try { local = JSON.parse(localStorage.getItem(STORE_KEY)); } catch (e) {}
    const base = Object.assign(defaultState(), local || {});
    if (!cloudOK()) return Promise.resolve(base);
    return new Promise(res => {
      const timer = setTimeout(() => res(base), 2500);
      tg.CloudStorage.getItem(STORE_KEY, (err, val) => {
        clearTimeout(timer);
        try { const cloud = val ? JSON.parse(val) : null; if (cloud && cloud.updated > (base.updated || 0)) return res(Object.assign(defaultState(), cloud)); } catch (e) {}
        res(base);
      });
    });
  }
  function saveState() {
    state.updated = Date.now();
    const s = JSON.stringify(state);
    try { localStorage.setItem(STORE_KEY, s); } catch (e) {}
    if (cloudOK()) { try { tg.CloudStorage.setItem(STORE_KEY, s, () => {}); } catch (e) {} }
  }

  // ---------- streak, review queue ----------
  function currentStreak() {
    if (state.lastDay === null) return 0;
    const gap = today() - state.lastDay;
    if (gap <= 1) return state.streak;
    if (gap === 2 && state.freezeWeek !== weekOf(today())) return state.streak; // one forgiven day per week
    return 0;
  }
  function markActiveToday() {
    const d = today();
    if (state.lastDay === d) return;
    const gap = state.lastDay === null ? 99 : d - state.lastDay;
    if (gap === 1) state.streak += 1;
    else if (gap === 2 && state.freezeWeek !== weekOf(d)) { state.streak += 1; state.freezeWeek = weekOf(d); }
    else state.streak = 1;
    state.lastDay = d;
  }
  function cardByKey(key) {
    const [lid, idx] = key.split(":");
    const lesson = course.lessons.find(l => l.id === lid);
    return lesson && lesson.cards[+idx];
  }
  function dueReviews() {
    const d = today();
    return Object.keys(state.reviews).filter(k => state.reviews[k].d <= d && cardByKey(k))
      .sort((a, b) => state.reviews[a].d - state.reviews[b].d);
  }
  function recordAnswer(key, right, isReview) {
    const r = state.reviews[key];
    if (!right) state.reviews[key] = { s: 0, d: today() + REVIEW_STEPS[0] };
    else if (r && isReview) {
      const s = r.s + 1;
      if (s >= REVIEW_STEPS.length) delete state.reviews[key];
      else state.reviews[key] = { s, d: today() + REVIEW_STEPS[s] };
    }
  }

  // ---------- top bar ----------
  function topBar() {
    const bar = h(`<div class="top">
      <div class="stat" title="${esc(t().streak)}">🔥 ${currentStreak()}</div>
      <div class="stat" title="XP">⭐ ${state.xp}</div>
      <div class="spacer"></div>
      <button class="lang">${state.lang === "ru" ? "RU · en" : "EN · ru"}</button></div>`);
    bar.querySelector(".lang").onclick = () => { state.lang = state.lang === "ru" ? "en" : "ru"; saveState(); renderHome(); };
    return bar;
  }

  // ---------- home ----------
  function lessonUnlocked(i) { return i === 0 || !!state.done[course.lessons[i - 1].id]; }
  function renderHome() {
    document.body.classList.remove("in-lesson");
    if (tg) { tg.BackButton.hide(); }
    document.documentElement.lang = state.lang;
    app.innerHTML = "";
    app.appendChild(topBar());
    const home = h(`<div class="home">
      <div class="unit-title">${esc(L(course.unit.title))}</div>
      <div class="unit-sub">${esc(t().lessonsN(course.lessons.length - 1))}</div></div>`);
    const doneToday = state.lastDay === today();
    home.appendChild(h(`<div class="goal">${doneToday ? "✅" : "🎯"} <span>${esc(doneToday ? t().goalDone : t().goalTodo)}</span></div>`));
    const due = dueReviews();
    const rb = h(`<button class="review-btn ${due.length ? "" : "empty"}">🔁 <span><b>${esc(t().review)}</b><br>${esc(due.length ? t().reviewDue(due.length) : t().reviewNone)}</span></button>`);
    if (due.length) rb.onclick = () => startSession(null);
    home.appendChild(rb);
    const gb = h(`<button class="review-btn glossary-btn">📖 <span><b>${esc(t().glossary)}</b><br>${esc(t().glossarySub)}</span></button>`);
    gb.onclick = renderGlossary;
    home.appendChild(gb);
    let nextMarked = false;
    course.lessons.forEach((lesson, i) => {
      const open = lessonUnlocked(i), done = state.done[lesson.id];
      const isNext = open && !done && !nextMarked; if (isNext) nextMarked = true;
      const thumbId = (lesson.cards.find(c => c.img) || {}).img;
      const badge = done ? (done.perfect ? "🏆" : "✅") : open ? "▶️" : "🔒";
      const row = h(`<button class="lesson-row ${open ? "" : "locked"} ${isNext ? "next" : ""}">
        ${thumbId ? `<img class="thumb" src="${imgSrc(thumbId)}" alt="" loading="lazy">` : `<div class="thumb"></div>`}
        <div class="meta"><div class="name">${lesson.checkpoint ? "🏁 " : `${i + 1}. `}${esc(L(lesson.title))}</div>
        <div class="idea">${esc(L(lesson.idea))}</div></div><div class="badge">${badge}</div></button>`);
      row.onclick = () => open ? startSession(lesson) : toast(t().locked);
      home.appendChild(row);
    });
    home.appendChild(h(`<div class="footer-note">${esc(t().footer)}</div>`));
    const me = tg && tg.initDataUnsafe && tg.initDataUnsafe.user;
    home.appendChild(h(`<div class="footer-note" style="opacity:.5">Telegram id: ${esc(me ? me.id : "—")}</div>`));
    app.appendChild(home);
  }
  function renderGlossary() {
    app.innerHTML = "";
    const back = () => { if (tg) tg.BackButton.offClick(back); renderHome(); };
    if (tg) { tg.BackButton.show(); tg.BackButton.onClick(back); }
    const page = h(`<div class="home"><div class="lesson-top" style="padding:0 0 8px"><button class="close" aria-label="back">←</button>
      <div class="unit-title" style="margin:0">📖 ${esc(t().glossary)}</div></div><div class="unit-sub">${esc(t().glossarySub)}</div></div>`);
    page.querySelector(".close").onclick = back;
    const coll = new Intl.Collator(state.lang);
    glossary.terms.slice().sort((a, b) => coll.compare(L(a.term), L(b.term))).forEach(g => {
      page.appendChild(h(`<div class="gloss"><b>${esc(L(g.term))}</b><p>${esc(L(g.def))}</p></div>`));
    });
    app.appendChild(page);
    window.scrollTo(0, 0);
  }
  function toast(msg) { if (tg && tg.showAlert) { try { tg.showAlert(msg); return; } catch (e) {} } console.log(msg); }

  // ---------- session ----------
  let S = null; // current session

  function startSession(lesson) {
    let items;
    if (lesson) {
      items = lesson.cards.map((c, i) => ({ key: `${lesson.id}:${i}`, card: c, review: false }));
      const intro = (lesson.intro || []).map((c, i) => ({ key: `${lesson.id}:intro${i}`, card: c, review: false, intro: true, n: i + 1, of: lesson.intro.length }));
      if (!lesson.checkpoint && course.lessons.indexOf(lesson) > 0) {
        const own = new Set(items.map(x => x.key));
        const rev = dueReviews().filter(k => !own.has(k)).slice(0, MAX_REVIEW_IN_LESSON)
          .map(k => ({ key: k, card: cardByKey(k), review: true }));
        items.splice(1, 0, ...rev);
      }
      items = intro.concat(items);
    } else {
      items = dueReviews().slice(0, MAX_REVIEW_SESSION).map(k => ({ key: k, card: cardByKey(k), review: true }));
    }
    S = { lesson, items, i: 0, mistakes: 0, scored: 0, right: 0, retry: [] };
    if (tg) { tg.BackButton.show(); tg.BackButton.onClick(quitSession); }
    renderCard();
  }
  function quitSession() {
    const leave = () => { if (tg) tg.BackButton.offClick(quitSession); S = null; renderHome(); };
    if (tg && tg.showConfirm && tg.isVersionAtLeast && tg.isVersionAtLeast("6.2")) tg.showConfirm(t().quit, ok => ok && leave());
    else if (window.confirm(t().quit)) leave();
  }

  function renderCard() {
    document.body.classList.add("in-lesson");
    const item = S.items[S.i], c = item.card;
    app.innerHTML = "";
    const wrap = h(`<div class="lesson"><div class="lesson-top"><button class="close" aria-label="close">✕</button>
      <div class="progress"><div style="width:${(S.i / S.items.length) * 100}%"></div></div></div></div>`);
    wrap.querySelector(".close").onclick = quitSession;
    const card = h(`<div class="card"></div>`);
    const bottom = h(`<div class="bottom"><div class="fb hidden"><div class="fb-title"></div><div class="fb-text"></div></div><button class="main-btn"></button></div>`);
    const btn = bottom.querySelector(".main-btn");
    wrap.appendChild(card); wrap.appendChild(bottom); app.appendChild(wrap);
    window.scrollTo(0, 0);

    const tag = item.intro ? `${t().intro} · ${item.n}/${item.of}` : item.review ? t().reviewTag : S.lesson && S.lesson.checkpoint ? t().checkpoint
      : c.type === "story" ? t().story : c.unseen ? t().unseen : c.type === "order" ? t().order : c.crop ? t().lookCloser : "";
    if (tag) card.appendChild(h(`<div class="tag">${esc(tag)}</div>`));

    if (c.type === "intro") {
      card.appendChild(h(`<div class="intro-emoji">${esc(c.emoji || "🎨")}</div>`));
      card.appendChild(h(`<h2 class="intro-title">${esc(L(c.title))}</h2>`));
      if (c.img) card.appendChild(picture(c.img, null, true));
      card.appendChild(h(`<p class="story-text">${rich(L(c.text))}</p>`));
      if (item.n === 1 && S.lesson && S.lesson.id === course.lessons[0].id) card.appendChild(h(`<div class="hint">💡 ${esc(t().tapWords)}</div>`));
      if (S.lesson && state.done[S.lesson.id]) {
        const sk = h(`<button class="skip">${esc(t().skip)}</button>`);
        sk.onclick = () => { while (S.i < S.items.length - 1 && S.items[S.i].intro) S.i++; renderCard(); };
        card.appendChild(sk);
      }
      btn.textContent = t().cont;
      btn.onclick = next;
      return;
    }

    if (c.type === "story") {
      card.appendChild(picture(c.img, null, true));
      card.appendChild(h(`<p class="story-text">${rich(L(c.text))}</p>`));
      btn.textContent = t().cont;
      btn.onclick = next;
      return;
    }

    card.appendChild(h(`<p class="q">${rich(L(c.q))}</p>`));
    let check; // returns true/false
    let reveal; // marks correct/wrong in UI
    let correctText = "";

    if (c.type === "mcq" || c.type === "multi") {
      if (c.img) card.appendChild(picture(c.img, c.crop, !c.unseen && !c.crop));
      if (c.imgs) { const pair = h(`<div class="pair stack"></div>`); c.imgs.forEach(id => pair.appendChild(picture(id, null, true))); card.appendChild(pair); }
      const multi = c.type === "multi";
      const need = multi ? c.answers.length : 1;
      if (multi) card.appendChild(h(`<div class="hint">${esc(t().pickTwo(need))}</div>`));
      const order = c.noShuffle ? c.options.map((_, i) => i) : shuffle(c.options.map((_, i) => i));
      const opts = h(`<div class="options"></div>`);
      const sel = new Set();
      const buttons = order.map(oi => {
        const b = h(`<button class="opt">${esc(L(c.options[oi]))}</button>`);
        b.onclick = () => {
          if (S.answered) return;
          if (multi) { sel.has(oi) ? sel.delete(oi) : sel.size < need && sel.add(oi); }
          else { sel.clear(); sel.add(oi); }
          buttons.forEach((bb, k) => bb.classList.toggle("sel", sel.has(order[k])));
          btn.disabled = sel.size !== need;
        };
        opts.appendChild(b); return b;
      });
      card.appendChild(opts);
      const rightSet = new Set(multi ? c.answers : [c.answer]);
      correctText = [...rightSet].map(i => L(c.options[i])).join(" + ");
      check = () => sel.size === rightSet.size && [...sel].every(x => rightSet.has(x));
      reveal = () => buttons.forEach((b, k) => {
        const oi = order[k];
        b.classList.remove("sel");
        if (rightSet.has(oi)) b.classList.add("good"); else if (sel.has(oi)) b.classList.add("bad");
      });
      if (c.unseen) { const cap = h(`<div class="caption hidden">${esc(caption(c.img))}</div>`); card.appendChild(cap); cap.style.marginTop = "12px"; reveal = wrapReveal(reveal, () => cap.classList.remove("hidden")); }
    } else if (c.type === "pick" || c.type === "order") {
      const isOrder = c.type === "order";
      const shown = shuffle(c.imgs);
      if (isOrder) card.appendChild(h(`<div class="hint">${esc(t().tapOrder)}</div>`));
      const grid = h(`<div class="grid-pick n${shown.length}"></div>`);
      let picked = [];
      const tiles = shown.map(id => {
        const letter = "ABCD"[shown.indexOf(id)];
        const b = h(`<div class="pick" role="button" tabindex="0"><img src="${imgSrc(id)}" alt="" draggable="false"><span class="letter">${letter}</span><span class="num hidden"></span><button class="pick-zoom" aria-label="zoom">⤢</button><span class="lbl hidden">${esc(caption(id))}</span></div>`);
        b.querySelector(".pick-zoom").onclick = e => { e.stopPropagation(); viewerId = id; openViewer(id, S.answered); };
        b.onclick = () => {
          if (S.answered) return;
          if (isOrder) { picked.includes(id) ? (picked = picked.filter(x => x !== id)) : picked.push(id); }
          else picked = [id];
          tiles.forEach((tb, k) => {
            const pos = picked.indexOf(shown[k]);
            tb.classList.toggle("sel", pos >= 0);
            const num = tb.querySelector(".num");
            num.classList.toggle("hidden", !isOrder || pos < 0); num.textContent = pos + 1;
          });
          btn.disabled = picked.length !== (isOrder ? shown.length : 1);
        };
        grid.appendChild(b); return b;
      });
      card.appendChild(grid);
      const correctOrder = isOrder ? c.imgs.slice().sort((a, b) => paintings[a].year - paintings[b].year) : [c.imgs[c.answer]];
      correctText = isOrder ? correctOrder.map(id => `${L(paintings[id].artist)} ${paintings[id].year}`).join(" → ") : caption(correctOrder[0]);
      check = () => picked.length === correctOrder.length && picked.every((id, k) => id === correctOrder[k]);
      reveal = () => tiles.forEach((tb, k) => {
        const id = shown[k];
        tb.classList.remove("sel");
        tb.querySelector(".lbl").classList.remove("hidden");
        if (isOrder) { const pos = correctOrder.indexOf(id); const num = tb.querySelector(".num"); num.classList.remove("hidden"); num.textContent = pos + 1; tb.classList.add(picked[pos] === id ? "good" : "bad"); }
        else if (id === correctOrder[0]) tb.classList.add("good"); else if (picked.includes(id)) tb.classList.add("bad");
      });
    }

    S.answered = false;
    btn.textContent = t().check; btn.disabled = true;
    btn.onclick = () => {
      if (S.answered) return next();
      S.answered = true;
      const right = check();
      reveal();
      const fb = bottom.querySelector(".fb");
      fb.classList.remove("hidden");
      bottom.classList.add(right ? "good" : "bad");
      fb.querySelector(".fb-title").textContent = right ? t().correct : t().wrong;
      const ids = c.img ? [c.img] : (c.imgs || []);
      const facts = ids.filter(id => paintings[id]).map(id => `<div class="fact">🖼 <b>${esc(L(paintings[id].artist))}</b>, ${esc(L(paintings[id].title))}, ${paintings[id].year}${movementOf(id) ? ` · <i>${rich(movementOf(id))}</i>` : ""}</div>`).join("");
      fb.querySelector(".fb-text").innerHTML = (right ? "" : `<b>${esc(t().answerWas)}</b> ${esc(correctText)}<br>`) + rich(L(c.explain)) + (facts ? `<div class="facts">${facts}</div>` : "");
      haptic(right ? "success" : "error");
      if (!item.retried) { S.scored++; if (right) S.right++; else S.mistakes++; recordAnswer(item.key, right, item.review); }
      if (!right && !item.retried && !(S.lesson && S.lesson.checkpoint)) S.items.push(Object.assign({}, item, { retried: true })); // try again at the end, Duolingo-style
      btn.disabled = false; btn.textContent = t().cont;
      bottom.scrollIntoView({ block: "end" });
    };
  }
  function wrapReveal(a, b) { return () => { a(); b(); }; }

  function picture(id, crop, showCaption) {
    const box = h(`<div class="pic ${crop ? "crop" : ""}"><img src="${imgSrc(id)}" alt="${esc(caption(id))}"></div>`);
    const img = box.querySelector("img");
    if (crop) {
      img.style.transformOrigin = `${crop.x}% ${crop.y}%`;
      img.style.transform = `scale(${crop.z})`;
      box.appendChild(h(`<span class="zoom">🔍 ${esc(t().zoom)}</span>`));
    }
    if (!crop) box.appendChild(h(`<span class="zoom">⤢ ${esc(t().tapZoom)}</span>`));
    img.onclick = () => { viewerId = id; openViewer(id, crop ? false : showCaption); };
    const frag = document.createDocumentFragment();
    frag.appendChild(box);
    if (showCaption) frag.appendChild(h(`<div class="caption">${esc(caption(id))}</div>`));
    const holder = document.createElement("div"); holder.appendChild(frag);
    return holder;
  }
  // Full-screen viewer: pinch or double-tap to zoom, drag to move, tap ✕ (or tap outside when not zoomed) to close.
  const Z = { s: 1, x: 0, y: 0, pts: new Map(), start: null, lastTap: 0, moved: false };
  function zApply(anim) {
    const img = document.querySelector("#viewer .viewer-img");
    img.style.transition = anim ? "transform .2s" : "none";
    img.style.transform = `translate(${Z.x}px, ${Z.y}px) scale(${Z.s})`;
  }
  function zClamp() {
    const img = document.querySelector("#viewer .viewer-img"), stage = img.parentNode;
    Z.s = Math.min(8, Math.max(1, Z.s));
    const mx = Math.max(0, (img.offsetWidth * Z.s - stage.clientWidth) / 2), my = Math.max(0, (img.offsetHeight * Z.s - stage.clientHeight) / 2);
    Z.x = Math.min(mx, Math.max(-mx, Z.x)); Z.y = Math.min(my, Math.max(-my, Z.y));
  }
  function zZoomAt(cx, cy, ns) {
    const stage = document.querySelector("#viewer .viewer-stage").getBoundingClientRect();
    const px = cx - stage.left - stage.width / 2, py = cy - stage.top - stage.height / 2;
    Z.x = px - (px - Z.x) * ns / Z.s; Z.y = py - (py - Z.y) * ns / Z.s; Z.s = ns;
  }
  function setupViewer() {
    const v = document.getElementById("viewer"), stage = v.querySelector(".viewer-stage");
    const close = () => { v.classList.add("hidden"); document.body.classList.remove("viewing"); };
    v.querySelector(".viewer-close").onclick = close;
    stage.addEventListener("pointerdown", e => {
      stage.setPointerCapture(e.pointerId);
      Z.pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); Z.moved = false;
      const p = [...Z.pts.values()];
      Z.start = p.length === 2
        ? { d: Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y), s: Z.s, x: Z.x, y: Z.y, cx: (p[0].x + p[1].x) / 2, cy: (p[0].y + p[1].y) / 2 }
        : { px: e.clientX, py: e.clientY, x: Z.x, y: Z.y };
    });
    stage.addEventListener("pointermove", e => {
      if (!Z.pts.has(e.pointerId)) return;
      Z.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const p = [...Z.pts.values()], st = Z.start;
      if (p.length === 2 && st.d) {
        const d = Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y);
        Z.s = st.s; Z.x = st.x; Z.y = st.y;
        zZoomAt(st.cx, st.cy, Math.min(8, Math.max(1, st.s * d / st.d)));
        Z.x += (p[0].x + p[1].x) / 2 - st.cx; Z.y += (p[0].y + p[1].y) / 2 - st.cy;
        Z.moved = true;
      } else if (p.length === 1 && st.px !== undefined) {
        const dx = e.clientX - st.px, dy = e.clientY - st.py;
        if (Math.abs(dx) + Math.abs(dy) > 6) Z.moved = true;
        if (Z.s > 1) { Z.x = st.x + dx; Z.y = st.y + dy; }
      }
      zClamp(); zApply(false);
    });
    const end = e => {
      if (!Z.pts.has(e.pointerId)) return;
      Z.pts.delete(e.pointerId);
      const p = [...Z.pts.values()];
      if (p.length === 1) Z.start = { px: p[0].x, py: p[0].y, x: Z.x, y: Z.y }; // keep panning with the finger left
      if (p.length || Z.moved || e.type === "pointercancel") return;
      const now = Date.now();
      if (now - Z.lastTap < 300) { // double tap: zoom in to 2.5x there, or back out
        Z.lastTap = 0;
        if (Z.s > 1.05) { Z.s = 1; Z.x = 0; Z.y = 0; } else zZoomAt(e.clientX, e.clientY, 2.5);
        zClamp(); zApply(true);
      } else {
        Z.lastTap = now;
        const onImg = e.target.classList.contains("viewer-img");
        if (!onImg && Z.s <= 1.05) setTimeout(() => { if (Z.lastTap === now) close(); }, 300);
      }
    };
    stage.addEventListener("pointerup", end);
    stage.addEventListener("pointercancel", end);
    stage.addEventListener("wheel", e => { e.preventDefault(); zZoomAt(e.clientX, e.clientY, Math.min(8, Math.max(1, Z.s * (e.deltaY < 0 ? 1.2 : 1 / 1.2)))); zClamp(); zApply(false); }, { passive: false });
  }
  function openViewer(id, withCap) {
    const v = document.getElementById("viewer");
    Z.s = 1; Z.x = 0; Z.y = 0; Z.pts.clear();
    v.querySelector(".viewer-img").src = imgSrc(id);
    zApply(false);
    v.querySelector(".viewer-cap").textContent = withCap ? caption(id) : "";
    v.querySelector(".viewer-hint").textContent = t().zoomHint;
    v.classList.remove("hidden");
    document.body.classList.add("viewing");
  }

  function next() {
    S.i++;
    if (S.i < S.items.length) return renderCard();
    finish();
  }

  function finish() {
    document.body.classList.remove("in-lesson");
    if (tg) tg.BackButton.offClick(quitSession);
    const lesson = S.lesson, cp = lesson && lesson.checkpoint;
    const perfect = S.mistakes === 0;
    let gained = 0, passed = true;
    if (lesson) {
      passed = !cp || S.right >= Math.ceil(S.scored * 0.8);
      gained = passed ? XP_LESSON + (perfect ? XP_PERFECT : 0) : 0;
      if (passed) {
        const prev = state.done[lesson.id];
        state.done[lesson.id] = { perfect: perfect || !!(prev && prev.perfect), at: today() };
      }
    } else gained = S.right * XP_REVIEW;
    state.xp += gained;
    if (passed) markActiveToday();
    saveState();
    haptic(passed ? "success" : "warning");
    const title = !lesson ? t().reviewDone : cp ? (passed ? t().cpPass : t().cpFail) : perfect ? t().perfect : t().done;
    app.innerHTML = "";
    const r = h(`<div class="result"><div class="big">${passed ? (perfect ? "🏆" : "🎨") : "🔁"}</div><h2>${esc(title)}</h2>
      <div class="boxes"><div class="box"><b>+${gained}</b><span>${esc(t().xp)}</span></div>
      <div class="box"><b>${S.mistakes}</b><span>${esc(t().mistakes)}</span></div>
      <div class="box"><b>🔥 ${currentStreak()}</b><span>${esc(t().streak)}</span></div></div>
      <button class="main-btn">${esc(t().back)}</button></div>`);
    r.querySelector(".main-btn").onclick = () => { S = null; renderHome(); };
    app.appendChild(r);
    S = null;
  }

  // ---------- AI helper ----------
  // Runs in the browser with the owner's own key (Google Gemini free tier, or Anthropic), stored only in their Telegram
  // cloud storage and this device. No key lives in the code or on any server.
  const AI_KEY = "artolingo_ai_key", AI_MODEL = "artolingo_ai_model";
  let viewerId = null, aiKey = null, aiChat = [], aiBusy = false;
  function loadAiKey() {
    try { aiKey = localStorage.getItem(AI_KEY); } catch (e) {}
    if (aiKey || !cloudOK()) return;
    try { tg.CloudStorage.getItem(AI_KEY, (err, v) => { if (v) { aiKey = v; try { localStorage.setItem(AI_KEY, v); } catch (e) {} } }); } catch (e) {}
  }
  function saveAiKey(k) {
    aiKey = k || null;
    try { k ? localStorage.setItem(AI_KEY, k) : localStorage.removeItem(AI_KEY); localStorage.removeItem(AI_MODEL); } catch (e) {}
    if (cloudOK()) { try { k ? tg.CloudStorage.setItem(AI_KEY, k, () => {}) : tg.CloudStorage.removeItem(AI_KEY, () => {}); } catch (e) {} }
  }
  function aiContext() {
    const en = obj => (obj ? obj.en : ""), lines = [];
    const art = id => paintings[id] ? `${en(paintings[id].artist)}, "${en(paintings[id].title)}" (${paintings[id].year}), ${movementOf(id) && en(glossary.movements[paintings[id].movement])}` : id;
    const viewerOpen = !document.getElementById("viewer").classList.contains("hidden");
    if (viewerOpen && viewerId) lines.push(`The user is looking at this painting full screen: ${art(viewerId)}.`);
    if (S && S.items[S.i]) {
      const c = S.items[S.i].card;
      if (S.lesson) lines.push(`Current lesson: "${en(S.lesson.title)}" (${en(S.lesson.idea)}), part of the unit "${en(course.unit.title)}".`);
      if (c.type === "intro") lines.push(`On screen: a background story card titled "${en(c.title)}": ${en(c.text)}`);
      else if (c.type === "story") lines.push(`On screen: a story card: ${en(c.text)}`);
      else {
        lines.push(`On screen: a quiz question: "${en(c.q)}"` + (c.options ? ` Options: ${c.options.map(o => `"${en(o)}"`).join(", ")}.` : ""));
        lines.push(S.answered ? `The user has already answered. Explanation shown: ${en(c.explain)}`
          : "The user has NOT answered yet: give hints and background, but do not reveal which option is correct unless they insist.");
      }
      const ids = c.img ? [c.img] : (c.imgs || []);
      if (ids.length && !(c.unseen && !S.answered)) lines.push(`Paintings on screen: ${ids.map(art).join("; ")}.`);
      else if (ids.length) lines.push("A painting is shown but its title is hidden until the user answers (it is a test): do not name it.");
    } else lines.push(`The user is on the home screen of the course "${en(course.unit.title)}".`);
    return lines.join("\n");
  }
  function aiSystem() {
    return `You are the friendly art helper inside Artolingo, a Duolingo-style app that teaches art literacy, currently paintings (Impressionism and Post-Impressionism).
The user is a complete beginner. Answer in ${state.lang === "ru" ? "Russian" : "English"} (switch only if they write in another language).
Be plain, warm and short: usually 2 to 5 sentences, no jargon (if you use an art term, explain it in a few words). Name artists, titles and years when relevant. Use concrete things to look at in the painting. If you are not sure of a fact, say so.
Plain text only, no markdown headings or tables.

What the user sees right now:
${aiContext()}`;
  }
  async function aiPickGemini() {
    try { const m = localStorage.getItem(AI_MODEL); if (m) return m; } catch (e) {}
    let pick = "gemini-2.5-flash";
    try {
      const r = await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=200", { headers: { "x-goog-api-key": aiKey } });
      const j = await r.json();
      const ok = (j.models || []).map(m => m.name.replace("models/", ""))
        .filter((n, i) => /^gemini-\d/.test(n) && /flash/.test(n) && !/lite|image|tts|live|audio|exp|embed|thinking|8b/.test(n) && (j.models[i].supportedGenerationMethods || []).includes("generateContent"));
      const ver = n => parseFloat((n.match(/gemini-(\d+(?:\.\d+)?)/) || [0, 0])[1]);
      ok.sort((a, b) => (ver(b) - ver(a)) || (/preview/.test(a) - /preview/.test(b)) || (a.length - b.length));
      if (ok.length) pick = ok[0];
    } catch (e) {}
    try { localStorage.setItem(AI_MODEL, pick); } catch (e) {}
    return pick;
  }
  async function aiAsk() {
    if (aiKey.startsWith("sk-ant")) {
      for (const model of ["claude-haiku-5-5", "claude-haiku-4-5"]) {
        const r = await fetch("https://api.anthropic.com/v1/messages", { method: "POST", headers: {
          "content-type": "application/json", "x-api-key": aiKey, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" },
          body: JSON.stringify({ model, max_tokens: 800, system: aiSystem(), messages: aiChat.map(m => ({ role: m.role, content: m.text })) }) });
        const j = await r.json();
        if (r.status === 404) continue;
        if (!r.ok) throw new Error((j.error && j.error.message) || r.status);
        return j.content.filter(b => b.type === "text").map(b => b.text).join("\n");
      }
      throw new Error("model not found");
    }
    const model = await aiPickGemini();
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, { method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": aiKey },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: aiSystem() }] },
        contents: aiChat.map(m => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.text }] })),
        generationConfig: { maxOutputTokens: 2048, temperature: 0.6 } }) });
    const j = await r.json();
    if (!r.ok) { if (r.status === 404) { try { localStorage.removeItem(AI_MODEL); } catch (e) {} } throw new Error((j.error && j.error.message) || r.status); }
    const parts = (((j.candidates || [])[0] || {}).content || {}).parts || [];
    const text = parts.filter(p => p.text && !p.thought).map(p => p.text).join("").trim();
    if (!text) throw new Error("empty answer");
    return text;
  }
  function openHelper() {
    const box = document.getElementById("ai");
    box.classList.remove("hidden");
    renderHelper();
  }
  function renderHelper() {
    const box = document.getElementById("ai");
    box.innerHTML = "";
    const panel = h(`<div class="ai-panel"><div class="ai-head"><b>✨ ${esc(t().ai)}</b><span class="spacer"></span>
      ${aiKey ? `<button class="ai-link ai-new">${esc(t().aiNew)}</button><button class="ai-link ai-keybtn">🔑</button>` : ""}
      <button class="ai-x" aria-label="close">✕</button></div><div class="ai-body"></div></div>`);
    box.appendChild(panel);
    panel.querySelector(".ai-x").onclick = () => box.classList.add("hidden");
    const body = panel.querySelector(".ai-body");
    if (!aiKey) {
      body.appendChild(h(`<div class="ai-setup"><h3>${esc(t().aiSetupTitle)}</h3><p>${esc(t().aiSetupText)}</p>
        <button class="main-btn ai-get">🔑 ${esc(t().aiGetKey)}</button>
        <input class="ai-keyin" placeholder="${esc(t().aiPaste)}" autocomplete="off" autocapitalize="off" spellcheck="false">
        <button class="main-btn ai-save" disabled>${esc(t().aiSave)}</button><div class="ai-err hidden"></div></div>`));
      const inp = body.querySelector(".ai-keyin"), save = body.querySelector(".ai-save"), err = body.querySelector(".ai-err");
      body.querySelector(".ai-get").onclick = () => { const u = "https://aistudio.google.com/apikey"; if (tg && tg.openLink) tg.openLink(u); else window.open(u, "_blank"); };
      inp.oninput = () => { save.disabled = inp.value.trim().length < 20; };
      save.onclick = () => {
        const k = inp.value.trim().replace(/\s/g, "");
        if (!/^(AIza|AQ\.|sk-ant)/.test(k)) { err.textContent = t().aiBadKey; err.classList.remove("hidden"); return; }
        saveAiKey(k); renderHelper();
      };
      return;
    }
    panel.querySelector(".ai-new").onclick = () => { aiChat = []; renderHelper(); };
    panel.querySelector(".ai-keybtn").onclick = () => { const go = ok => { if (ok) { saveAiKey(null); aiChat = []; renderHelper(); } };
      if (tg && tg.showConfirm && tg.isVersionAtLeast && tg.isVersionAtLeast("6.2")) tg.showConfirm(t().aiRemove + "?", go); else go(window.confirm(t().aiRemove + "?")); };
    const log = h(`<div class="ai-log"></div>`);
    log.appendChild(h(`<div class="ai-msg bot">${esc(t().aiHello)}</div>`));
    aiChat.forEach(m => log.appendChild(h(`<div class="ai-msg ${m.role === "user" ? "me" : "bot"}">${esc(m.text)}</div>`)));
    if (aiBusy) log.appendChild(h(`<div class="ai-msg bot muted">${esc(t().aiThinking)}</div>`));
    body.appendChild(log);
    if (!aiChat.length) {
      const sug = h(`<div class="ai-sug"></div>`);
      t().aiSuggest.forEach(q => { const b = h(`<button>${esc(q)}</button>`); b.onclick = () => send(q); sug.appendChild(b); });
      body.appendChild(sug);
    }
    const form = h(`<form class="ai-form"><input class="ai-in" placeholder="${esc(t().aiPlaceholder)}" enterkeyhint="send"><button class="ai-send" aria-label="${esc(t().aiSend)}">➤</button></form>`);
    body.appendChild(form);
    const inp = form.querySelector(".ai-in");
    form.onsubmit = e => { e.preventDefault(); send(inp.value); };
    log.scrollTop = log.scrollHeight;
    async function send(q) {
      q = String(q || "").trim(); if (!q || aiBusy) return;
      aiChat.push({ role: "user", text: q }); aiBusy = true; renderHelper();
      try { aiChat.push({ role: "assistant", text: await aiAsk() }); }
      catch (e) { aiChat.pop(); aiChat.push({ role: "user", text: q }); aiChat.push({ role: "assistant", text: `${t().aiError} ${e.message}` }); }
      aiBusy = false;
      if (!document.getElementById("ai").classList.contains("hidden")) renderHelper();
    }
  }
  function setupHelper() {
    loadAiKey();
    const fab = document.getElementById("ai-fab");
    fab.onclick = openHelper;
    fab.classList.remove("hidden");
  }

  // ---------- boot ----------
  async function boot() {
    if (ALLOWED_USERS.length) {
      const uid = tg && tg.initDataUnsafe && tg.initDataUnsafe.user && tg.initDataUnsafe.user.id;
      if (!ALLOWED_USERS.includes(uid)) { app.innerHTML = `<div class="loading">🔒 Artolingo is private.<br><small>id: ${esc(uid || "none")}</small></div>`; return; }
    }
    if (tg) { try { tg.ready(); tg.expand(); tg.setHeaderColor && tg.setHeaderColor("secondary_bg_color"); } catch (e) {} }
    const v = "?v=8";
    const [p, c, s, g] = await Promise.all([
      fetch("content/paintings.json" + v).then(r => r.json()),
      fetch("content/lessons.json" + v).then(r => r.json()),
      loadState(),
      fetch("content/glossary.json" + v).then(r => r.json()).catch(() => null)
    ]);
    paintings = p; course = c; state = s; if (g) glossary = g;
    setupViewer();
    setupHelper();
    buildTermRe();
    if (tg && tg.colorScheme === "dark") document.documentElement.style.colorScheme = "dark";
    renderHome();
  }
  boot().catch(e => { app.innerHTML = `<div class="loading">Error: ${esc(e.message)}</div>`; });

  window.__artolingo = { get state() { return state; }, today }; // for debugging/tests
})();
