import React, { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { workflowSteps } from '../mock';
import { CheckCircle2, ShieldCheck, ArrowRight } from 'lucide-react';

gsap.registerPlugin(ScrollTrigger);

export const HowItWorks = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let ctx = gsap.context(() => {
            const track = scrollRef.current;
            if (!track) return;

            const updateScroll = () => {
                // Determine how far the track should translate horizontally based on its total width 
                // vs the window width, adding a slightly nicer padding offset at the end.
                return track.scrollWidth - window.innerWidth + 100;
            };

            gsap.to(track, {
                x: () => -updateScroll(),
                ease: "none",
                scrollTrigger: {
                    trigger: containerRef.current,
                    pin: true,
                    scrub: 1, // Smooth scrub effect
                    invalidateOnRefresh: true, // Recalculates on resize
                    end: () => "+=" + updateScroll(),
                }
            });
        }, containerRef);
        return () => ctx.revert();
    }, []);

    return (
        <section ref={containerRef} className="pt-24 pb-24 bg-moss-dark text-cream relative overflow-hidden min-h-screen flex flex-col justify-center">
            {/* Header Content */}
            <div className="px-6 md:px-16 mb-16 shrink-0 relative z-10">
                <h2 className="font-sans text-4xl md:text-5xl lg:text-6xl font-semibold mb-6 tracking-tight">
                    <span className="text-white">How </span>
                    <span className="text-[#D4B7A1]">Bean</span><span className="text-secondary-500">Health</span>
                    <span className="text-white"> Works</span>
                </h2>
                <p className="font-sans text-xl text-cream/70 mb-8 max-w-2xl">
                    A closed-loop system: <span className="text-clay">AI Assists, Doctor Decides.</span>
                </p>

                <div className="flex gap-4 flex-wrap">
                    <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full py-2 px-4 shadow-xl">
                        <ShieldCheck size={16} className="text-clay" />
                        <span className="text-xs font-mono uppercase tracking-widest text-cream/80">KDIGO Guidelines</span>
                    </div>
                    <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-full py-2 px-4 shadow-xl">
                        <CheckCircle2 size={16} className="text-clay" />
                        <span className="text-xs font-mono uppercase tracking-widest text-cream/80">Nephrologist Reviewed</span>
                    </div>
                </div>
            </div>

            {/* Horizontal Track */}
            <div className="pl-6 md:pl-16 relative">
                <div ref={scrollRef} className="flex gap-6 md:gap-10 w-max pr-16" style={{ willChange: 'transform' }}>
                    {workflowSteps.map((step, idx) => (
                        <div key={idx} className="w-[85vw] md:w-[45vw] lg:w-[30vw] shrink-0 bg-cream text-charcoal rounded-[2.5rem] p-10 shadow-2xl border border-moss/10 flex flex-col h-[400px] justify-between group hover:-translate-y-2 transition-transform duration-300">
                            <div>
                                <div className="flex items-center justify-between mb-8 border-b border-moss/10 pb-6">
                                    <span className="font-mono text-sm text-moss/50 uppercase tracking-widest">Phase 0{idx + 1}</span>
                                    <div className="w-12 h-12 rounded-full border border-clay/30 flex items-center justify-center font-mono text-xl text-clay bg-clay/5 group-hover:bg-clay group-hover:text-white transition-colors duration-300">
                                        {step.id}
                                    </div>
                                </div>
                                <h3 className="font-sans text-3xl font-semibold text-moss tracking-tight mb-4">{step.title}</h3>
                                <p className="font-sans text-charcoal/70 leading-relaxed text-lg">{step.description}</p>
                            </div>

                            {idx < workflowSteps.length - 1 && (
                                <div className="flex justify-end mt-auto">
                                    <div className="w-10 h-10 rounded-full bg-moss/5 flex items-center justify-center text-moss/50 group-hover:bg-moss/10 group-hover:text-moss transition-colors duration-300">
                                        <ArrowRight size={20} />
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};
