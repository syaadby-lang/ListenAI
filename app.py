from dotenv import load_dotenv
load_dotenv()

from flask import Flask, render_template, request, jsonify, session, send_from_directory
from content import LESSONS
from adaptive import next_level
from feedback import make_feedback
import os, secrets

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY", secrets.token_hex(24))


@app.get("/static/audio/<path:name>")
def audio_file(name):
    return send_from_directory(
        os.path.join(app.root_path, "static", "audio"),
        name,
        mimetype="audio/mpeg",
        conditional=True,
    )


def find_lesson(level, lesson_id):
    for item in LESSONS.get(level, []):
        if item["id"] == lesson_id:
            return item
    return None


@app.get("/")
def index():
    return render_template("index.html", levels=list(LESSONS.keys()))


@app.get("/api/lessons")
def lessons():
    cards = []
    for level, items in LESSONS.items():
        for item in items:
            cards.append({
                "level": level,
                "id": item["id"],
                "icon": item.get("icon", "🎧"),
                "title": item["title"],
                "description": item.get("description", ""),
                "total": len(item["questions"]),
            })
    return jsonify(cards)


@app.get("/api/lesson/<level>/<lesson_id>")
def lesson(level, lesson_id):
    item = find_lesson(level.upper(), lesson_id)
    if not item:
        return jsonify({"error": "Lesson not found"}), 404
    return jsonify(item)


@app.post("/api/submit")
def submit():
    data = request.get_json(force=True)
    level = str(data.get("level", "B1")).upper()
    lesson_id = str(data.get("lesson_id", ""))
    answers = data.get("answers", [])
    item = find_lesson(level, lesson_id)
    if not item:
        return jsonify({"error": "Unknown lesson"}), 400
    questions = item["questions"]
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