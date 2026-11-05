let currentLevel = "B1", currentLesson = null;
const $ = id => document.getElementById(id);
const audio = new Audio();

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"}[c]));
}

function stopAudio() {
  audio.pause();
  audio.currentTime = 0;
}

async function loadCards() {
  try {
    const res = await fetch("/api/lessons");
    const cards = await res.json();
    lessonCards = cards;
    $("cards").innerHTML = cards.map(c => `
      <button type="button" class="lesson-card" data-level="${escapeHtml(c.level)}" data-id="${escapeHtml(c.id)}">
        <span class="icon">${escapeHtml(c.icon)}</span>
        <b>${escapeHtml(c.title)}</b>
        <span class="muted">${escapeHtml(c.description)}</span>
        <small>${c.total} ${c.total === 1 ? "question" : "questions"} · ${escapeHtml(c.level)}</small>
      </button>`).join("");
    document.querySelectorAll("#cards [data-id]").forEach(btn =>
      btn.addEventListener("click", () => loadLesson(btn.dataset.level, btn.dataset.id)));
  } catch (e) {
    $("cards").textContent = "Failed to load the lesson list.";
  }
}

async function loadLesson(level, lessonId) {
  stopAudio();
  const res = await fetch(`/api/lesson/${encodeURIComponent(level)}/${encodeURIComponent(lessonId)}`);
  if (!res.ok) { alert("Lesson not found."); return; }
  currentLesson = await res.json();
  currentLevel = level;
  lessonStartedAt = Date.now();

  $("lesson-level").textContent = `LEVEL ${level}`;
  $("lesson-title").textContent = currentLesson.title;
  $("lesson-topic").textContent = currentLesson.topic || "";
  $("lesson-instruction").textContent = currentLesson.instruction || "";
  $("quiz-count").textContent = `${currentLesson.questions.length} ${currentLesson.questions.length === 1 ? "question" : "questions"}`;

  $("script").textContent = currentLesson.script || "";
  document.querySelector(".transcript").classList.toggle("hidden", !currentLesson.script);

  $("speed").value = String(currentLesson.speed || 1);

  $("quiz").innerHTML = currentLesson.questions.map((q, i) => {
    const input = q.type === "short"
      ? `<input class="answer-input" name="q${i}" autocomplete="off" placeholder="Type your answer..." required>`
      : `<div class="options">${q.options.map(o =>
          `<label class="option"><input type="radio" name="q${i}" value="${escapeHtml(o)}" required>${escapeHtml(o)}</label>`
        ).join("")}</div>`;
    return `<div class="question"><h3>${i + 1}. ${escapeHtml(q.prompt)}</h3>${input}</div>`;
  }).join("");

  $("result").classList.add("hidden");
  $("lesson").classList.remove("hidden");
  $("lesson").scrollIntoView({behavior: "smooth"});
}

$("change-level").addEventListener("click", () => {
  stopAudio();
  $("lesson").classList.add("hidden");
  window.scrollTo({top: 0, behavior: "smooth"});
});

$("play").addEventListener("click", () => {
  if (!currentLesson) return;
  audio.src = currentLesson.audio;
  audio.load();
  audio.playbackRate = Number($("speed").value);
  audio.play().catch(e => {
    console.error("Audio error:", e, audio.error, audio.src);
    alert(`Audio failed to play: ${e.name}${audio.error ? " (kode " + audio.error.code + ")" : ""}`);
  });
});

$("stop").addEventListener("click", stopAudio);
$("speed").addEventListener("change", () => { audio.playbackRate = Number($("speed").value); });

$("submit").addEventListener("click", async () => {
  if (!currentLesson || !$("quiz").reportValidity()) return;

  const answers = currentLesson.questions.map((q, i) =>
    q.type === "short"
      ? $("quiz").elements[`q${i}`].value
      : $("quiz").querySelector(`input[name="q${i}"]:checked`).value);

  $("submit").disabled = true;
  $("submit").textContent = "Evaluating...";
  try {
    const res = await fetch("/api/submit", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({level: currentLevel, lesson_id: currentLesson.id, answers})
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Could not submit");
    recordAttempt(data);

    const fb = data.feedback || {};
    const fbText = typeof fb === "string" ? fb : (fb.text || "");
    const fbMode = typeof fb === "string" ? "" : (fb.mode ? ` · ${fb.mode}` : "");

    const review = currentLesson.questions.map((q, i) => {
      const ok = String(answers[i]).trim().toLowerCase() === String(data.answer_key[i]).trim().toLowerCase();
      return `<div class="review ${ok ? "correct" : "wrong"}">
        <b>${i + 1}. ${ok ? "✓" : "✗"} ${escapeHtml(q.prompt)}</b><br>
        ${ok ? "" : `Your answer: ${escapeHtml(answers[i])}<br>`}
        Correct answer: ${escapeHtml(data.answer_key[i])}<br>
        <span class="muted">${escapeHtml(q.explanation || "")}</span>
      </div>`;
    }).join("");

    $("result").innerHTML = `
      <div class="eyebrow">YOUR RESULT${escapeHtml(fbMode)}</div>
      <div class="score">${data.score}%</div>
      <h3>${data.correct} of ${data.total} correct</h3>
      <p>${escapeHtml(fbText)}</p>
      ${review}`;
    $("result").classList.remove("hidden");
    $("result").scrollIntoView({behavior: "smooth", block: "nearest"});
  } catch (e) {
    alert(e.message);
  } finally {
    $("submit").disabled = false;
    $("submit").textContent = "Submit answers";
  }
});

// ---------- My Progress (saved in this browser) ----------
const STORE_KEY = "listenai_progress_v1";
let lessonCards = [];
let lessonStartedAt = Date.now();
let lessonWasOpen = false;

const SKILL_LABELS = {gist: "Gist", specific: "Specific Info", opinions: "Opinions", sequence: "Sequence", inference: "Inference"};
const SKILL_COLORS = {gist: "#2f9e9e", specific: "#3b82f6", opinions: "#ef6f8f", sequence: "#f4a94e", inference: "#e0b030"};

function loadProgress() {
  try {
    const p = JSON.parse(localStorage.getItem(STORE_KEY));
    return p && Array.isArray(p.attempts) ? p : {attempts: []};
  } catch (e) {
    return {attempts: []};
  }
}

function saveProgress(p) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(p)); } catch (e) {}
}

