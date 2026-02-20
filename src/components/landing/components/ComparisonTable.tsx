import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';

const features = [
    { cap: 'Data aggregation (labs + discharge + meds)', telemed: false, bean: true },
    { cap: 'Source provenance & excerpt', telemed: false, bean: true },
    { cap: 'Explainable decision snapshot', telemed: false, bean: true },
    { cap: 'Configurable clinical rules', telemed: false, bean: true },
    { cap: 'Audit trail for follow-up decisions', telemed: false, bean: true },
    { cap: 'Actionable next-step cues', telemed: false, bean: true },
    { cap: 'Patient video consult', telemed: true, bean: false }
];

export const ComparisonTable = () => {
    const tableRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let ctx = gsap.context(() => {
            gsap.from('.comp-row', {
                x: -20, opacity: 0,
                stagger: 0.1,
                duration: 0.8,
                ease: 'power2.out',
                scrollTrigger: { trigger: tableRef.current, start: 'top 80%' }
            });
        }, tableRef);
        return () => ctx.revert();
    }, []);

    return (
        <section className="py-32 px-6 bg-cream relative">
            <div className="max-w-6xl mx-auto" ref={tableRef}>
                <div className="mb-16">
                    <h2 className="font-sans text-3xl md:text-4xl font-semibold tracking-tight text-moss">
                        The Gap in Existing EMR & Telemedicine.
                    </h2>
                </div>

                <div className="w-full overflow-x-auto pb-8">
                    <div className="min-w-[700px] border-t border-moss/20">
                        {/* Header */}
                        <div className="grid grid-cols-12 py-4 border-b border-moss/30 sticky top-0 bg-cream/90 backdrop-blur z-10">
                            <div className="col-span-6 font-sans text-xs font-bold uppercase tracking-widest text-moss/50">Capability</div>
                            <div className="col-span-3 text-center font-sans text-xs font-bold uppercase tracking-widest text-moss/50">Traditional EMR/Telemedicine</div>
                            <div className="col-span-3 text-center font-sans text-xs font-bold uppercase tracking-widest text-clay">BeanHealth</div>
                        </div>

                        {/* Rows */}
                        {features.map((item, idx) => (
                            <div key={idx} className="comp-row grid grid-cols-12 py-6 border-b border-moss/10 hover:bg-white/40 transition-colors duration-300 group cursor-default">
                                <div className="col-span-6 flex items-center font-sans text-[1.05rem] text-moss group-hover:translate-x-2 transition-transform duration-300">{item.cap}</div>
                                <div className="col-span-3 flex items-center justify-center">
                                    <span className={`font-mono text-lg font-light ${item.telemed ? 'text-green-500' : 'text-red-500/60'}`}>
                                        {item.telemed ? '✓' : '✗'}
                                    </span>
                                </div>
                                <div className="col-span-3 flex items-center justify-center">
                                    <span className={`font-mono text-lg font-bold ${item.bean ? 'text-green-600 scale-110' : 'text-red-500/60'} transition-transform duration-300 group-hover:scale-125`}>
                                        {item.bean ? '✓' : '✗'}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
};
