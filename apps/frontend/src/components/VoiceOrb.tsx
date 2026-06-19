import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface VoiceOrbProps {
    /** Normalized volume level, 0..1 */
    level: number;
    /** Whether this participant is the active/loud speaker right now */
    speaking: boolean;
    label: string;
    sublabel: string;
    icon: LucideIcon;
    /** color family: "cyan" for AI, "indigo" for user */
    accent: "cyan" | "indigo";
}

const ACCENTS = {
    cyan: {
        core: "from-[#22d3ee] to-[#0891b2]",
        glow: "34, 211, 238",
        ring: "border-[#22d3ee]/30",
        text: "text-[#22d3ee]",
        bars: "bg-[#22d3ee]",
        label: "text-[#22d3ee]",
    },
    indigo: {
        core: "from-[#818cf8] to-[#4f46e5]",
        glow: "129, 140, 248",
        ring: "border-[#818cf8]/30",
        text: "text-[#818cf8]",
        bars: "bg-[#818cf8]",
        label: "text-[#818cf8]",
    },
} as const;

export function VoiceOrb({ level, speaking, label, sublabel, icon: Icon, accent }: VoiceOrbProps) {
    const a = ACCENTS[accent];
    const clamped = Math.min(1, Math.max(0, level));
    const scale = 1 + clamped * 0.35;
    const glowSize = 20 + clamped * 80;
    const glowOpacity = 0.3 + clamped * 0.55;

    return (
        <div className="flex flex-col items-center gap-6">
            <div className="relative grid h-52 w-52 place-items-center">
                {/* Outermost reactive ring */}
                <div
                    className={cn("absolute inset-0 rounded-full border transition-all duration-150", a.ring)}
                    style={{
                        transform: `scale(${1 + clamped * 0.3})`,
                        opacity: 0.2 + clamped * 0.5,
                    }}
                />
                {/* Mid ring */}
                <div
                    className={cn("absolute h-40 w-40 rounded-full border", a.ring)}
                    style={{
                        transform: `scale(${1 + clamped * 0.18})`,
                        opacity: 0.3 + clamped * 0.4,
                    }}
                />
                {/* Core orb */}
                <div
                    className={cn(
                        "relative grid h-28 w-28 place-items-center rounded-full bg-gradient-to-br text-white transition-transform duration-100",
                        a.core,
                    )}
                    style={{
                        transform: `scale(${scale})`,
                        boxShadow: `0 0 ${glowSize}px rgba(${a.glow}, ${glowOpacity}), 0 0 ${glowSize * 2}px rgba(${a.glow}, ${glowOpacity * 0.4})`,
                    }}
                >
                    <Icon className="size-10" strokeWidth={1.5} />
                </div>
            </div>

            {/* Equalizer bars */}
            <div className="flex h-6 items-end gap-1">
                {[0.5, 0.75, 1, 0.8, 0.55, 0.7, 0.45].map((weight, i) => (
                    <span
                        key={i}
                        className={cn("w-1 rounded-full transition-all duration-75", a.bars)}
                        style={{
                            height: `${Math.max(3, clamped * weight * 24)}px`,
                            opacity: speaking ? 0.9 : 0.2,
                        }}
                    />
                ))}
            </div>

            <div className="text-center">
                <p
                    className={cn(
                        "font-mono text-sm font-semibold tracking-wide transition-colors duration-200",
                        speaking ? a.label : "text-white/70",
                    )}
                >
                    {label}
                </p>
                <p className="mt-0.5 font-mono text-xs text-white/30">
                    {speaking ? "speaking..." : sublabel}
                </p>
            </div>
        </div>
    );
}
