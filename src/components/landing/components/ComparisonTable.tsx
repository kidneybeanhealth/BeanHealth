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

                <div className="w-full">
                    <div className="bg-white rounded-[1.5rem] md:rounded-[2rem] border border-moss/10 shadow-sm overflow-hidden flex flex-col">
                        {/* Header */}
                        <div className="grid grid-cols-10 md:grid-cols-12 bg-[#F6F4EE] border-b border-moss/10 items-stretch">
                            <div className="col-span-4 md:col-span-7 px-4 md:px-10 py-5 md:py-8 flex items-center font-sans text-[11px] md:text-[15px] font-bold text-charcoal">
                                Capability
                            </div>
                            <div className="col-span-3 md:col-span-2 px-1 md:px-2 py-5 md:py-8 flex items-center justify-center text-center font-sans text-[9px] md:text-[13px] font-bold text-charcoal leading-tight">
                                Traditional<br className="block md:hidden" /> EMR
                            </div>
                            <div className="col-span-3 md:col-span-3 bg-[#36453F] rounded-bl-[1.2rem] md:rounded-bl-3xl flex items-center justify-center px-2 md:px-3 py-5 md:py-8 shadow-sm">
                                <span className="font-sans text-[10px] md:text-sm font-semibold text-white tracking-wide">BeanHealth</span>
                            </div>
                        </div>

                        {/* Body */}
                        <div className="flex flex-col px-4 md:px-10 pt-1 pb-1">
                            {features.map((item, idx) => (
                                <div key={idx} className="comp-row grid grid-cols-10 md:grid-cols-12 py-3.5 md:py-5 border-b border-moss/10 last:border-0 hover:bg-black/[0.015] transition-colors duration-300">
                                    <div className="col-span-4 md:col-span-7 flex items-center font-sans text-[10.5px] md:text-[14px] text-charcoal/70 pr-2 md:pr-4 leading-tight">
                                        {item.cap}
                                    </div>
                                    <div className="col-span-3 md:col-span-2 flex items-center justify-center">
                                        {item.telemed ? (
                                            <div className="w-5 h-5 md:w-6 md:h-6 rounded-full bg-green-50 flex items-center justify-center">
                                                <Check className="text-green-500 w-3 h-3 md:w-4 md:h-4" strokeWidth={3} />
                                            </div>
                                        ) : (
                                            <X className="text-red-400 w-3.5 h-3.5 md:w-5 md:h-5 opacity-75" strokeWidth={2} />
                                        )}
                                    </div>
                                    <div className="col-span-3 md:col-span-3 flex items-center justify-center">
                                        {item.bean ? (
                                            <div className="w-5 h-5 md:w-8 md:h-8 rounded-full bg-[#8AC43C]/10 flex items-center justify-center">
                                                <Check className="text-[#8AC43C] w-3.5 h-3.5 md:w-5 md:h-5" strokeWidth={3} />
                                            </div>
                                        ) : (
                                            <X className="text-red-400 w-3.5 h-3.5 md:w-5 md:h-5 opacity-75" strokeWidth={2} />
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};
