import axios from "axios";
import { SYMMETRIC_PARTS_PROMPT_LIST } from "../utils/damagePartValidation.js";

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
  "parts": ["array of damaged part names WITHOUT vehicle prefix"],
  "clarificationsNeeded": [
    {
      "mentioned": "part mentioned in description",
      "reason": "why more detail is needed",
      "prompt": "question to ask the workshop user"
    }
  ]
}

RULES:
- vehicleModel MUST be exactly "${modelHint}"
- parts must be bare part descriptions only (e.g. "front bumper", "left headlight")
- Do NOT prefix parts with make or model
- Do NOT guess left/right or front/rear — if the description is vague (e.g. "headlight cracked" without left or right), put it in clarificationsNeeded instead of parts
- These parts MUST have left or right specified: ${SYMMETRIC_PARTS_PROMPT_LIST}
- "Side mirror", "tail light", "taillight", and similar must still specify left or right — the word "side" alone is not enough
- Bumpers, grilles, and similar must have front or rear specified before adding to parts
- Only include fully specified damaged parts in parts
- clarificationsNeeded can be an empty array when everything is clear
- Output MUST be valid JSON only
`
    : `
You are an automotive damage analysis AI.

Return ONLY valid JSON in this format:

{
  "vehicleModel": "string or null",
  "parts": ["array of damaged parts"],
  "clarificationsNeeded": [
    {
      "mentioned": "part mentioned in description",
      "reason": "why more detail is needed",
      "prompt": "question to ask the workshop user"
    }
  ]
}

RULES:
- Detect vehicle model (e.g. chr → Toyota C-HR)
- Extract only damaged parts that are fully specified
- Do NOT guess left/right or front/rear for symmetric parts
- These parts MUST have left or right specified: ${SYMMETRIC_PARTS_PROMPT_LIST}
- "Side mirror", "tail light", and similar must still specify left or right
- If a part lacks required detail, add clarificationsNeeded instead of parts
- clarificationsNeeded can be an empty array
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