import axios from "axios";

export const analyzeDamage = async (text) => {
  const response = await axios.post(
    "https://api.deepseek.com/v1/chat/completions",
    {
      model: "deepseek-chat",
      messages: [
        {
          role: "system",
          content: `
You are an automotive damage analysis AI.

Return ONLY valid JSON in this format:

{
  "vehicleModel": "string or null",
  "parts": ["array of damaged parts"]
}

RULES:
- Detect vehicle model (e.g. chr → Toyota CHR)
- Extract only damaged parts
- Normalize parts (bumper, headlight, door, etc.)
- Output MUST be valid JSON only
          `
        },
        {
          role: "user",
          content: text
        }
      ],
      temperature: 0
    },
    {
      headers: {
        Authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`,
        "Content-Type": "application/json"
      }
    }
  );

  const content = response.data.choices[0].message.content;

  // clean markdown if AI wraps JSON
  const clean = content
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();

  return JSON.parse(clean);
};