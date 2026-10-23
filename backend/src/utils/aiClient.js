const AIRiskAnalysis = require('../models/AIRiskAnalysis');
const IntegrityReport = require('../models/IntegrityReport');
const ExamActivity = require('../models/ExamActivity');

/**
 * Sends the attempt's logged activity to the FastAPI service, stores the risk
 * analysis and creates an integrity report for faculty review.
 * If the AI service is down, the attempt is still saved; the analysis is marked
 * UNAVAILABLE so faculty know it was not checked (never silently "LOW").
 */
async function analyzeAttempt({ attempt, exam, questionCount }) {
  const activities = await ExamActivity.find({ attempt: attempt._id }).sort({ activityTime: 1 });
  const timeTaken = attempt.endTime ? (attempt.endTime - attempt.startTime) / 1000 : 0;

  let data = null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const resp = await fetch(`${process.env.AI_SERVICE_URL}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        attempt_id: String(attempt._id),
        activities: activities.map((a) => ({
          activity_type: a.activityType,
          activity_time: a.activityTime.toISOString(),
        })),
        duration_minutes: exam.duration,
        question_count: questionCount,
        time_taken_seconds: timeTaken,
      }),
    });
    clearTimeout(timer);
    if (!resp.ok) throw new Error(`AI service responded ${resp.status}`);
    data = await resp.json();
  } catch (err) {
    console.warn('[AI] service unavailable:', err.message);
  }

  const analysis = await AIRiskAnalysis.findOneAndUpdate(
    { attempt: attempt._id },
    data
      ? {
          riskScore: data.risk_score,
          riskLevel: data.risk_level,
          suspiciousActivity: data.suspicious_activity,
          source: 'ai-service',
        }
      : {
          riskScore: 0,
          riskLevel: 'UNAVAILABLE',
          suspiciousActivity: ['AI service was unreachable - please review manually'],
          source: 'fallback',
        },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  await IntegrityReport.findOneAndUpdate(
    { attempt: attempt._id },
    { analysis: analysis._id, student: attempt.student, exam: exam._id },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );
  return analysis;
}

module.exports = { analyzeAttempt };
