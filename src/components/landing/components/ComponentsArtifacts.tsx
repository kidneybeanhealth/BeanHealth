import React, { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { Search, Database, Clock, FileText } from 'lucide-react';
const auditLogsData = [
    { time: '20 Feb, 5:28 PM', action: 'Queue Viewed', patient: 'K. Raman' },
    { time: '20 Feb, 5:17 PM', action: 'Record Opened', patient: 'K. Raman' },
    { time: '20 Feb, 5:15 PM', action: 'Record Opened', patient: 'S. Iyer' },
    { time: '20 Feb, 5:15 PM', action: 'Queue Viewed', patient: 'S. Iyer' },
    { time: '20 Feb, 5:07 PM', action: 'Record Opened', patient: 'R. Mahesh' },
    { time: '20 Feb, 4:45 PM', action: 'Flag Resolved', patient: 'M. Patel' },
];

export const ComponentsArtifacts = () => {
    const cRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let ctx = gsap.context(() => {
            // Provenance Notification Animation
            gsap.fromTo('.provenance-notification',
                { opacity: 0, scale: 0.9, y: 12 },
                {
                    opacity: 1,
                    scale: 1,
                    y: 0,
                    duration: 0.5,
                    ease: "power3.out",
                    repeat: -1,
                    repeatDelay: 3.5,
                    yoyo: true,
                    yoyoEase: "power2.in",
                    delay: 0.2
                }
            );
            // Extraction Pipeline Animation
            gsap.to('.extract-token', {
                x: '120%', opacity: 1, duration: 1.2, stagger: 0.2, repeat: -1, ease: 'power2.inOut'
            });
            // Audit Log Scroll Animation
            gsap.to('.audit-list', {
                y: '-50%', duration: 6, ease: 'none', repeat: -1
            });
        }, cRef);
        return () => ctx.revert();
    }, []);

    return (
        <section id="solution" ref={cRef} className="py-32 px-6 bg-charcoal text-cream relative">
            <div className="max-w-7xl mx-auto">
                <div className="text-center max-w-3xl mx-auto mb-20">
                    <p className="font-sans text-sm font-bold uppercase tracking-[0.2em] text-clay mb-6">How we fix it</p>
                    <h2 className="font-sans text-4xl md:text-5xl font-light mb-8 text-white">
                        Core platform components
                    </h2>
                    <p className="text-lg font-sans text-cream/70 leading-relaxed">
                        BeanHealth converts unstructured records into explainable clinical snapshots with rule-based risk flags, source provenance, and actionable next steps — built specifically for CKD workflow.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                    {/* Artifact 1: Provenance Peek */}
                    <div className="group relative bg-white/5 border border-white/10 rounded-[2.5rem] p-8 overflow-hidden hover:bg-white/10 transition-all hover:-translate-y-2 duration-500" style={{ willChange: 'transform' }}>
                        <h3 className="font-sans text-xl font-semibold mb-4 flex items-center gap-3 text-cream">
                            <Search className="text-clay" size={20} />
                            Clinician Intelligence Console
                        </h3>
                        <p className="text-sm text-cream/60 leading-relaxed mb-8">
                            Single-screen CKD snapshot, actionable cues, and provenance excerpts
                        </p>

                        <div className="relative h-48 bg-black/40 rounded-2xl border border-white/5 p-4 overflow-hidden group-hover:border-clay/30 transition-colors">
                            <div className="w-full flex justify-between items-center mb-4 pb-2 border-b border-white/10 shrink-0">
                                <span className="text-xs font-mono text-cream/50">eGFR 38 (Stage 3b)</span>
                                <span className="text-[10px] bg-clay/20 text-clay px-2 py-1 rounded font-bold uppercase tracking-widest">Source</span>
                            </div>

                            {/* Background skeleton lines */}
                            <div className="w-3/4 h-3 bg-white/5 rounded mb-3"></div>
                            <div className="w-1/2 h-3 bg-white/5 rounded"></div>

                            {/* Animated Notification Style Provenance */}
                            <div className="provenance-notification absolute left-3 right-3 bottom-3 bg-moss border border-moss/80 rounded-xl p-4 shadow-2xl flex flex-col gap-2" style={{ willChange: 'transform, opacity' }}>
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-[10px] uppercase font-bold tracking-widest text-clay flex items-center gap-2">
                                        <span className="w-1.5 h-1.5 rounded-full bg-clay animate-pulse"></span>
                                        Provenance Peek
                                    </span>
                                    <span className="text-[9px] font-mono text-cream/40">Extracted 12:42 PM</span>
                                </div>
                                <p className="font-mono text-[11px] text-white leading-relaxed">
                                    [Pg 4] "Patient complains of swelling... GFR declined from 42 last month."
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Artifact 2: Extraction Pipeline */}
                    <div className="group relative bg-white/5 border border-white/10 rounded-[2.5rem] p-8 overflow-hidden hover:bg-white/10 transition-all hover:-translate-y-2 duration-500" style={{ willChange: 'transform' }}>
                        <h3 className="font-sans text-xl font-semibold mb-4 flex items-center gap-3 text-cream">
                            <Database className="text-clay" size={20} />
                            Extraction & Provenance Engine
                        </h3>
                        <p className="text-sm text-cream/60 leading-relaxed mb-8">
                            Converts discharge summaries/labs into structured facts with source text + page + timestamp
                        </p>

                        <div className="relative h-48 bg-black/40 rounded-2xl border border-white/5 p-4 flex flex-col justify-center overflow-hidden">
                            <div className="w-1/3 h-16 border border-white/20 rounded-lg absolute left-4 flex items-center justify-center bg-white/5">
                                <FileText size={20} className="text-cream/50" />
                            </div>
                            {/* Tokens */}
                            <div className="absolute left-1/4 top-[20%] w-12 h-6 rounded bg-clay/30 border border-clay flex items-center justify-center extract-token opacity-0" style={{ willChange: 'transform, opacity', animationDelay: '0s' }}>
                                <span className="text-[10px] font-mono text-clay">HbA1c</span>
                            </div>
                            <div className="absolute left-1/4 top-[35%] w-12 h-6 rounded bg-secondary-500/30 border border-secondary-500 flex items-center justify-center extract-token opacity-0" style={{ willChange: 'transform, opacity', animationDelay: '0.2s' }}>
                                <span className="text-[10px] font-mono text-secondary-500">eGFR</span>
                            </div>
                            <div className="absolute left-[30%] top-[50%] w-16 h-6 rounded bg-blue-500/30 border border-blue-500 flex items-center justify-center extract-token opacity-0" style={{ willChange: 'transform, opacity', animationDelay: '0.4s' }}>
                                <span className="text-[10px] font-mono text-blue-400">Creatinine</span>
                            </div>
                            <div className="absolute left-[20%] top-[65%] w-14 h-6 rounded bg-purple-500/30 border border-purple-500 flex items-center justify-center extract-token opacity-0" style={{ willChange: 'transform, opacity', animationDelay: '0.6s' }}>
                                <span className="text-[10px] font-mono text-purple-400">Fluid</span>
                            </div>
                            <div className="absolute left-[25%] top-[80%] w-10 h-6 rounded bg-yellow-500/30 border border-yellow-500 flex items-center justify-center extract-token opacity-0" style={{ willChange: 'transform, opacity', animationDelay: '0.8s' }}>
                                <span className="text-[10px] font-mono text-yellow-400">Salt</span>
                            </div>

                            <div className="w-1/3 h-full border border-white/20 rounded-lg absolute right-4 flex flex-col gap-2 p-2 bg-white/5">
                                <div className="w-full h-4 bg-white/10 rounded animate-pulse" />
                                <div className="w-3/4 h-4 bg-white/10 rounded animate-pulse delay-100" />
                                <div className="w-full h-4 bg-white/10 rounded animate-pulse delay-200" />
                            </div>
                        </div>
                    </div>

                    {/* Artifact 3: Audit Ledger */}
                    <div className="group relative bg-white/5 border border-white/10 rounded-[2.5rem] p-8 overflow-hidden hover:bg-white/10 transition-all hover:-translate-y-2 duration-500" style={{ willChange: 'transform' }}>
                        <h3 className="font-sans text-xl font-semibold mb-4 flex items-center gap-3 text-cream">
                            <Clock className="text-clay" size={20} />
                            Workflow Orchestration & Audit
                        </h3>
                        <p className="text-sm text-cream/60 leading-relaxed mb-8">
                            Follow-up tracking, pending labs, acknowledgement/resolve flows, full audit trail
                        </p>

                        <div className="relative h-48 bg-black/40 rounded-2xl border border-white/5 p-4 overflow-hidden group-hover:border-clay/30 transition-colors">
                            {/* Scrolling List */}
                            <div className="audit-list flex flex-col gap-3" style={{ willChange: 'transform' }}>
                                {[...auditLogsData, ...auditLogsData].map((log, i) => (
                                    <div key={i} className="flex gap-3 items-start border-b border-white/5 pb-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-clay mt-1.5 shrink-0" />
                                        <div>
                                            <div className="text-[10px] font-mono text-cream/50">{log.time} • Assistant</div>
                                            <div className="text-xs font-sans text-cream/80 ">
                                                <span className="text-white font-medium">{log.action}</span>
                                                <span className="mx-2 text-white/20">|</span>
                                                <span className="text-clay/90">{log.patient}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </section>
    );
};
