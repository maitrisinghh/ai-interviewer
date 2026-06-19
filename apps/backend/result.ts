import { z } from "zod";
import Groq from "groq-sdk";

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! });

const outputSchema = z.object({
    feedback: z.string().describe("Feedback for the user"),
    score: z.number().int().describe("Score out of 10 for their interview"),
});

const RESULT_PROMPT = `
    You are an expert evaluator. Your job is to evaluate the users interview. Give them a score out of 10
    and also let them know any feedback you have about their interview.

    Please return only a JSON object which looks like this:
    {
        "feedback": "string with your feedback",
        "score": number between 0 and 10
    }

    DO NOT RETURN ANY OTHER TEXT. No markdown, no backticks, just raw JSON.
    {{USER_TRANSCRIPT}}
`

export async function calculateResult(messages: {type: "Assistant" | "User", message: string, createdAt: Date}[]) {
    const prompt = RESULT_PROMPT.replace(`{{USER_TRANSCRIPT}}`, JSON.stringify(messages));

    const response = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
            {
                role: "user",
                content: prompt,
            },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
    });

    const text = response.choices[0]?.message?.content ?? "{}";
    console.log(text);
    const result = outputSchema.parse(JSON.parse(text));
    return result;
}