function recordAttempt(data) {
  const seconds = Math.min(Math.round((Date.now() - lessonStartedAt) / 1000), 1800);
  const p = loadProgress();
  p.attempts.push({
    id: currentLesson.id,
    title: currentLesson.title,
    score: data.score,
    correct: data.correct,
    total: data.total,
    ts: Date.now(),
    seconds
  });
  p.attempts = p.attempts.slice(-200);
  saveProgress(p);
  lessonStartedAt = Date.now();
}

function formatStudyTime(sec) {
  if (sec <= 0) return "0m";
  if (sec < 60) return "<1m";
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function timeAgo(ts) {
  const min = Math.floor((Date.now() - ts) / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function renderProgress() {
  const p = loadProgress();
  const latest = {};
  p.attempts.forEach(a => { latest[a.id] = a; });

  const total = lessonCards.length;
  const done = lessonCards.filter(c => latest[c.id]).length;
  const pct = total ? Math.round(done / total * 100) : 0;
  const sumCorrect = p.attempts.reduce((n, a) => n + a.correct, 0);
  const sumTotal = p.attempts.reduce((n, a) => n + a.total, 0);
  const acc = sumTotal ? Math.round(sumCorrect / sumTotal * 100) : 0;
  const secs = p.attempts.reduce((n, a) => n + (a.seconds || 0), 0);

  $("ring").style.setProperty("--p", pct);
  $("ring-pct").textContent = `${pct}%`;
  $("stat-units").textContent = `${done} / ${total}`;
  $("stat-correct").textContent = `${acc}%`;
  $("stat-time").textContent = formatStudyTime(secs);

  $("skills").innerHTML = lessonCards.map(c => {
    const a = latest[c.id];
    const label = SKILL_LABELS[c.id] || c.title;
    const color = SKILL_COLORS[c.id] || "#1f4f9c";
    const val = a ? a.score : 0;
    return `<div class="skill-row">
      <span class="skill-name">${escapeHtml(label)}</span>
      <div class="bar"><div class="bar-fill" style="width:${val}%;background:${color}"></div></div>
      <span class="skill-val">${a ? val + "%" : "—"}</span>
    </div>`;
  }).join("");

  const recent = p.attempts.slice(-5).reverse();
  $("recent").innerHTML = recent.length
    ? recent.map(a => `<div class="recent-item">
        <span class="check">✓</span>
        <div><b>${escapeHtml(a.title)}</b><span class="muted">Score: ${a.score}%</span></div>
        <span class="muted">${timeAgo(a.ts)}</span>
      </div>`).join("")
    : `<p class="muted">No activity yet. Finish a lesson to see it here.</p>`;
}

function showTab(name) {
  const onProgress = name === "progress";
  const wasOnProgress = !$("progress").classList.contains("hidden");
  if (onProgress) {
    lessonWasOpen = !$("lesson").classList.contains("hidden");
    stopAudio();
    renderProgress();
  } else if (!wasOnProgress) {
    return;
  }
  $("lessons").classList.toggle("hidden", onProgress);
  $("lesson").classList.toggle("hidden", onProgress || !lessonWasOpen);
  $("progress").classList.toggle("hidden", !onProgress);
  $("tab-lessons").classList.toggle("active", !onProgress);
  $("tab-progress").classList.toggle("active", onProgress);
  window.scrollTo({top: 0});
}

$("tab-lessons").addEventListener("click", () => showTab("lessons"));
$("tab-progress").addEventListener("click", () => showTab("progress"));
$("reset-progress").addEventListener("click", () => {
  if (confirm("Reset all progress saved on this device?")) {
    saveProgress({attempts: []});
    renderProgress();
  }
});

loadCards();
