LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"]

def next_level(level, score):
    """Simple transparent mastery rule: >=80 advance, <50 step back."""
    idx = LEVELS.index(level)
    if score >= 80 and idx < len(LEVELS) - 1:
        return LEVELS[idx + 1]
    if score < 50 and idx > 0:
        return LEVELS[idx - 1]
    return level
