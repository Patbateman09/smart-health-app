const API_BASE = "http://localhost:3001/api"; // Change if your backend runs elsewhere

export async function symptomCheck(userId: string, symptoms: string, answers: string[]) {
  const res = await fetch(`${API_BASE}/symptom-check`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, symptoms, answers }),
  });
  return res.json();
}

export async function getRecommendations(userId: string, appointmentId: string) {
  const res = await fetch(`${API_BASE}/recommendations`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, appointmentId }),
  });
  return res.json();
}

export async function sendReminder(userId: string, message: string, via: "sms" | "app") {
  const res = await fetch(`${API_BASE}/send-reminder`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, message, via }),
  });
  return res.json();
} 