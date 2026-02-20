import React, { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { ArrowRight, Activity, ShieldAlert, BadgeInfo } from 'lucide-react';

export const Hero = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const bgRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let ctx = gsap.context(() => {
            // Background parallax
            gsap.to(bgRef.current, {
                y: '20%',
                ease: 'none',
                scrollTrigger: {
                    trigger: containerRef.current,
                    start: 'top top',
                    end: 'bottom top',
                    scrub: true,
                }
            });

            // Staggered text reveal
            gsap.from('.hero-reveal', {
                y: 40,
                opacity: 0,
                duration: 1.2,
                stagger: 0.15,
                ease: 'power3.out',
                delay: 0.2
            });

            // Skew settle for cinematic frame
            gsap.from('.hero-cinematic-frame', {
                rotateX: 10,
                y: 60,
                opacity: 0,
                duration: 1.5,
                ease: 'power3.out',
                delay: 0.8
            });

        }, containerRef);

        return () => ctx.revert();
    }, []);

    return (
        <section ref={containerRef} className="relative min-h-[100dvh] w-full overflow-hidden bg-black flex flex-col justify-center pt-32 pb-24 md:pb-32">
            {/* Parallax Background */}
            <div
                ref={bgRef}
                className="absolute -top-[10%] left-0 w-full h-[120%] bg-cover bg-center opacity-60 object-cover"
                style={{ backgroundImage: 'url(/gpt-image-1.5-high-fidelity_a_make_this_image_Phot.png)', willChange: 'transform' }}
            />

            {/* Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none" />

            {/* Content Container */}
            <div className="relative z-10 w-full max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center justify-between gap-12 pt-16">
                <div className="flex-1 flex flex-col gap-6 max-w-3xl">
                    <h1 className="hero-reveal font-sans text-5xl md:text-6xl lg:text-7xl leading-[1.05] tracking-tight font-light text-cream" style={{ willChange: 'transform, opacity' }}>
                        Turn CKD follow-up chaos into a <span className="font-drama italic text-clay font-medium block">single clinical snapshot</span>
                    </h1>

                    <p className="hero-reveal text-lg md:text-xl text-cream/70 font-sans leading-relaxed max-w-2xl" style={{ willChange: 'transform, opacity' }}>
                        BeanHealth compresses fragmented patient data — labs, discharge summaries, vitals, medications — into a clinician-ready decision snapshot for faster, safer CKD care.
                    </p>

                    <div className="hero-reveal flex flex-wrap items-center gap-3" style={{ willChange: 'transform, opacity' }}>
                        <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-full px-4 py-2 text-sm text-cream font-mono tracking-wide">
                            <Activity size={16} className="text-clay" />
                            <span>Reduce clinical overload</span>
                        </div>
                        <div className="flex items-center gap-2 bg-white/10 backdrop-blur-md border border-white/20 rounded-full px-4 py-2 text-sm text-cream font-mono tracking-wide">
                            <ShieldAlert size={16} className="text-clay" />
                            <span>Rapid risk flags</span>
                        </div>
                    </div>

                    <div className="hero-reveal mt-2 flex items-start gap-3 bg-moss/20 border border-moss/50 backdrop-blur-md p-4 rounded-3xl max-w-xl" style={{ willChange: 'transform, opacity' }}>
                        <BadgeInfo className="text-cream/50 !w-5 !h-5 shrink-0 mt-0.5" />
                        <p className="text-xs text-cream/70 font-mono tracking-wider leading-relaxed">
                            <em className="text-cream text-[11px] uppercase tracking-widest block mb-1">Disclaimer</em>
                            BeanHealth is a decision-support snapshot. It does not replace the medical record or clinical judgement. Always review source documents.
                        </p>
                    </div>

                    <div className="hero-reveal mt-6" style={{ willChange: 'transform, opacity' }}>
                        <div className="flex flex-wrap items-center gap-4">
                            <a href="#demo-section" className="group relative overflow-hidden bg-[#22B3A6] text-white px-8 py-4 rounded-full font-sans font-semibold text-sm uppercase tracking-wider transition-transform hover:scale-105 active:scale-95 duration-300 shadow-xl shadow-teal-500/20">
                                <span className="relative z-10 flex items-center gap-2">
                                    Schedule Clinical Demo
                                    <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                                </span>
                            </a>
                            <a href="#solution" className="text-white border border-white/30 hover:bg-white hover:text-charcoal px-8 py-4 rounded-full font-sans font-medium text-sm transition-all duration-300 active:scale-95 uppercase tracking-widest backdrop-blur-sm">
                                See How It Works
                            </a>
                        </div>
                    </div>
                </div>

                {/* Cinematic UI Frame mock */}
                <div className="hero-cinematic-frame hidden md:block w-[400px] bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[2.5rem] p-6 shadow-2xl relative overflow-hidden border-t-white/20 flex-shrink-0 hover:-translate-y-2 transition-transform duration-500" style={{ perspective: 1200, willChange: 'transform, opacity' }}>
                    <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-moss/20 to-transparent opacity-50 pointer-events-none" />

                    <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-6">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-clay animate-pulse" />
                            <span className="text-xs font-mono text-white/90 uppercase tracking-widest">CKD Patient Monitoring</span>
                        </div>
                        <span className="text-xs font-mono text-white/50">BH-SND-01</span>
                    </div>

                    <div className="space-y-4 relative z-10">
                        {/* Cinematic Data Rows */}
                        <div className="flex justify-between items-center p-4 rounded-2xl bg-black/40 border border-white/5">
                            <span className="text-sm text-cream/80">eGFR Trend</span>
                            <span className="text-lg font-mono text-white">42 <span className="text-clay text-sm mx-1">→</span> 38</span>
                        </div>
                        <div className="flex justify-between items-center p-4 rounded-2xl bg-black/40 border border-white/5">
                            <span className="text-sm text-cream/80">Fluid Overload</span>
                            <span className="text-xs font-sans font-bold uppercase tracking-widest px-3 py-1.5 bg-clay/20 text-clay rounded-full border border-clay/30">High Risk</span>
                        </div>
                        <div className="w-full h-32 mt-6 relative rounded-xl overflow-hidden bg-black/40 border border-white/5 p-4 flex flex-col justify-end">
                            {/* Decorative graph line */}
                            <span className="text-[10px] font-mono text-white/30 uppercase absolute top-3 left-3 tracking-widest">Deterioration Path</span>
                            <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full preserve-3d" preserveAspectRatio="none">
                                <path d="M0,80 Q25,80 50,55 T100,20" fill="none" stroke="#CC5833" strokeWidth="2" strokeDasharray="3,3" />
                                <circle cx="25" cy="80" r="2" fill="#CC5833" />
                                <circle cx="50" cy="55" r="2" fill="#CC5833" />
                                <circle cx="100" cy="20" r="2" fill="#CC5833" />
                            </svg>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};
