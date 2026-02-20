import React, { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { Lock, FileText, CheckCircle2, ShieldCheck, ClipboardCheck } from 'lucide-react';

export const FeaturesDashboard = () => {
    const cRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let ctx = gsap.context(() => {
            // Add any specific animations if needed
        }, cRef);
        return () => ctx.revert();
    }, []);

    return (
        <section id="features" ref={cRef} className="pt-32 pb-16 px-6 bg-cream text-charcoal relative">
            <div className="max-w-7xl mx-auto">
                <div className="text-center mb-20">
                    <h2 className="font-sans text-4xl md:text-5xl font-semibold mb-6 text-moss tracking-tight">
                        Complete Feature Set
                    </h2>
                    <p className="text-lg text-charcoal/70 leading-relaxed font-sans max-w-3xl mx-auto">
                        Clinician-first: focused on <span className="font-medium text-moss">reducing chart review time</span> and missed deterioration
                    </p>
                </div>

                <div className="flex flex-col lg:flex-row gap-16 mb-24">
                    {/* LEFT COLUMN: Feature Groups */}
                    <div className="flex-1 flex flex-col gap-12">
                        {/* Group 1 */}
                        <div>
                            <h3 className="font-sans font-bold text-2xl text-moss mb-6 flex items-center gap-3">
                                <span className="w-8 h-8 rounded-full bg-moss/10 flex items-center justify-center text-moss font-mono text-sm">1</span>
                                Clinician-Facing
                            </h3>
                            <ul className="space-y-4">
                                <li className="flex items-start gap-4">
                                    <div className="w-2 h-2 rounded-full bg-clay mt-2 shrink-0" />
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3">
                                            <span className="font-sans font-medium text-moss text-lg">Explainable risk flags & CKD staging</span>
                                            <span className="text-[10px] font-mono tracking-widest uppercase bg-clay/10 text-clay px-2 py-1 rounded-sm">MVP</span>
                                        </div>
                                    </div>
                                </li>
                                <li className="flex items-start gap-4">
                                    <div className="w-2 h-2 rounded-full bg-clay mt-2 shrink-0" />
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3">
                                            <span className="font-sans font-medium text-moss text-lg">Document timeline & one-click source excerpts</span>
                                            <span className="text-[10px] font-mono tracking-widest uppercase bg-clay/10 text-clay px-2 py-1 rounded-sm">MVP</span>
                                        </div>
                                    </div>
                                </li>
                                <li className="flex items-start gap-4">
                                    <div className="w-2 h-2 rounded-full bg-clay mt-2 shrink-0" />
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3">
                                            <span className="font-sans font-medium text-moss text-lg">Follow-up & pending lab tracker</span>
                                            <span className="text-[10px] font-mono tracking-widest uppercase bg-clay/10 text-clay px-2 py-1 rounded-sm">MVP</span>
                                        </div>
                                    </div>
                                </li>
                            </ul>
                        </div>

                        {/* Group 2 */}
                        <div className="pt-8 border-t border-moss/10">
                            <h3 className="font-sans font-bold text-2xl text-moss mb-6 flex items-center gap-3">
                                <span className="w-8 h-8 rounded-full bg-moss/10 flex items-center justify-center text-moss font-mono text-sm">2</span>
                                Coordinator / Ops
                            </h3>
                            <ul className="space-y-4">
                                <li className="flex items-start gap-4">
                                    <div className="w-2 h-2 rounded-full bg-moss/40 mt-2 shrink-0" />
                                    <span className="font-sans font-medium text-moss text-lg">Task orchestration & visit preparation checklist</span>
                                </li>
                                <li className="flex items-start gap-4">
                                    <div className="w-2 h-2 rounded-full bg-moss/40 mt-2 shrink-0" />
                                    <span className="font-sans font-medium text-moss text-lg">Audit trail & documentation export</span>
                                </li>
                            </ul>
                        </div>

                        {/* Group 3 */}
                        <div className="pt-8 border-t border-moss/10">
                            <h3 className="font-sans font-bold text-2xl text-moss mb-6 flex items-center gap-3">
                                <span className="w-8 h-8 rounded-full bg-moss/10 flex items-center justify-center text-moss font-mono text-sm">3</span>
                                Patient (Supporting)
                            </h3>
                            <ul className="space-y-4">
                                <li className="flex items-start gap-4">
                                    <div className="w-2 h-2 rounded-full bg-charcoal/30 mt-2 shrink-0" />
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3">
                                            <span className="font-sans font-medium text-moss text-lg">Daily vitals logging & adherence reminders</span>
                                            <span className="text-[10px] font-mono tracking-widest uppercase bg-clay/10 text-clay px-2 py-1 rounded-sm">MVP</span>
                                        </div>
                                    </div>
                                </li>
                                <li className="flex items-start gap-4">
                                    <div className="w-2 h-2 rounded-full bg-charcoal/30 mt-2 shrink-0" />
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3">
                                            <span className="font-sans font-medium text-moss text-lg">Device kit integration</span>
                                            <span className="text-[10px] font-mono tracking-widest uppercase bg-charcoal/10 text-charcoal/60 px-2 py-1 rounded-sm">Phase 2</span>
                                        </div>
                                    </div>
                                </li>
                            </ul>
                        </div>
                    </div>

                    {/* RIGHT COLUMN: Embedded Live Widget Mockup */}
                    <div className="flex-1 flex justify-center items-center">
                        <div className="w-full max-w-lg bg-white border border-moss/5 rounded-[2.5rem] p-8 shadow-2xl relative hover:-translate-y-2 transition-transform duration-500">
                            {/* Decorative Top Bar */}
                            <div className="flex items-center justify-between mb-8 pb-4 border-b border-moss/10">
                                <div className="flex items-center gap-2">
                                    <span className="relative flex h-3 w-3">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-clay opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-3 w-3 bg-clay"></span>
                                    </span>
                                    <span className="text-xs font-mono uppercase tracking-widest text-moss/50">CKD Snapshot Live</span>
                                </div>
                                <span className="text-xs font-mono uppercase text-moss/30">Patient ID: 8991</span>
                            </div>

                            {/* eGFR Trend line chart */}
                            <div className="mb-8 relative">
                                <div className="flex justify-between items-end mb-4">
                                    <h4 className="font-sans font-bold text-moss">eGFR Trend (6 Months)</h4>
                                </div>
                                <div className="h-48 w-full relative flex">
                                    {/* Y-axis */}
                                    <div className="flex flex-col justify-between font-mono text-[10px] text-moss/40 py-2 pr-4 border-r border-moss/10 h-full">
                                        <span>90</span>
                                        <span>60</span>
                                        <span>30</span>
                                    </div>
                                    {/* Chart area */}
                                    <div className="flex-1 relative h-full">
                                        {/* Declining line */}
                                        <svg className="absolute inset-0 w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 100 100">
                                            <polyline points="0,13.75 20,31.25 40,47.5 60,60 80,90" fill="none" stroke="#CC5833" strokeWidth="3" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                        <div className="absolute w-2.5 h-2.5 rounded-full bg-clay" style={{ left: '80%', top: '90%', transform: 'translate(-50%, -50%)' }} />
                                        {/* X-axis */}
                                        <div className="absolute inset-x-0 -bottom-6 flex justify-between font-mono text-[10px] text-moss/40 uppercase">
                                            <span>Jul</span>
                                            <span>Aug</span>
                                            <span>Sep</span>
                                            <span>Oct</span>
                                            <span>Nov</span>
                                            <span>Dec</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Alert Cards */}
                            <div className="flex flex-col gap-3 mt-12 pb-2">
                                {/* Critical Alert */}
                                <div className="flex items-center gap-4 bg-red-50 border border-red-100 p-4 rounded-2xl">
                                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
                                    <div className="flex-1">
                                        <p className="font-sans font-bold text-red-900 text-sm">Critical Alert</p>
                                        <p className="font-sans text-xs text-red-800/70">eGFR dropped to 28</p>
                                    </div>
                                </div>

                                {/* Weight Alert */}
                                <div className="flex items-center gap-4 bg-yellow-50 border border-yellow-100 p-4 rounded-2xl">
                                    <div className="w-2 h-2 rounded-full bg-yellow-500 shrink-0" />
                                    <div className="flex-1">
                                        <p className="font-sans font-bold text-yellow-900 text-sm">Weight Alert</p>
                                        <p className="font-sans text-xs text-yellow-800/70">+2.5kg in 3 days</p>
                                    </div>
                                </div>

                                {/* Compliance */}
                                <div className="flex items-center gap-4 bg-green-50 border border-green-100 p-4 rounded-2xl">
                                    <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                                    <div className="flex-1">
                                        <p className="font-sans font-bold text-green-900 text-sm">Compliance</p>
                                        <p className="font-sans text-xs text-green-800/70">Good</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* BOTTOM ROW (3 pills) */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-12 border-t border-moss/10">
                    <div className="flex items-center justify-center gap-3 bg-white/40 border border-moss/10 py-5 px-6 rounded-full shadow-sm hover:-translate-y-2 transition-transform duration-300">
                        <Lock size={18} className="text-clay" />
                        <span className="font-sans font-medium text-moss text-sm">End-to-end encryption</span>
                    </div>
                    <div className="flex items-center justify-center gap-3 bg-white/40 border border-moss/10 py-5 px-6 rounded-full shadow-sm hover:-translate-y-2 transition-transform duration-300">
                        <FileText size={18} className="text-clay" />
                        <span className="font-sans font-medium text-moss text-sm">Complete audit trails</span>
                    </div>
                    <div className="flex items-center justify-center gap-3 bg-white/40 border border-moss/10 py-5 px-6 rounded-full shadow-sm hover:-translate-y-2 transition-transform duration-300">
                        <CheckCircle2 size={18} className="text-clay" />
                        <span className="font-sans font-medium text-moss text-sm">Patient consent management</span>
                    </div>
                </div>
            </div>
        </section>
    );
};
