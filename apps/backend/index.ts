console.log("GROQ KEY loaded:", !!process.env.GROQ_API_KEY);
console.log("DB URL loaded:", !!process.env.DATABASE_URL);
import express from "express";
import { PreInterviewBody } from "./types";
import { scrapeGithub } from "./scrapers/github";
import cors from "cors";
import { prisma } from "./db";
import { calculateResult } from "./result";
import Groq from "groq-sdk";
import "dotenv/config";

const app = express();
app.use(express.json());
app.use(cors());

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY! });

const SYSTEM_PROMPT = (githubMetadata: string) => `
You are a technical interviewer conducting a real voice interview. Be conversational, concise, and natural.
Ask ONE question at a time. Keep responses under 3 sentences.
Start by briefly greeting the candidate and asking your first technical question based on their GitHub.
Base your questions on their actual projects and tech stack shown below.

GitHub profile:
${githubMetadata}
`;

app.post("/api/v1/pre-interview", async (req, res) => {
    const { success, data } = PreInterviewBody.safeParse(req.body);

    if (!success) {
        res.status(411).json({ message: "Incorrect body" });
        return;
    }

    const githubUrl = data.github.endsWith("/") ? data.github.slice(0, -1) : data.github;
    const githubUsername = githubUrl.split("/").pop()!;

    try {
        const githubData = await scrapeGithub(githubUsername);
        const interview = await prisma.interview.create({
            data: {
                githubMetadata: JSON.stringify(githubData),
                status: "Pre",
            },
        });
        res.json({ id: interview.id });
    } catch (error) {
        console.error("Pre-interview error:", error);
        res.status(500).json({ message: "Failed to create interview" });
    }
});

app.post("/api/v1/session/ai-turn/:interviewId", async (req, res) => {
    const { interviewId } = req.params;

    try {
        const interview = await prisma.interview.findFirst({
            where: { id: interviewId },
            include: { conversations: { orderBy: { createdAt: "asc" } } },
        });

        if (!interview) {
            res.status(404).json({ message: "Interview not found" });
            return;
        }

        if (interview.status === "Pre") {
            await prisma.interview.update({
                where: { id: interviewId },
                data: { status: "InProgress" },
            });
        }

        const messages: { role: "assistant" | "user"; content: string }[] =
            interview.conversations.map((c) => ({
                role: c.type === "Assistant" ? "assistant" : "user",
                content: c.message,
            }));

        const groqResponse = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [
                { role: "system", content: SYSTEM_PROMPT(interview.githubMetadata as string) },
                ...messages,
            ],
            temperature: 0.7,
            max_tokens: 200,
        });

        const aiMessage =
            groqResponse.choices[0]?.message?.content ??
            "Could you tell me more about your experience?";

        await prisma.message.create({
            data: {
                interviewId,
                type: "Assistant",
                message: aiMessage,
            },
        });

        res.json({ message: aiMessage });
    } catch (error) {
        console.error("AI turn error:", error);
        res.status(500).json({ message: "AI turn failed" });
    }
});

app.post("/api/v1/session/user/response/:interviewId", async (req, res) => {
    const { message } = req.body;
    if (!message?.trim()) {
        res.json({ message: "Empty transcript skipped" });
        return;
    }
    try {
        await prisma.message.create({
            data: {
                interviewId: req.params.interviewId!,
                type: "User",
                message: message.trim(),
            },
        });
        res.json({ message: "Saved" });
    } catch (error) {
        console.error("Save user response error:", error);
        res.status(500).json({ message: "Failed to save response" });
    }
});

app.get("/api/v1/result/:interviewId", async (req, res) => {
    try {
        const interview = await prisma.interview.findFirst({
            where: { id: req.params.interviewId },
            include: { conversations: { orderBy: { createdAt: "asc" } } },
        });

        if (!interview) {
            res.status(404).json({ message: "Interview not found" });
            return;
        }

        res.json({
            score: interview.score,
            feedback: interview.feedback,
            transcript: interview.conversations.map((c) => ({
                type: c.type,
                content: c.message,
                createdAt: c.createdAt,
            })),
            status: interview.status,
        });

        if (interview.status !== "Done") {
            const result = await calculateResult(interview.conversations);
            await prisma.interview.update({
                where: { id: req.params.interviewId },
                data: {
                    status: "Done",
                    feedback: result.feedback,
                    score: result.score,
                },
            });
        }
    } catch (error) {
        console.error("Result error:", error);
    }
});

app.listen(3001, () => console.log("Backend running on :3001"));
app.get("/api/v1/deepgram-token", async (req, res) => {
    try {
        const response = await fetch("https://api.deepgram.com/v1/projects", {
            headers: {
                Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
            },
        });
        const data = await response.json() as any;
        const projectId = data.projects[0].project_id;

        const keyResponse = await fetch(
            `https://api.deepgram.com/v1/projects/${projectId}/keys`,
            {
                method: "POST",
                headers: {
                    Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    comment: "temp-key",
                    scopes: ["usage:write"],
                    time_to_live_in_seconds: 60,
                }),
            }
        );
        const keyData = await keyResponse.json() as any;
        res.json({ key: keyData.key });
    } catch (error) {
        console.error("Deepgram token error:", error);
        res.status(500).json({ message: "Failed to generate token" });
    }
});