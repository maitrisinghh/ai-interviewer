import { BACKEND_URL } from "@/lib/config";
import axios from "axios";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { Bot, Loader2, Sparkles, User, Terminal, RotateCcw } from "lucide-react";
import { Button } from "./ui/button";
import { cn } from "@/lib/utils";

interface Breakdown {
    technicalDepth: number;
    communication: number;
    problemSolving: number;
    relevance: number;
}

interface ResultData {
    transcript: { type: "Assistant" | "User"; content: string; createdAt: string }[];
    score: number;
    feedback: string;
    breakdown: Breakdown | null;
    status: "Done" | "InProgress" | "Pre";
}

function ScoreRing({ score }: { score: number }) {
    const radius = 40;
    const circ = 2 * Math.PI * radius;
    const dash = (score / 10) * circ;
    const color = score >= 8 ? "#22d3ee" : score >= 5 ? "#818cf8" : "#f87171";

    return (
        <div className="relative flex h-28 w-28 items-center justify-center">
            <svg className="-rotate-90" width="112" height="112" viewBox="0 0 112 112">
                <circle cx="56" cy="56" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7" />
                <circle
                    cx="56" cy="56" r={radius}
                    fill="none"
                    stroke={color}
                    strokeWidth="7"
                    strokeLinecap="round"
                    strokeDasharray={`${dash} ${circ}`}
                    style={{ filter: `drop-shadow(0 0 6px ${color})`, transition: "stroke-dasharray 1s ease" }}
                />
            </svg>
            <div className="absolute flex flex-col items-center">
                <span className="text-3xl font-bold" style={{ color }}>{score}</span>
                <span className="font-mono text-xs text-white/30">/10</span>
            </div>
        </div>
    );
}

const BREAKDOWN_ITEMS = [
    { key: "technicalDepth", label: "Technical Depth", weight: "40%" },
    { key: "communication", label: "Communication", weight: "25%" },
    { key: "problemSolving", label: "Problem Solving", weight: "25%" },
    { key: "relevance", label: "GitHub Relevance", weight: "10%" },
] as const;

