"""
AI Proctoring & Risk Analysis Service
FastAPI + scikit-learn

The backend sends the logged activity of an exam attempt. This service converts
it into numeric features and returns a risk score (0-100), a risk level and a
list of human-readable reasons. The AI only FLAGS activity for faculty review;
it never declares misconduct on its own.
"""
from typing import List, Optional

import numpy as np
from fastapi import FastAPI
from pydantic import BaseModel, Field
from sklearn.ensemble import RandomForestClassifier

app = FastAPI(title="AI Proctoring Service", version="1.0.0")

# Activity types logged by the frontend during an exam.
ACTIVITY_TYPES = [
    "tab_switch",       # student switched tab / window lost focus
    "copy_paste",       # copy / paste / cut attempt
    "right_click",      # context menu attempt
    "fullscreen_exit",  # left full screen mode
    "key_shortcut",     # blocked keyboard shortcut (devtools, print, ...)
    "face_not_visible", # reserved for webcam based checks
]
FEATURES = ACTIVITY_TYPES + ["duration_minutes", "avg_seconds_per_question"]


# ---------------------------------------------------------------- model --
def _synthetic_dataset(n: int = 3000, seed: int = 42):
    """Generate labelled synthetic attempts: 0 = normal, 1 = suspicious."""
    rng = np.random.default_rng(seed)
    X, y = [], []
    for _ in range(n):
        suspicious = rng.random() < 0.4
        if suspicious:
            counts = [
                rng.poisson(6), rng.poisson(4), rng.poisson(3),
                rng.poisson(3), rng.poisson(3), rng.poisson(1),
            ]
            duration = rng.uniform(5, 60)
            # suspicious attempts are either rushed or look like normal pacing;
            # slow answering alone is NOT a sign of misconduct
            avg_q = rng.choice([rng.uniform(1, 8), rng.uniform(15, 200)])
        else:
            counts = [
                rng.poisson(0.7), rng.poisson(0.3), rng.poisson(0.4),
                rng.poisson(0.3), rng.poisson(0.2), rng.poisson(0.05),
            ]
            duration = rng.uniform(10, 60)
            avg_q = rng.choice([rng.uniform(15, 90), rng.uniform(90, 300)])
        X.append(counts + [duration, avg_q])
        y.append(int(suspicious))
    return np.array(X, dtype=float), np.array(y)


_X, _y = _synthetic_dataset()
model = RandomForestClassifier(n_estimators=120, max_depth=8, random_state=42)
model.fit(_X, _y)


# -------------------------------------------------------------- schemas --
class Activity(BaseModel):
    activity_type: str
    activity_time: Optional[str] = None


class AnalyzeRequest(BaseModel):
    attempt_id: str
    activities: List[Activity] = Field(default_factory=list)
    duration_minutes: float = 30
    question_count: int = 1
    time_taken_seconds: float = 0


class AnalyzeResponse(BaseModel):
    attempt_id: str
    risk_score: float
    risk_level: str
    suspicious_activity: List[str]
    counts: dict


# --------------------------------------------------------------- routes --
@app.get("/health")
def health():
    return {"status": "ok", "model": "RandomForestClassifier", "features": FEATURES}


@app.post("/analyze", response_model=AnalyzeResponse)
def analyze(req: AnalyzeRequest):
    counts = {t: 0 for t in ACTIVITY_TYPES}
    for a in req.activities:
        if a.activity_type in counts:
            counts[a.activity_type] += 1

    avg_per_q = (req.time_taken_seconds / req.question_count) if req.question_count else 0
    vector = [counts[t] for t in ACTIVITY_TYPES] + [req.duration_minutes, avg_per_q]

    prob = float(model.predict_proba(np.array([vector]))[0][1])
    risk_score = round(prob * 100, 1)

    if risk_score >= 70:
        level = "HIGH"
    elif risk_score >= 40:
        level = "MEDIUM"
    else:
        level = "LOW"

    reasons = []
    if counts["tab_switch"] >= 3:
        reasons.append(f"Switched tabs/windows {counts['tab_switch']} times")
    if counts["copy_paste"] >= 2:
        reasons.append(f"{counts['copy_paste']} copy/paste attempts")
    if counts["fullscreen_exit"] >= 2:
        reasons.append(f"Exited full screen {counts['fullscreen_exit']} times")
    if counts["right_click"] >= 3:
        reasons.append(f"{counts['right_click']} right-click attempts")
    if counts["key_shortcut"] >= 2:
        reasons.append(f"{counts['key_shortcut']} blocked keyboard shortcuts")
    if counts["face_not_visible"] >= 1:
        reasons.append("Face not visible during the exam")
    if req.question_count and 0 < avg_per_q < 5:
        reasons.append(f"Unusually fast answering (~{avg_per_q:.1f}s per question)")

    return AnalyzeResponse(
        attempt_id=req.attempt_id,
        risk_score=risk_score,
        risk_level=level,
        suspicious_activity=reasons,
        counts=counts,
    )
