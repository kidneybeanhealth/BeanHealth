import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { Check, X } from 'lucide-react';

const features = [
    { cap: 'Data aggregation (labs + discharge + meds)', telemed: false, bean: true },
    { cap: 'Source provenance & excerpt', telemed: false, bean: true },
    { cap: 'Explainable decision snapshot', telemed: false, bean: true },
    { cap: 'Configurable clinical rules', telemed: false, bean: true },
    { cap: 'Audit trail for follow-up decisions', telemed: false, bean: true },
    { cap: 'Actionable next-step cues', telemed: false, bean: true },
    { cap: 'Patient video consult', telemed: true, bean: true }
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
        <section className="pt-0 pb-32 px-6 bg-cream relative">
            <div className="max-w-5xl mx-auto" ref={tableRef}>
                <div className="mb-12 text-center">
                    <h2 className="font-sans text-3xl md:text-4xl font-semibold tracking-tight text-moss">
                        The Gap in Existing EMR & Telemedicine
                    </h2>
                </div>

                <div className="w-full bg-white rounded-[2rem] border border-moss/10 shadow-sm overflow-hidden flex flex-col">
                    {/* Header */}
                    <div className="grid grid-cols-12 bg-[#F6F4EE] border-b border-moss/10 items-stretch">
                        <div className="col-span-6 px-6 md:px-10 py-6 md:py-8 flex items-center font-sans text-[15px] font-bold text-charcoal">
                            Capability
                        </div>
                        <div className="col-span-3 px-2 py-6 md:py-8 flex items-center justify-center text-center font-sans text-xs md:text-[13px] font-bold text-charcoal leading-tight">
                            Traditional EMR<br className="hidden md:block" /> / Telemedicine
                        </div>
                        <div className="col-span-3 bg-[#36453F] rounded-bl-3xl flex items-center justify-center px-4 py-6 md:py-8 shadow-sm">
                            <span className="font-sans text-xs md:text-sm font-semibold text-white tracking-wide">BeanHealth</span>
                        </div>
                    </div>

                    {/* Body */}
                    <div className="flex flex-col px-6 md:px-10 pt-4 pb-4">
                        {features.map((item, idx) => (
                            <div key={idx} className="comp-row grid grid-cols-12 py-5 border-b border-moss/10 last:border-0 hover:bg-black/[0.015] transition-colors duration-300">
                                <div className="col-span-6 flex items-center font-sans text-[13px] md:text-[14px] text-charcoal/70 pr-4">
                                    {item.cap}
                                </div>
                                <div className="col-span-3 flex items-center justify-center">
                                    {item.telemed ? (
                                        <Check className="text-green-500 w-5 h-5 transform scale-110" strokeWidth={2.5} />
                                    ) : (
                                        <X className="text-red-400 w-5 h-5 opacity-75" strokeWidth={2} />
                                    )}
                                </div>
                                <div className="col-span-3 flex items-center justify-center">
                                    {item.bean ? (
                                        <Check className="text-[#8AC43C] w-6 h-6 transform scale-110" strokeWidth={3} />
                                    ) : (
                                        <X className="text-red-400 w-5 h-5 opacity-75" strokeWidth={2} />
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
};
