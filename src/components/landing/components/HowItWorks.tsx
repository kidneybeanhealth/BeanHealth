import React, { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { workflowSteps } from '../mock';
import { CheckCircle2, ShieldCheck } from 'lucide-react';

export const HowItWorks = () => {
    const cRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let ctx = gsap.context(() => {
            const cards = gsap.utils.toArray('.sticky-card');

            cards.forEach((card: any, i) => {
                if (i < cards.length - 1) {
                    gsap.to(card, {
                        scale: 0.9,
                        opacity: 0.3,
                        filter: 'blur(10px)',
                        scrollTrigger: {
                            trigger: cards[i + 1] as HTMLElement,
                            start: 'top bottom',
                            end: 'top top',
                            scrub: true,
                        }
                    });
                }
            });
        }, cRef);
        return () => ctx.revert();
    }, []);

    // Group steps into 3 cards (2 steps each)
    const groupedSteps = [
        workflowSteps.slice(0, 2),
        workflowSteps.slice(2, 4),
        workflowSteps.slice(4, 6)
    ];

    return (
        <section ref={cRef} className="py-32 px-6 bg-moss text-cream relative min-h-[300vh]">


            <div className="max-w-4xl mx-auto relative z-10">
                <div className="text-center mb-32">
                    <h2 className="font-sans text-4xl md:text-5xl font-semibold mb-6">How BeanHealth Works</h2>
                    <p className="font-sans text-xl text-cream/70 mb-8 max-w-2xl mx-auto">
                        A closed-loop system: <span className="text-clay">AI Assists, Doctor Decides.</span>
                    </p>

                    <div className="flex justify-center gap-4 flex-wrap">
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

                {/* Sticky Stacking Archive */}
                {groupedSteps.map((group, groupIdx) => (
                    <div key={groupIdx} className="sticky-card sticky top-32 w-full min-h-[50vh] bg-cream text-charcoal rounded-[3rem] p-10 md:p-16 mb-24 shadow-2xl border border-moss/10">
                        <div className="flex items-center gap-4 mb-12 border-b border-moss/10 pb-6">
                            <span className="font-mono text-sm text-moss/50 uppercase tracking-widest">Phase 0{groupIdx + 1}</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                            {group.map((step, idx) => (
                                <div key={idx} className="flex flex-col gap-4">
                                    <div className="w-12 h-12 rounded-full border border-clay/30 flex items-center justify-center font-mono text-xl text-clay bg-clay/5">
                                        {step.id}
                                    </div>
                                    <h3 className="font-sans text-2xl font-semibold text-moss tracking-tight">{step.title}</h3>
                                    <p className="font-sans text-charcoal/70 leading-relaxed text-lg">{step.description}</p>
                                </div>
                            ))}
                        </div>
                    </div>
                ))}
            </div>
        </section>
    );
};
