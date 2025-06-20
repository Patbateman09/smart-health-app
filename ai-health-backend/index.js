console.log("Starting server...");
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { OpenAI } = require('openai');
const app = express();
app.use(cors());
app.use(bodyParser.json());

const openai = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
});

app.post('/api/symptom-check', async (req, res) => {
  try {
    const { symptoms, answers } = req.body;
    let prompt = `Patient reports: ${symptoms}.`;
    if (answers && answers.length) {
      prompt += ` Previous answers: ${answers.join(' ')}.`;
    }
    prompt += `\nAsk the next most relevant medical question to clarify the diagnosis. \nIf enough information is provided, predict the most likely condition and suggest a specialist. \nIf not, just ask the next question.`;

    const completion = await openai.chat.completions.create({
      model: "deepseek/deepseek-r1-0528:free",
      messages: [
        { role: "system", content: "You are a helpful medical assistant." },
        { role: "user", content: prompt }
      ],
      max_tokens: 512,
      temperature: 0.7,
    });

    console.log("Model message:", completion.choices[0]?.message);

    const message = completion.choices[0]?.message;
    let text = message?.content?.trim();
    if (!text) {
      // Fallback to reasoning if content is empty (DeepSeek model)
      text = message?.reasoning?.trim();
    }
    if (!text) {
      text = "Sorry, I couldn't understand. Please try again.";
    }

    const isDiagnosis = text.toLowerCase().includes('condition') || text.toLowerCase().includes('specialist');
    if (isDiagnosis) {
      res.json({ prediction: text });
    } else {
      res.json({ nextQuestion: text });
    }
  } catch (err) {
    console.error('Symptom check error:', err.response?.data || err.message || err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

app.post('/api/recommendations', async (req, res) => {
  try {
    const { profile, appointment } = req.body;
    let prompt = `Patient profile: ${JSON.stringify(profile)}.\nRecent appointment: ${JSON.stringify(appointment)}.\nBased on this information and standard health guidelines, suggest personalized lifestyle changes, reminders, and diet tips for the patient. Format as a short, actionable list.`;

    const completion = await openai.chat.completions.create({
      model: "deepseek/deepseek-r1-0528:free",
      messages: [
        { role: "system", content: "You are a helpful medical assistant that gives personalized, actionable health recommendations after each appointment." },
        { role: "user", content: prompt }
      ],
      max_tokens: 512,
      temperature: 0.7,
    });

    const message = completion.choices[0]?.message;
    let text = message?.content?.trim();
    if (!text) {
      text = message?.reasoning?.trim();
    }
    if (!text) {
      text = "Sorry, I couldn't generate recommendations. Please try again.";
    }
    res.json({ recommendations: text });
  } catch (err) {
    console.error('Recommendation error:', err.response?.data || err.message || err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));