export function Result() {
    const { interviewId } = useParams();
    const navigate = useNavigate();
    const [result, setResult] = useState<ResultData>({
        score: 0,
        feedback: "",
        breakdown: null,
        transcript: [],
        status: "Pre",
    });

    useEffect(() => {
        const fetchResult = () =>
            axios.get(`${BACKEND_URL}/api/v1/result/${interviewId}`).then((response) => {
                setResult(response.data);
                return response.data.status as ResultData["status"];
            });

        fetchResult();
        const intervalId = setInterval(async () => {
            const s = await fetchResult();
            if (s === "Done") clearInterval(intervalId);
        }, 5000);

        return () => clearInterval(intervalId);
    }, [interviewId]);

    const ready = result.status === "Done";

    return (
        <main className="mx-auto min-h-screen w-full max-w-3xl px-6 py-12">
            <header className="mb-10 flex items-start justify-between gap-4">
                <div>
                    <div className="mb-2 flex items-center gap-2 font-mono text-xs text-[#22d3ee]/60 tracking-widest uppercase">
                        <Terminal className="size-3" />
                        <span>interview results</span>
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight text-white">Session Report</h1>
                    <p className="mt-1 font-mono text-xs text-white/30">#{interviewId?.slice(0, 16)}</p>
                </div>
                <Button
                    variant="outline"
                    onClick={() => navigate("/")}
                    className="gap-2 rounded-lg border-white/10 bg-white/[0.03] text-white/50 hover:bg-white/[0.07] hover:text-white transition-all"
                >
                    <RotateCcw className="size-3.5" />
                    New interview
                </Button>
            </header>

            {!ready ? (
                <div className="flex flex-col items-center justify-center gap-5 rounded-xl border border-white/7 bg-[#0f1117] py-28 text-center">
                    <div className="relative">
                        <Loader2 className="size-8 animate-spin text-[#22d3ee]" />
                        <div className="absolute inset-0 rounded-full blur-lg bg-[#22d3ee]/20" />
                    </div>
                    <div>
                        <p className="font-mono text-sm text-white/70 cursor-blink">Analyzing your interview</p>
                        <p className="mt-1 font-mono text-xs text-white/25">This usually takes a few seconds...</p>
                    </div>
                </div>
            ) : (
                <div className="flex flex-col gap-6">
                    {/* Score + feedback */}
                    <section className="card-scanline rounded-xl border border-white/8 bg-[#0f1117] p-6">
                        <div className="flex items-start gap-6">
                            <ScoreRing score={result.score} />
                            <div className="flex-1 min-w-0">
                                <div className="mb-3 flex items-center gap-2 font-mono text-xs text-white/30 tracking-widest uppercase">
                                    <Sparkles className="size-3 text-[#22d3ee]" />
                                    <span>AI Feedback</span>
                                </div>
                                <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/70">
                                    {result.feedback}
                                </p>
                            </div>
                        </div>
                    </section>

                    {/* Breakdown */}
                    {result.breakdown && (
                        <section className="card-scanline rounded-xl border border-white/8 bg-[#0f1117] p-6">
                            <div className="mb-5 flex items-center gap-2 font-mono text-xs text-white/30 tracking-widest uppercase">
                                <Sparkles className="size-3 text-[#818cf8]" />
                                <span>Score Breakdown</span>
                            </div>
                            <div className="flex flex-col gap-4">
                                {BREAKDOWN_ITEMS.map(({ key, label, weight }) => {
                                    const value = result.breakdown![key];
                                    return (
                                        <div key={key} className="flex items-center gap-3">
                                            <div className="w-36 shrink-0 font-mono text-xs text-white/50">{label}</div>
                                            <div className="flex-1 h-1.5 rounded-full bg-white/5">
                                                <div
                                                    className="h-1.5 rounded-full bg-[#22d3ee] transition-all duration-700"
                                                    style={{
                                                        width: `${value * 10}%`,
                                                        boxShadow: "0 0 6px rgba(34,211,238,0.4)",
                                                    }}
                                                />
                                            </div>
                                            <div className="w-10 text-right font-mono text-xs text-white/60">{value}/10</div>
                                            <div className="w-8 text-right font-mono text-xs text-white/25">{weight}</div>
                                        </div>
                                    );
                                })}
                            </div>
                        </section>
                    )}

                    {/* Transcript */}
                    <section>
                        <div className="mb-4 flex items-center gap-2 font-mono text-xs text-white/30 tracking-widest uppercase">
                            <Terminal className="size-3" />
                            <span>Conversation Transcript</span>
                            <div className="ml-2 flex-1 h-px bg-white/5" />
                        </div>
                        <div className="flex flex-col gap-3">
                            {result.transcript.length === 0 && (
                                <p className="font-mono text-sm text-white/25">No messages recorded for this session.</p>
                            )}
                            {result.transcript.map((m, i) => {
                                const isAi = m.type === "Assistant";
                                return (
                                    <div key={i} className={cn("flex gap-3", isAi ? "justify-start" : "flex-row-reverse")}>
                                        <div className={cn(
                                            "grid size-7 shrink-0 place-items-center rounded-lg",
                                            isAi ? "bg-[#22d3ee]/15 text-[#22d3ee]" : "bg-[#818cf8]/15 text-[#818cf8]"
                                        )}>
                                            {isAi ? <Bot className="size-3.5" /> : <User className="size-3.5" />}
                                        </div>
                                        <div className={cn(
                                            "max-w-[80%] rounded-xl px-4 py-2.5 text-sm leading-relaxed",
                                            isAi
                                                ? "rounded-tl-sm border border-white/6 bg-[#0f1117] text-white/70"
                                                : "rounded-tr-sm border border-[#818cf8]/20 bg-[#818cf8]/10 text-white/80"
                                        )}>
                                            {m.content}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                </div>
            )}
        </main>
    );
}