let currentLevel = "A1", currentLesson = null;
const $ = id => document.getElementById(id);
document.querySelectorAll(".level").forEach(btn => btn.addEventListener("click", () => loadLesson(btn.dataset.level)));
$("change-level").addEventListener("click", () => {$("lesson").classList.add("hidden"); window.scrollTo({top:0,behavior:"smooth"});});
async function loadLesson(level){
  const res = await fetch(`/api/lesson/${level}`); currentLesson = await res.json(); currentLevel = level;
  document.querySelectorAll(".level").forEach(b=>b.classList.toggle("active",b.dataset.level===level));
  $("lesson-level").textContent=`CEFR LEVEL ${level}`;$("lesson-title").textContent=currentLesson.title;$("lesson-topic").textContent=currentLesson.topic;
  $("script").textContent=currentLesson.script;$("speed").value=currentLesson.speed;
  $("quiz").innerHTML=currentLesson.questions.map((q,i)=>{
    const input = q.type==="short"
      ? `<input class="answer-input" name="q${i}" autocomplete="off" placeholder="Type your answer..." required>`
      : `<div class="options">${q.options.map(o=>`<label class="option"><input type="radio" name="q${i}" value="${escapeHtml(o)}" required>${escapeHtml(o)}</label>`).join("")}</div>`;
    return `<div class="question"><h3>${i+1}. ${escapeHtml(q.prompt)}</h3>${input}</div>`;
  }).join("");
  $("result").classList.add("hidden");$("lesson").classList.remove("hidden");$("lesson").scrollIntoView({behavior:"smooth"});
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}

function formatFeedback(s){
  return escapeHtml(s)
    .replace(/\*\*(.+?)\*\*/g,"<strong>$1</strong>")
    .replace(/\n/g,"<br>");
}

$("play").addEventListener("click",()=>{
  if(!("speechSynthesis" in window)){alert("Browser ini tidak mendukung Text-to-Speech.");return;}
  speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance(currentLesson.script);
  utterance.lang="en-US";utterance.rate=Number($("speed").value);speechSynthesis.speak(utterance);
});
$("stop").addEventListener("click",()=>speechSynthesis.cancel());
$("submit").addEventListener("click",async()=>{
  if(!$("quiz").reportValidity())return;
  const answers=currentLesson.questions.map((q,i)=>q.type==="short"?$("quiz").elements[`q${i}`].value:$("quiz").querySelector(`input[name="q${i}"]:checked`).value);
  $("submit").disabled=true;$("submit").textContent="Evaluating...";
  try{
    const res=await fetch("/api/submit",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({level:currentLevel,answers})});
    const data=await res.json();if(!res.ok)throw new Error(data.error||"Could not submit");
    $("result").innerHTML=`<div class="eyebrow">YOUR RESULT · ${escapeHtml(data.feedback.mode)}</div><div class="score">${data.score}%</div><h3>${data.correct} of ${data.total} correct</h3><p>${formatFeedback(data.feedback.text)}</p><p><b>Recommended next level: ${data.recommended_level}</b></p><div class="muted">${currentLesson.questions.map((q,i)=>`${i+1}. ${escapeHtml(q.explanation)}`).join("<br>")}</div>`;
    $("result").classList.remove("hidden");$("result").scrollIntoView({behavior:"smooth",block:"nearest"});
  }catch(e){alert(e.message);}finally{$("submit").disabled=false;$("submit").textContent="Submit answers";}
});
