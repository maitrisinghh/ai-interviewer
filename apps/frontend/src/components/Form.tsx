import { useState } from "react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { toast } from "sonner";
import axios from "axios";
import { BACKEND_URL } from "@/lib/config";
import { useNavigate } from "react-router";
import { ArrowRight, Github, Loader2, Terminal, Zap, Brain, Mic } from "lucide-react";

export function Form() {
    const [github, setGithub] = useState("");
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    async function onSubmit() {
        if (!github.trim()) {
            toast("Please provide a valid GitHub URL");
            return;
        }
        setLoading(true);
        try {
            const response = await axios.post(`${BACKEND_URL}/api/v1/pre-interview`, {
                github: github.trim(),
            });
            navigate(`/interview/${response.data.id}`);
        } catch (e: any) {
            toast("Something went wrong starting your interview. Please try again.");
            setLoading(false);
        }
    }

    return (
        <main className="flex h-screen w-screen items-center justify-center overflow-hidden px-6">
            <div className="flex w-full max-w-2xl flex-col">

                {/* Terminal bar */}
                <div className="mb-8 flex items-center gap-2">
                    <div className="flex items-center gap-1.5">
                        <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
                        <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
                        <span className="h-3 w-3 rounded-full bg-[#28c840]" />
                    </div>
                    
                </div>

                {/* Headline */}
                <div className="mb-10">
                    <p className="mb-3 font-bold leading-tight tracking-[0.25em] text-[#22d3ee] uppercase">
                        / AI-Powered Interview Platform
                    </p>
                    <h1 className="text-5xl font-bold leading-tight tracking-tight text-white sm:text-6xl">
                        Crack your next{" "}
                        <span className="bg-gradient-to-r from-[#22d3ee] to-[#818cf8] bg-clip-text text-transparent">
                            tech interview
                        </span>
                    </h1>
                    <p className="mt-4 max-w-lg text-base leading-relaxed text-slate-400">
                        Drop your GitHub profile. Our AI analyzes your work, conducts a
                        personalized voice interview, and scores your performance — in real time.
                    </p>
                </div>

                {/* Input card */}
                <div className="card-scanline rounded-xl border border-white/10 bg-[#0f1117] p-1 shadow-2xl shadow-black/40">
                    <div className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/[0.03] p-2 focus-within:border-[#22d3ee]/40 focus-within:ring-2 focus-within:ring-[#22d3ee]/20 transition-all">
                        <div className="flex items-center pl-2 text-slate-500">
                            <Github className="size-4" />
                        </div>
                        <Input
                            value={github}
                            placeholder="https://github.com/your-username"
                            onChange={(e) => setGithub(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && !loading && onSubmit()}
                            disabled={loading}
                            className="border-0 bg-transparent font-mono text-sm text-white shadow-none placeholder:text-slate-600 focus-visible:ring-0"
                        />
                        <Button
                            disabled={loading}
                            onClick={onSubmit}
                            size="lg"
                            className="shrink-0 gap-2 rounded-lg bg-[#22d3ee] font-semibold text-[#08090d] hover:bg-[#06b6d4] transition-colors"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="size-4 animate-spin" />
                                    Initializing
                                </>
                            ) : (
                                <>
                                    Start
                                    <ArrowRight className="size-4" />
                                </>
                            )}
                        </Button>
                    </div>
                </div>

                <p className="mt-3 font-mono text-xs text-slate-600">
                    <span className="text-[#22d3ee]/50">$</span> microphone access requested on interview start
                </p>

                {/* Feature pills */}
                <div className="mt-10 flex flex-wrap gap-3">
                    {[
                        { icon: Brain, label: "GitHub-aware questions" },
                        { icon: Mic, label: "Live voice interview" },
                        { icon: Zap, label: "Weighted score report" },
                    ].map(({ icon: Icon, label }) => (
                        <div
                            key={label}
                            className="flex items-center gap-2 rounded-full border border-white/8 bg-white/[0.03] px-3 py-1.5 text-xs text-slate-400"
                        >
                            <Icon className="size-3 text-[#22d3ee]" />
                            {label}
                        </div>
                    ))}
                </div>
            </div>
        </main>
    );
}