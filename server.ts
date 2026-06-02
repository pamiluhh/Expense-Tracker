import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI, Type } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Google GenAI client securely on the server
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;
if (apiKey) {
  ai = new GoogleGenAI({
    apiKey: apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
} else {
  console.warn('GEMINI_API_KEY is not defined. The AI financial advisor will have restricted access.');
}

// REST API for Gemini AI Advisor Support
app.post('/api/gemini/chat', async (req, res) => {
  if (!ai) {
    return res.status(503).json({
      error: 'AI service is currently unavailable. Please verify your GEMINI_API_KEY in Settings > Secrets.',
    });
  }

  const { history, prompt } = req.body;

  try {
    // Encourage fluent, natural multilingual replies (Tagalog, Taglish, English) and answering general topics/random questions like ChatGPT.
    const systemInstruction = 
      "You are 'Scholar AI Assistant', an intelligent, versatile, and companionable AI chatbot just like ChatGPT, " +
      "designed for students. You are friendly, creative, reassuring, and highly knowledgeable. " +
      "Crucially, you DO NOT restrict yourself to only student budgeting—you can naturally answer ALL random questions, " +
      "casual chit-chats, coding questions, general knowledge, academic topics, or creative write-ups! " +
      "You MUST respond in whatever language the user matches or prefers, including Tagalog, Taglish, and English. " +
      "If the user asks in Tagalog, answer in clear, friendly Tagalog/Taglish. Keep your tone encouraging, " +
      "approachable, and human-like. While you can offer clever student financial tips if asked (representing money in Philippine Pesos ₱), " +
      "you must cheerfully handle any general-purpose discussion or helper requests exactly like ChatGPT would.";

    // Convert client-provided history to standard Gemini SDK format
    // Clients pass history as: { role: 'user' | 'assistant', text: string }[]
    const contents: any[] = [];
    if (Array.isArray(history)) {
      history.forEach((msg: any) => {
        contents.push({
          role: msg.role === 'user' ? 'user' : 'model',
          parts: [{ text: msg.text }],
        });
      });
    }

    // Append current prompt
    contents.push({
      role: 'user',
      parts: [{ text: prompt }],
    });

    let response;
    let modelUsed = 'gemini-3.5-flash';
    try {
      response = await ai.models.generateContent({
        model: 'gemini-3.5-flash',
        contents: contents,
        config: {
          systemInstruction,
          temperature: 0.7,
        },
      });
    } catch (firstErr: any) {
      console.warn('Primary model gemini-3.5-flash failed, attempting fallback to gemini-flash-latest. Error:', firstErr.message || firstErr);
      try {
        modelUsed = 'gemini-flash-latest';
        response = await ai.models.generateContent({
          model: 'gemini-flash-latest',
          contents: contents,
          config: {
            systemInstruction,
            temperature: 0.7,
          },
        });
      } catch (secondErr: any) {
        console.warn('Fallback model gemini-flash-latest failed, attempting last-resort gemini-3.1-flash-lite. Error:', secondErr.message || secondErr);
        modelUsed = 'gemini-3.1-flash-lite';
        response = await ai.models.generateContent({
          model: 'gemini-3.1-flash-lite',
          contents: contents,
          config: {
            systemInstruction,
            temperature: 0.7,
          },
        });
      }
    }

    const textResult = response.text || "Sensya na, medyo nahirapan akong magisip doon. Paki-ulit nating dalawa.";
    res.json({ text: textResult });
  } catch (err: any) {
    console.error('Gemini chat error in server backend:', err);
    res.status(500).json({ error: err.message || 'Medyo nagkaroon ng error sa pagkonekta sa AI Helper. Subukan ulit!' });
  }
});

// Setup development or production environment assets serving
async function setupVite() {
  if (process.env.NODE_ENV !== 'production') {
    console.log('Running server in development mode with HMR disabled middleware...');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    console.log('Running server in production mode serving static layout...');
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server successfully booted and listening at http://localhost:${PORT}`);
  });
}

setupVite().catch((err) => {
  console.error('Critical initialization error booting Express-Vite backend:', err);
});
