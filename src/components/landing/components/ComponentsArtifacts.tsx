import React, { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { Search, Database, Clock, FileText } from 'lucide-react';

export const ComponentsArtifacts = () => {
    const cRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let ctx = gsap.context(() => {
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

                        <div className="relative h-48 bg-black/40 rounded-2xl border border-white/5 p-4 group-hover:border-clay/30 transition-colors">
                            <div className="w-full flex justify-between items-center mb-4 pb-2 border-b border-white/10">
                                <span className="text-xs font-mono text-cream/50">eGFR 38 (Stage 3b)</span>
                                <span className="text-xs bg-clay/20 text-clay px-2 py-1 rounded">Source</span>
                            </div>

                            {/* Hover Drawer */}
                            <div className="absolute left-4 right-4 bottom-4 top-16 bg-moss border border-moss/50 rounded-xl p-4 translate-y-full opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500 ease-out flex flex-col gap-2">
                                <span className="text-[10px] uppercase font-bold tracking-widest text-clay">Provenance Peek</span>
                                <p className="font-mono text-xs text-cream/80 whitespace-pre-line leading-relaxed">
                                    [Pg 4] "Patient complains of swelling... GFR declined from 42 last month."
                                </p>
                                <span className="text-[10px] font-mono text-cream/40 mt-auto">Extracted 12:42 PM</span>
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
                            <div className="absolute left-1/4 top-1/2 -translate-y-1/2 w-8 h-8 rounded bg-clay/30 border border-clay flex items-center justify-center extract-token opacity-0" style={{ willChange: 'transform, opacity' }}>
                                <span className="text-[10px] font-mono text-clay">HbA1c</span>
                            </div>
                            <div className="absolute left-1/4 top-[40%] w-8 h-8 rounded bg-moss/50 border border-moss flex items-center justify-center extract-token opacity-0 delay-75" style={{ willChange: 'transform, opacity' }}>
                                <span className="text-[10px] font-mono text-moss/20 text-cream">BP</span>
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
                                {[1, 2, 3, 4, 5, 6].map(i => (
                                    <div key={i} className="flex gap-3 items-start border-b border-white/5 pb-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-clay mt-1.5 shrink-0" />
                                        <div>
                                            <div className="text-xs font-mono text-cream/50">{`2026-02-${10 + i} 09:12`}</div>
                                            <div className="text-sm font-sans text-cream/80 ">Flag acknowledged</div>
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
