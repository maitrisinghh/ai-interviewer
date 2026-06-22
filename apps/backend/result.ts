import { z } from "zod";
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! });

const outputSchema = z.object({
    feedback: z.string(),
    score: z.number().int(),
    breakdown: z.object({
        technicalDepth: z.number().int(),
        communication: z.number().int(),
        problemSolving: z.number().int(),
        relevance: z.number().int(),
    }),
});

const RESULT_PROMPT = `
You are an expert technical interview evaluator. Evaluate the interview transcript below.

Return ONLY a raw JSON object (no markdown, no backticks) with this exact shape:
{
  "feedback": "2-3 sentences of honest, specific feedback",
  "score": <weighted overall score out of 10>,
  "breakdown": {
    "technicalDepth": <score out of 10, weight 40%>,
    "communication": <score out of 10, weight 25%>,
    "problemSolving": <score out of 10, weight 25%>,
    "relevance": <score out of 10, weight 10%>
  }
}

The overall score must equal: (technicalDepth * 0.4) + (communication * 0.25) + (problemSolving * 0.25) + (relevance * 0.1), rounded to nearest integer.

Transcript:
{{USER_TRANSCRIPT}}
`;

export async function calculateResult(messages: { type: "Assistant" | "User"; message: string; createdAt: Date }[]) {
    const prompt = RESULT_PROMPT.replace("{{USER_TRANSCRIPT}}", JSON.stringify(messages));

    console.log("Calling Groq for result, messages count:", messages.length);

    const response = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [{ role: "user", content: prompt }],
        response_format: { type: "json_object" },
        temperature: 0.3,
    });

    const text = response.choices[0]?.message?.content ?? "{}";
    console.log("Groq raw response:", text);

    let parsed;
    try {
        parsed = JSON.parse(text);
        console.log("Parsed JSON:", JSON.stringify(parsed));
    } catch (e) {
        console.error("JSON parse failed:", e);
        throw e;
    }

    try {
        const result = outputSchema.parse(parsed);
        console.log("Zod parse success:", JSON.stringify(result));
        return result;
    } catch (e) {
        console.error("Zod parse failed:", e);
        throw e;
    }
}