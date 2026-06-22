import { BACKEND_URL } from "@/lib/config";
import axios from "axios";
import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate, useParams } from "react-router";
import { Bot, Loader2, PhoneOff, User } from "lucide-react";
import { Button } from "./ui/button";
import { VoiceOrb } from "./VoiceOrb";

type Status = "connecting" | "ai-speaking" | "user-speaking" | "processing" | "ending";

function createLevelMeter(stream: MediaStream, audioCtx: AudioContext) {
    const source = audioCtx.createMediaStreamSource(stream);
    const analyser = audioCtx.createAnalyser();
    analyser.fftSize = 512;
    analyser.smoothingTimeConstant = 0.75;
    source.connect(analyser);
    const data = new Uint8Array(analyser.fftSize);
    return () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
            const v = (data[i]! - 128) / 128;
            sum += v * v;
        }
        return Math.min(1, Math.sqrt(sum / data.length) * 3.5);
    };
}

export function Interview() {
    const { interviewId } = useParams();
    const navigate = useNavigate();

    const [status, setStatus] = useState<Status>("connecting");
    const [aiLevel, setAiLevel] = useState(0);
    const [userLevel, setUserLevel] = useState(0);

    const audioCtxRef = useRef<AudioContext | null>(null);
    const userStreamRef = useRef<MediaStream | null>(null);
    const userMeterRef = useRef<(() => number) | null>(null);
    const rafRef = useRef<number | null>(null);
    const dgSocketRef = useRef<WebSocket | null>(null);
    const recorderRef = useRef<MediaRecorder | null>(null);
    const pendingTranscriptRef = useRef<string>("");
    const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isEndingRef = useRef(false);
    const keepAliveRef = useRef<ReturnType<typeof setInterval> | null>(null);
    // Prevent double-submission if silence timer fires while already processing
    const isProcessingRef = useRef(false);

    const submitUserResponseRef = useRef<() => Promise<void>>(async () => {});

    const startRaf = useCallback(() => {
        const tick = () => {
            if (userMeterRef.current) setUserLevel(userMeterRef.current());
            rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
    }, []);

    const speak = useCallback((text: string): Promise<void> => {
        return new Promise((resolve) => {
            window.speechSynthesis.cancel();
            const utter = new SpeechSynthesisUtterance(text);
            utter.rate = 1.0;
            utter.pitch = 1.0;
            utter.volume = 1.0;

            const voices = window.speechSynthesis.getVoices();
            const preferred = voices.find(
                (v) => v.lang.startsWith("en") && (
                    v.name.includes("Google") ||
                    v.name.includes("Samantha") ||
                    v.name.includes("Daniel")
                )
            );
            if (preferred) utter.voice = preferred;

            let fakeLevel = 0;
            let direction = 1;
            const animInterval = setInterval(() => {
                fakeLevel += direction * (0.05 + Math.random() * 0.08);
                if (fakeLevel > 0.85 || fakeLevel < 0.1) direction *= -1;
                setAiLevel(Math.min(1, Math.max(0, fakeLevel)));
            }, 80);

            const fallback = setTimeout(() => {
                clearInterval(animInterval);
                setAiLevel(0);
                resolve();
            }, text.length * 80 + 3000);

            utter.onend = () => {
                clearTimeout(fallback);
                clearInterval(animInterval);
                setAiLevel(0);
                resolve();
            };

            window.speechSynthesis.speak(utter);
        });
    }, []);

    const startListening = useCallback(async () => {
        if (!userStreamRef.current || isEndingRef.current) return;

        window.speechSynthesis.cancel();
        pendingTranscriptRef.current = "";
        isProcessingRef.current = false;
        setStatus("user-speaking");

        const { data: tokenData } = await axios.get(`${BACKEND_URL}/api/v1/deepgram-token`);
        const dgKey = tokenData.key;

        const socket = new WebSocket("wss://api.deepgram.com/v1/listen", [
            "token",
            dgKey,
        ]);
        dgSocketRef.current = socket;

        keepAliveRef.current = setInterval(() => {
            if (socket.readyState === WebSocket.OPEN) {
                socket.send(JSON.stringify({ type: "KeepAlive" }));
            }
        }, 8000);

        socket.onopen = () => {
            const recorder = new MediaRecorder(userStreamRef.current!, {
                mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
                    ? "audio/webm;codecs=opus"
                    : "audio/webm",
            });
            recorderRef.current = recorder;
            recorder.start(250);
            recorder.addEventListener("dataavailable", (e) => {
                if (socket.readyState === WebSocket.OPEN && e.data.size > 0) {
                    socket.send(e.data);
                }
            });
        };

        socket.onmessage = (msg) => {
            if (isProcessingRef.current) return;

            const data = JSON.parse(msg.data);

            // FIX 1: Only use final transcripts, not interim partials
            const isFinal = data.is_final === true;
            const transcript = data.channel?.alternatives?.[0]?.transcript ?? "";

            if (!transcript || !isFinal) return;

            pendingTranscriptRef.current += " " + transcript;

            // FIX 1: 4s silence window so user can finish full sentences
            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = setTimeout(() => {
                submitUserResponseRef.current();
            }, 4000);
        };

        socket.onerror = (e) => console.error("Deepgram error", e);

        // FIX 2: If socket closes unexpectedly while user-speaking, restart listening
        socket.onclose = (e) => {
            if (isEndingRef.current || isProcessingRef.current) return;
            if (status === "user-speaking") {
                console.warn("Deepgram socket closed unexpectedly, restarting...");
                setTimeout(() => {
                    if (!isEndingRef.current && !isProcessingRef.current) {
                        startListening();
                    }
                }, 1000);
            }
        };
    }, []);

    const doAiTurn = useCallback(async () => {
        if (isEndingRef.current) return;
        setStatus("ai-speaking");

        // Retry up to 3 times if AI turn fails
        for (let attempt = 0; attempt < 3; attempt++) {
            try {
                const { data } = await axios.post(
                    `${BACKEND_URL}/api/v1/session/ai-turn/${interviewId}`
                );
                if (isEndingRef.current) return;
                await speak(data.message);
                if (!isEndingRef.current) await startListening();
                return;
            } catch (err) {
                console.error(`AI turn failed attempt ${attempt + 1}:`, err);
                if (attempt === 2) {
                    // After 3 failures, go back to listening so user isn't stuck
                    console.error("AI turn failed 3 times, resuming listening");
                    if (!isEndingRef.current) await startListening();
                } else {
                    // Wait 1s before retry
                    await new Promise((r) => setTimeout(r, 1000));
                }
            }
        }
    }, [interviewId, speak, startListening]);

    const submitUserResponse = useCallback(async () => {
        // FIX 2: Guard against double submission
        if (isEndingRef.current || isProcessingRef.current) return;
        isProcessingRef.current = true;

        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        if (keepAliveRef.current) clearInterval(keepAliveRef.current);

        recorderRef.current?.stop();
        dgSocketRef.current?.close();

        const transcript = pendingTranscriptRef.current.trim();
        pendingTranscriptRef.current = "";
        setUserLevel(0);
        setStatus("processing");

        try {
            if (transcript) {
                await axios.post(`${BACKEND_URL}/api/v1/session/user/response/${interviewId}`, {
                    message: transcript,
                });
            }
        } catch (err) {
            console.error("Failed to save user response:", err);
            // Continue anyway — don't block the interview
        }

        if (!isEndingRef.current) {
            await doAiTurn();
        }
    }, [interviewId, doAiTurn]);

    useEffect(() => {
        submitUserResponseRef.current = submitUserResponse;
    }, [submitUserResponse]);

    useEffect(() => {
        let cancelled = false;

        (async () => {
            if (window.speechSynthesis.getVoices().length === 0) {
                await new Promise<void>((r) => {
                    window.speechSynthesis.onvoiceschanged = () => r();
                    setTimeout(r, 1500);
                });
            }

            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }

            userStreamRef.current = stream;
            audioCtxRef.current = new AudioContext();
            userMeterRef.current = createLevelMeter(stream, audioCtxRef.current);
            startRaf();

            await doAiTurn();
        })();

        const onVisibilityChange = () => {
            if (document.hidden) window.speechSynthesis.pause();
            else window.speechSynthesis.resume();
        };
        document.addEventListener("visibilitychange", onVisibilityChange);

        return () => {
            cancelled = true;
            isEndingRef.current = true;
            cleanup();
            document.removeEventListener("visibilitychange", onVisibilityChange);
        };
    }, []);

    function cleanup() {
        if (rafRef.current) cancelAnimationFrame(rafRef.current);
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        if (keepAliveRef.current) clearInterval(keepAliveRef.current);
        window.speechSynthesis.cancel();
        recorderRef.current?.stop();
        dgSocketRef.current?.close();
        userStreamRef.current?.getTracks().forEach((t) => t.stop());
        audioCtxRef.current?.close().catch(() => {});
    }

    function endInterview() {
        isEndingRef.current = true;
        setStatus("ending");
        cleanup();
        navigate(`/result/${interviewId}`);
    }

    const aiSpeaking = status === "ai-speaking";
    const userSpeaking = status === "user-speaking";

    const statusLabel = {
        connecting: "connecting...",
        "ai-speaking": "interviewer speaking",
        "user-speaking": "your turn",
        processing: "processing...",
        ending: "wrapping up...",
    }[status];

    return (
        <main className="flex h-screen w-screen flex-col overflow-hidden">
            <header className="flex items-center justify-between border-b border-white/5 px-6 py-4">
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                        <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                        <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
                        <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
                    </div>
                    <div className="h-4 w-px bg-white/10" />
                    <div className="flex items-center gap-2 font-mono text-sm">
                        {status !== "connecting" && status !== "ending" && (
                            <span className="relative flex size-2">
                                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#22d3ee] opacity-75" />
                                <span className="relative inline-flex size-2 rounded-full bg-[#22d3ee]" />
                            </span>
                        )}
                        {(status === "connecting" || status === "processing") && (
                            <Loader2 className="size-3 animate-spin text-amber-400" />
                        )}
                        <span className="text-white/50">{statusLabel}</span>
                    </div>
                </div>
            </header>

            <div className="flex flex-1 items-center justify-center px-6">
                {status === "connecting" ? (
                    <div className="flex flex-col items-center gap-4">
                        <div className="relative">
                            <Loader2 className="size-8 animate-spin text-[#22d3ee]" />
                        </div>
                        <p className="font-mono text-sm text-white/60 cursor-blink">
                            Initializing interview session
                        </p>
                        <p className="font-mono text-xs text-white/25">
                            Requesting microphone access...
                        </p>
                    </div>
                ) : (
                    <div className="flex w-full max-w-3xl items-center justify-center gap-16 sm:gap-28">
                        <VoiceOrb
                            level={aiLevel}
                            speaking={aiSpeaking}
                            label="Interviewer"
                            sublabel={aiSpeaking ? "speaking..." : "waiting"}
                            icon={Bot}
                            accent="cyan"
                        />
                        <div className="flex flex-col items-center gap-2">
                            <div className="h-px w-12 bg-white/10" />
                            <span className="font-mono text-xs text-white/20">vs</span>
                            <div className="h-px w-12 bg-white/10" />
                        </div>
                        <VoiceOrb
                            level={userLevel}
                            speaking={userSpeaking}
                            label="You"
                            sublabel={userSpeaking ? "speaking..." : "mic on"}
                            icon={User}
                            accent="indigo"
                        />
                    </div>
                )}
            </div>

            <footer className="flex flex-col items-center gap-3 px-6 py-8">
                <Button
                    variant="destructive"
                    size="lg"
                    onClick={endInterview}
                    disabled={status === "ending"}
                    className="gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-8 text-red-400 hover:bg-red-500/20 hover:text-red-300 transition-all"
                >
                    {status === "ending" ? (
                        <Loader2 className="size-4 animate-spin" />
                    ) : (
                        <PhoneOff className="size-4" />
                    )}
                    End interview
                </Button>
                <p className="font-mono text-xs text-white/20">
                    press to finish and generate your results
                </p>
            </footer>
        </main>
    );
}