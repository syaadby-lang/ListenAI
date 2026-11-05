from dotenv import load_dotenv
load_dotenv()

from flask import Flask, render_template, request, jsonify, session
from content import LESSONS
from adaptive import next_level
from feedback import make_feedback
import os, secrets

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", secrets.token_hex(24))

@app.get("/")
def index():
    return render_template("index.html", levels=list(LESSONS.keys()))

@app.get("/api/lesson/<level>")
def lesson(level):
    level = level.upper()
    if level not in LESSONS:
        return jsonify({"error": "Unknown CEFR level"}), 404
    return jsonify(LESSONS[level])

@app.post("/api/submit")
def submit():
    data = request.get_json(force=True)
    level = str(data.get("level", "A1")).upper()
    answers = data.get("answers", [])
    if level not in LESSONS:
        return jsonify({"error": "Unknown level"}), 400
    questions = LESSONS[level]["questions"]
    if len(answers) != len(questions):
        return jsonify({"error": "Please answer every question."}), 400
    correct = sum(1 for i, q in enumerate(questions) if str(answers[i]).strip().lower() == str(q["answer"]).strip().lower())
    score = round(correct / len(questions) * 100)
    recommended = next_level(level, score)
    feedback = make_feedback(level, score, correct, len(questions), data.get("api_feedback", True))
    session["last_score"] = score
    return jsonify({
        "score": score, "correct": correct, "total": len(questions),
        "recommended_level": recommended, "feedback": feedback,
        "answer_key": [q["answer"] for q in questions]
    })

if __name__ == "__main__":
    app.run(debug=True)
