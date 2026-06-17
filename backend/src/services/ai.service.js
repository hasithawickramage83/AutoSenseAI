import axios from "axios";

export const analyzeDamage = async (text, vehicleModel) => {
  const modelHint = vehicleModel?.trim();
  const systemRules = modelHint
    ? `
You are an automotive damage analysis AI.

The vehicle model is EXACTLY: "${modelHint}"
Use this exact vehicle model string in vehicleModel.

Return ONLY valid JSON in this format:

{
  "vehicleModel": "${modelHint}",
  "parts": ["array of damaged part names WITHOUT vehicle prefix"]
}

RULES:
- vehicleModel MUST be exactly "${modelHint}"
- parts must be bare part descriptions only (e.g. "front bumper", "left headlight")
- Do NOT prefix parts with make or model
- Normalize parts (bumper, headlight, door, etc.)
- Output MUST be valid JSON only
`
    : `
You are an automotive damage analysis AI.

Return ONLY valid JSON in this format:

{
  "vehicleModel": "string or null",
  "parts": ["array of damaged parts"]
}

RULES:
- Detect vehicle model (e.g. chr → Toyota C-HR)
- Extract only damaged parts
- Normalize parts (bumper, headlight, door, etc.)
- Output MUST be valid JSON only
`;

  const response = await axios.post(
    "https://api.deepseek.com/v1/chat/completions",
    {
      model: "deepseek-chat",
      messages: [
        {
          role: "system",
          content: systemRules.trim(),
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