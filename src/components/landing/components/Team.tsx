import React, { useRef, useEffect } from 'react';
import gsap from 'gsap';
import { Mail, Linkedin } from 'lucide-react';

export const Team = () => {
    const tRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        let ctx = gsap.context(() => {
            gsap.from('.team-card', {
                y: 40, opacity: 0, stagger: 0.15, duration: 1, ease: 'power3.out',
                scrollTrigger: { trigger: tRef.current, start: 'top 80%' }
            });
        }, tRef);
        return () => ctx.revert();
    }, []);

    return (
        <section ref={tRef} id="founder" className="py-32 px-6 bg-charcoal text-cream">
            <div className="max-w-6xl mx-auto">
                <h2 className="font-sans text-4xl md:text-5xl font-semibold mb-16 tracking-tight text-white text-center">
                    The Founding Team
                </h2>

                {/* Founding Profile */}
                <div className="team-card bg-white/5 border border-white/10 p-8 md:p-12 rounded-[3.5rem] mb-8 flex flex-col md:flex-row gap-8 md:gap-12 items-center md:items-start group hover:bg-white/10 transition-colors duration-500">
                    <div className="w-56 h-56 md:w-64 md:h-64 shrink-0 rounded-full overflow-hidden border border-white/10 bg-cream">
                        <img src="/Harish.png" alt="Harish S" className="w-full h-full object-cover" />
                    </div>

                    <div className="flex-1 text-center md:text-left flex flex-col justify-center">
                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-6">
                            <div>
                                <h3 className="text-3xl font-sans font-bold text-white mb-2">Harish S</h3>
                                <span className="font-mono text-xs uppercase tracking-widest text-[#d87c54]">Founder & CEO</span>
                            </div>
                            <div className="flex items-center justify-center gap-3">
                                <a href="#" className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-[#d87c54] text-white transition-colors duration-300">
                                    <Mail size={16} />
                                </a>
                                <a href="#" className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-[#d87c54] text-white transition-colors duration-300">
                                    <Linkedin size={16} />
                                </a>
                            </div>
                        </div>

                        <p className="text-cream/70 leading-relaxed mb-6 font-sans text-base">
                            Dedicated to bridging the gap between rigorous biological logic and elegant software, Harish oversees the product vision and algorithmic integrations of BeanHealth.
                        </p>

                        <div className="flex flex-wrap gap-2 mb-0 justify-center md:justify-start">
                            {['Biosensor & Device Integration', 'Data Analytics Pipelines', 'Clinical Decision Layers', 'Scalable Infrastructure'].map((t, i) => (
                                <span key={i} className="text-[10px] font-mono border border-white/10 bg-white/5 px-3 py-1.5 rounded-full text-white/50">{t}</span>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Development Team */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="team-card bg-white/5 border border-white/10 p-8 rounded-[3rem] hover:bg-white/10 transition-colors duration-500 flex flex-col md:flex-row gap-6 items-center md:items-start text-center md:text-left">
                        <div className="w-32 h-32 md:w-36 md:h-36 shrink-0 rounded-full border border-white/10 bg-white/5 flex items-center justify-center overflow-hidden">
                            <img src="/jnani-profile.png" alt="Bonthu Jnani Venkata Ratna Kumar" className="w-full h-full object-cover" />
                        </div>
                        <div className="flex flex-col flex-1 pt-2">
                            <h4 className="text-xl font-sans font-bold text-white mb-2 leading-tight">Bonthu Jnani Venkata<br />Ratna Kumar</h4>
                            <p className="font-mono text-[10px] uppercase tracking-widest text-[#8AC43C] mb-4">Full Stack Developer</p>

                            <div className="flex flex-wrap gap-2 justify-center md:justify-start mb-6">
                                <span className="text-[10px] font-mono font-medium bg-white/5 border border-white/10 px-3 py-1.5 rounded text-white/60">React</span>
                                <span className="text-[10px] font-mono font-medium bg-white/5 border border-white/10 px-3 py-1.5 rounded text-white/60">Node.js</span>
                                <span className="text-[10px] font-mono font-medium bg-white/5 border border-white/10 px-3 py-1.5 rounded text-white/60">MongoDB</span>
                            </div>

                            <a href="#" className="mt-auto flex items-center justify-center md:justify-start gap-2 text-white/50 hover:text-white transition-colors duration-300 font-mono text-[11px] uppercase tracking-widest font-semibold">
                                <Linkedin size={14} /> Connect
                            </a>
                        </div>
                    </div>

                    <div className="team-card bg-white/5 border border-white/10 p-8 rounded-[3rem] hover:bg-white/10 transition-colors duration-500 flex flex-col md:flex-row gap-6 items-center md:items-start text-center md:text-left">
                        <div className="w-32 h-32 md:w-36 md:h-36 shrink-0 rounded-full border border-white/10 bg-white/5 flex items-center justify-center overflow-hidden">
                            <img src="/saran-profile.png" alt="Saran Kathiravan" className="w-full h-full object-cover" />
                        </div>
                        <div className="flex flex-col flex-1 pt-2">
                            <h4 className="text-xl font-sans font-bold text-white mb-2 leading-tight">Saran Kathiravan</h4>
                            <p className="font-mono text-[10px] uppercase tracking-widest text-[#8AC43C] mb-4">Mobile & IoT Developer</p>

                            <div className="flex flex-wrap gap-2 justify-center md:justify-start mb-6">
                                <span className="text-[10px] font-mono font-medium bg-white/5 border border-white/10 px-3 py-1.5 rounded text-white/60">Flutter</span>
                                <span className="text-[10px] font-mono font-medium bg-white/5 border border-white/10 px-3 py-1.5 rounded text-white/60">IoT</span>
                                <span className="text-[10px] font-mono font-medium bg-white/5 border border-white/10 px-3 py-1.5 rounded text-white/60">BLE</span>
                            </div>

                            <a href="#" className="mt-auto flex items-center justify-center md:justify-start gap-2 text-white/50 hover:text-white transition-colors duration-300 font-mono text-[11px] uppercase tracking-widest font-semibold">
                                <Linkedin size={14} /> Connect
                            </a>
                        </div>
                    </div>
                </div>
            </div>
        </section>
    );
};
