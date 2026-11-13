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
  const ALLOWED_USERS = [];

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
      quit: "Quit this lesson? Progress in it will be lost."
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
      quit: "Выйти из урока? Прогресс в нём не сохранится."
    }
  };

  let paintings = {}, course = null, state = null;
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
    if (tg) { tg.BackButton.hide(); }
    document.documentElement.lang = state.lang;
    app.innerHTML = "";
    app.appendChild(topBar());
    const home = h(`<div class="home">
      <div class="unit-title">${esc(L(course.unit.title))}</div>
      <div class="unit-sub">${course.lessons.length - 1} × 9 + ${esc(L(course.lessons[course.lessons.length - 1].title)).toLowerCase()}</div></div>`);
    const doneToday = state.lastDay === today();
    home.appendChild(h(`<div class="goal">${doneToday ? "✅" : "🎯"} <span>${esc(doneToday ? t().goalDone : t().goalTodo)}</span></div>`));
    const due = dueReviews();
    const rb = h(`<button class="review-btn ${due.length ? "" : "empty"}">🔁 <span><b>${esc(t().review)}</b><br>${esc(due.length ? t().reviewDue(due.length) : t().reviewNone)}</span></button>`);
    if (due.length) rb.onclick = () => startSession(null);
    home.appendChild(rb);
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
    app.appendChild(home);
  }
  function toast(msg) { if (tg && tg.showAlert) { try { tg.showAlert(msg); return; } catch (e) {} } console.log(msg); }

  // ---------- session ----------
  let S = null; // current session

  function startSession(lesson) {
    let items;
    if (lesson) {
      items = lesson.cards.map((c, i) => ({ key: `${lesson.id}:${i}`, card: c, review: false }));
      if (!lesson.checkpoint && course.lessons.indexOf(lesson) > 0) {
        const own = new Set(items.map(x => x.key));
        const rev = dueReviews().filter(k => !own.has(k)).slice(0, MAX_REVIEW_IN_LESSON)
          .map(k => ({ key: k, card: cardByKey(k), review: true }));
        items.splice(1, 0, ...rev);
      }
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

    const tag = item.review ? t().reviewTag : S.lesson && S.lesson.checkpoint ? t().checkpoint
      : c.type === "story" ? t().story : c.unseen ? t().unseen : c.type === "order" ? t().order : c.crop ? t().lookCloser : "";
    if (tag) card.appendChild(h(`<div class="tag">${esc(tag)}</div>`));

    if (c.type === "story") {
      card.appendChild(picture(c.img, null, true));
      card.appendChild(h(`<p class="story-text">${esc(L(c.text))}</p>`));
      btn.textContent = t().cont;
      btn.onclick = next;
      return;
    }

    card.appendChild(h(`<p class="q">${esc(L(c.q))}</p>`));
    let check; // returns true/false
    let reveal; // marks correct/wrong in UI
    let correctText = "";

    if (c.type === "mcq" || c.type === "multi") {
      if (c.img) card.appendChild(picture(c.img, c.crop, !c.unseen && !c.crop));
      if (c.imgs) { const pair = h(`<div class="pair"></div>`); c.imgs.forEach(id => pair.appendChild(picture(id, null, true))); card.appendChild(pair); }
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
        const b = h(`<button class="pick"><img src="${imgSrc(id)}" alt=""><span class="num hidden"></span><span class="lbl hidden">${esc(caption(id))}</span></button>`);
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
      fb.querySelector(".fb-text").innerHTML = (right ? "" : `<b>${esc(t().answerWas)}</b> ${esc(correctText)}<br>`) + esc(L(c.explain));
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
    img.onclick = () => openViewer(id, crop ? false : showCaption);
    const frag = document.createDocumentFragment();
    frag.appendChild(box);
    if (showCaption) frag.appendChild(h(`<div class="caption">${esc(caption(id))}</div>`));
    const holder = document.createElement("div"); holder.appendChild(frag);
    return holder;
  }
  function openViewer(id, withCap) {
    const v = document.getElementById("viewer");
    v.querySelector("img").src = imgSrc(id);
    v.querySelector(".viewer-cap").textContent = withCap ? caption(id) : "";
    v.classList.remove("hidden");
    v.onclick = () => v.classList.add("hidden");
  }

  function next() {
    S.i++;
    if (S.i < S.items.length) return renderCard();
    finish();
  }

  function finish() {
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

  // ---------- boot ----------
  async function boot() {
    if (ALLOWED_USERS.length) {
      const uid = tg && tg.initDataUnsafe && tg.initDataUnsafe.user && tg.initDataUnsafe.user.id;
      if (!ALLOWED_USERS.includes(uid)) { app.innerHTML = '<div class="loading">🔒 Artolingo is private.</div>'; return; }
    }
    if (tg) { try { tg.ready(); tg.expand(); tg.setHeaderColor && tg.setHeaderColor("secondary_bg_color"); } catch (e) {} }
    const [p, c, s] = await Promise.all([
      fetch("content/paintings.json").then(r => r.json()),
      fetch("content/lessons.json").then(r => r.json()),
      loadState()
    ]);
    paintings = p; course = c; state = s;
    if (tg && tg.colorScheme === "dark") document.documentElement.style.colorScheme = "dark";
    renderHome();
  }
  boot().catch(e => { app.innerHTML = `<div class="loading">Error: ${esc(e.message)}</div>`; });

  window.__artolingo = { get state() { return state; }, today }; // for debugging/tests
})();
