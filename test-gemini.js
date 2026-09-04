import { GoogleGenAI } from '@google/genai';
const ai = new GoogleGenAI();
async function run() {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: [
        {
          inlineData: {
            mimeType: 'audio/mp3',
            data: 'SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU5'
          }
        },
        "Transcribe this audio precisely."
      ]
    });
    console.log("Success with", response.text);
  } catch (err) {
    console.error("Failed with", err.message);
  }
}
run();
