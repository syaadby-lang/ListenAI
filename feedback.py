import os
import requests

def make_feedback(level, score, correct, total, use_ai=True):
    """Uses an OpenAI-compatible chat endpoint when configured; otherwise gives honest local feedback."""
    key = os.getenv("OPENAI_API_KEY")
    base = os.getenv("OPENAI_BASE_URL", "https://api.openai.com/v1").rstrip("/")
    model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")

    if use_ai and key:
        prompt = (
            f"A learner completed a {level} English listening quiz and scored {score}% "
            f"({correct}/{total}). Give concise, encouraging feedback in Indonesian. "
            "Mention one strength, one practical listening strategy, and what to practise next. "
            "Do not claim to know which individual skill failed."
        )
        try:
            r = requests.post(
                f"{base}/chat/completions",
                headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
                json={"model": model, "messages": [{"role": "user", "content": prompt}], "temperature": 0.5},
                timeout=20
            )
            r.raise_for_status()
            return {"text": r.json()["choices"][0]["message"]["content"], "mode": "AI"}
        except Exception:
            pass

    if score >= 80:
        msg = "Bagus! Pemahaman listening kamu kuat pada latihan ini. Coba dengarkan sekali lagi tanpa melihat teks, lalu catat kata kunci."
    elif score >= 50:
        msg = "Awal yang baik. Dengarkan audio lagi dan fokus pada kata kunci seperti nama, angka, tempat, alasan, dan penanda urutan."
    else:
        msg = "Tidak apa-apa, latihan adalah proses. Putar audio dengan kecepatan lebih lambat, pecah menjadi beberapa bagian, lalu coba lagi."
    return {"text": msg + f" Nilai kamu {score}%.", "mode": "Local fallback"}

"Do not claim to know which individual skill failed. "
"Write plain text only, no Markdown, no asterisks, no bullet symbols."