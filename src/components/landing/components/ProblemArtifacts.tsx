import React, { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { TrendingDown, FileText, AlertTriangle, User, Stethoscope, Building2 } from 'lucide-react';

export const ProblemArtifacts = () => {
    const sectionRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let ctx = gsap.context(() => {
            gsap.fromTo('.problem-title',
                { y: 30, autoAlpha: 0 },
                {
                    y: 0, autoAlpha: 1,
                    duration: 0.7,
                    ease: 'power4.out',
                    scrollTrigger: { trigger: '.problem-title', start: 'top 80%' }
                }
            );

            gsap.fromTo('.problem-artifact',
                { y: 40, autoAlpha: 0 },
                {
                    y: 0, autoAlpha: 1,
                    stagger: 0.1,
                    duration: 0.8,
                    ease: 'power4.out',
                    scrollTrigger: { trigger: '.problem-artifacts-container', start: 'top 75%' }
                }
            );

            gsap.fromTo('.who-suffers-card',
                { x: -20, autoAlpha: 0 },
                {
                    x: 0, autoAlpha: 1,
                    stagger: 0.1,
                    duration: 0.6,
                    ease: 'power4.out',
                    scrollTrigger: { trigger: '.who-suffers-container', start: 'top 80%' }
                }
            );
        }, sectionRef);
        return () => ctx.revert();
    }, []);

    return (
        <section id="problem" ref={sectionRef} className="py-32 px-6 bg-cream text-charcoal relative overflow-hidden">
            <div className="max-w-7xl mx-auto">
                <div className="text-center max-w-4xl mx-auto mb-20 problem-title">
                    <h2 className="font-sans text-4xl md:text-5xl lg:text-6xl font-semibold tracking-tight leading-[1.1] mb-8 text-moss">
                        Clinician workflow is broken — <br className="hidden md:block" />
                        <span className="font-drama italic font-normal text-clay">not clinical knowledge.</span>
                    </h2>
                    <p className="text-lg md:text-xl font-sans text-charcoal/70 leading-relaxed max-w-3xl mx-auto">
                        Labs, discharge summaries, and vitals scattered across systems cause missed deterioration and reactive emergency-driven care.
                    </p>
                </div>

                {/* Problem Cards */}
                <div className="problem-artifacts-container grid grid-cols-1 md:grid-cols-3 gap-6 mb-32">
                    {/* Card 1 */}
                    <div className="problem-artifact bg-white border border-moss/5 rounded-[2rem] p-8 shadow-sm hover:shadow-md transition-all hover:-translate-y-2 duration-300">
                        <div className="w-12 h-12 rounded-2xl bg-red-50 text-red-500 flex items-center justify-center mb-8">
                            <TrendingDown size={24} />
                        </div>
                        <h3 className="text-lg font-sans font-semibold text-charcoal mb-4 tracking-tight">Untracked deterioration between visits</h3>
                        <p className="font-sans text-charcoal/60 leading-relaxed text-sm">
                            Gradual kidney function loss is easily missed when patient visits are spaced out without interstitial data tracking.
                        </p>
                    </div>

                    {/* Card 2 */}
                    <div className="problem-artifact bg-white border border-moss/5 rounded-[2rem] p-8 shadow-sm hover:shadow-md transition-all hover:-translate-y-2 duration-300">
                        <div className="w-12 h-12 rounded-2xl bg-[#FFF6EB] text-[#E08D3A] flex items-center justify-center mb-8">
                            <FileText size={24} />
                        </div>
                        <h3 className="text-lg font-sans font-semibold text-charcoal mb-4 tracking-tight">Manual reconstruction of patient history</h3>
                        <p className="font-sans text-charcoal/60 leading-relaxed text-sm">
                            Clinicians painfully scour disjointed systems, collating labs and notes rather than making active decisions.
                        </p>
                    </div>

                    {/* Card 3 */}
                    <div className="problem-artifact bg-white border border-moss/5 rounded-[2rem] p-8 shadow-sm hover:shadow-md transition-all hover:-translate-y-2 duration-300">
                        <div className="w-12 h-12 rounded-2xl bg-[#FFF3F1] text-[#E76C53] flex items-center justify-center mb-8">
                            <AlertTriangle size={24} />
                        </div>
                        <h3 className="text-lg font-sans font-semibold text-charcoal mb-4 tracking-tight">Reactive emergency-driven care</h3>
                        <p className="font-sans text-charcoal/60 leading-relaxed text-sm">
                            Preventable hospitalizations occur simply from missed early-warning signs sitting unseen in the EMR.
                        </p>
                    </div>
                </div>

                {/* Who Suffers Block - Cinematic List */}
                <div className="who-suffers-container relative border-t border-moss/10 pt-20">
                    <p className="font-sans text-sm font-bold uppercase tracking-[0.2em] text-moss/50 mb-12 text-center">WHO SUFFERS?</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-0">
                        {/* Patient */}
                        <div className="who-suffers-card border-b md:border-b-0 md:border-r border-moss/10 p-8 flex flex-col gap-4">
                            <div className="flex items-center gap-4">
                                <User size={24} className="text-moss/40" />
                                <h4 className="text-xl font-sans font-semibold text-moss">Patient</h4>
                            </div>
                            <p className="font-sans text-charcoal/60 leading-relaxed">Delayed intervention, mounting anxiety, preventable deterioration.</p>
                        </div>

                        {/* Nephrologist */}
                        <div className="who-suffers-card border-b md:border-b-0 md:border-r border-moss/10 p-8 flex flex-col gap-4">
                            <div className="flex items-center gap-4">
                                <Stethoscope size={24} className="text-moss/40" />
                                <h4 className="text-xl font-sans font-semibold text-moss">Nephrologist</h4>
                            </div>
                            <p className="font-sans text-charcoal/60 leading-relaxed">Blind spots between visits, reactive care.</p>
                        </div>

                        {/* Hospital */}
                        <div className="who-suffers-card p-8 flex flex-col gap-4">
                            <div className="flex items-center gap-4">
                                <Building2 size={24} className="text-moss/40" />
                                <h4 className="text-xl font-sans font-semibold text-moss">Hospital</h4>
                            </div>
                            <p className="font-sans text-charcoal/60 leading-relaxed">ER overload, poor retention, revenue leakage.</p>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};
