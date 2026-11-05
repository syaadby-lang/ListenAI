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

loadCards();
