import os
import requests


def make_feedback(level, score, correct, total, use_ai=True):
    """Uses an OpenAI-compatible chat endpoint when configured; otherwise gives local feedback."""
    key = os.getenv("OPENAI_API_KEY")
    base = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
    model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

    if use_ai and key:
        prompt = (
            f"A learner completed a {level} English listening quiz and scored {score}% "
            f"({correct}/{total}). Give concise, encouraging feedback in English. "
            "Mention one strength, one practical listening strategy, and what to practise next. "
            "Do not claim to know which individual skill failed."
        )
        try:
            r = requests.post(
                f"{base}/chat/completions",
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                json={"model": model, "messages": [{"role": "user", "content": prompt}], "temperature": 0.5},
                timeout=20,
            )
            r.raise_for_status()
            return {"text": r.json()["choices"][0]["message"]["content"], "mode": "AI"}
        except Exception as e:
            print("AI feedback failed:", e)

    if score >= 80:
        msg = "Great job! Your listening comprehension was strong in this exercise. Try listening once more without reading the transcript and note down the key words."
    elif score >= 50:
        msg = "A good start. Listen to the audio again and focus on key words such as names, numbers, places, reasons, and sequence markers."
    else:
        msg = "That's okay, practice is a process. Play the audio at a slower speed, break it into short parts, and try again."
    return {"text": msg + f" Your score: {score}%.", "mode": "Local fallback"}
