import React, { useState, useEffect, useRef } from 'react';
import { Menu, X, Hospital } from 'lucide-react';
import { LogoIcon } from '../../icons/LogoIcon';

export const Navbar = () => {
    const [isScrolled, setIsScrolled] = useState(false);
    const [isMobileOpen, setIsMobileOpen] = useState(false);
    const navRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 50);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    const navLinks = [
        { name: 'Problem', href: '#problem' },
        { name: 'Solution', href: '#solution' },
        { name: 'Features', href: '#features' },
        { name: 'Pricing', href: '#pricing' },
        { name: 'Team', href: '#founder' },
        { name: 'Contact', href: '#demo-section' }
    ];

    return (
        <div className={`fixed top-6 left-0 right-0 z-50 transition-all duration-500 flex justify-center px-4 pointer-events-none`}>
            <nav ref={navRef} className={`w-full max-w-7xl rounded-full px-6 py-3 flex items-center justify-between transition-all duration-500 pointer-events-auto ${isScrolled
                ? 'bg-white/80 backdrop-blur-md text-charcoal border border-moss/10 shadow-lg'
                : 'bg-black/20 backdrop-blur-sm text-cream border border-white/10 shadow-lg'
                }`}>

                {/* Logo */}
                <a href="#" className="flex items-center gap-2.5 cursor-pointer active:scale-95 hover:scale-105 transition-all group/logo">
                    <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-full flex items-center justify-center flex-shrink-0 bg-white shadow-sm transition-all duration-300">
                        <LogoIcon className="w-8 h-8 sm:w-10 sm:h-10" />
                    </div>
                    <div className="flex flex-col justify-center min-w-0">
                        <h2 className="text-sm sm:text-lg md:text-xl font-bold leading-none tracking-tight">
                            <span className={isScrolled ? 'text-primary-500' : 'text-white'}>Bean</span>
                            <span className="text-secondary-500">Health</span>
                        </h2>
                    </div>
                </a>

                {/* Desktop Links */}
                <div className="hidden lg:flex items-center gap-8">
                    {navLinks.map((link) => (
                        <a
                            key={link.name}
                            href={link.href}
                            className={`flex items-center text-xs font-mono uppercase tracking-widest transition-all duration-300 active:scale-95 hover:scale-110 ${isScrolled ? 'text-charcoal/70 hover:text-clay' : 'text-cream/80 hover:text-clay'}`}
                        >
                            {link.name}
                        </a>
                    ))}
                </div>

                {/* Action Buttons */}
                <div className="hidden lg:flex items-center gap-4">
                    <div className={`flex items-center gap-2 px-4 py-2 rounded-full border text-xs font-mono tracking-widest transition-all cursor-pointer active:scale-95 hover:scale-105 ${isScrolled ? 'border-moss/20 bg-moss/5 text-moss' : 'border-white/20 bg-white/10 text-white'
                        }`}>
                        <Hospital size={14} />
                        <span>For Hospitals & Nephrologists</span>
                    </div>
                    <a href="/login" className={`font-sans font-bold px-5 py-2 rounded-full text-xs uppercase tracking-widest transition-all active:scale-95 hover:scale-105 text-white hover:text-white ${isScrolled ? 'bg-moss' : 'bg-white/20 backdrop-blur-sm shadow-sm'
                        }`}>
                        Login
                    </a>
                </div>

                {/* Mobile Toggle */}
                <button
                    className="lg:hidden p-2"
                    onClick={() => setIsMobileOpen(!isMobileOpen)}
                >
                    {isMobileOpen ? <X size={24} /> : <Menu size={24} />}
                </button>
            </nav>

            {/* Mobile Menu Dropdown */}
            {isMobileOpen && (
                <div className="absolute top-20 left-4 right-4 bg-white/95 backdrop-blur-xl border border-moss/10 shadow-2xl rounded-3xl p-6 pointer-events-auto flex flex-col gap-6 lg:hidden">
                    <div className="flex flex-col gap-4">
                        {navLinks.map((link) => (
                            <a
                                key={link.name}
                                href={link.href}
                                className="block text-sm font-mono uppercase tracking-widest text-charcoal/80 hover:text-clay transition-all duration-300 active:scale-95 hover:scale-105 active:text-clay"
                                onClick={() => setIsMobileOpen(false)}
                            >
                                {link.name}
                            </a>
                        ))}
                    </div>

                    <div className="flex flex-col gap-4 pt-4 border-t border-moss/10">
                        <div className="flex items-center gap-2 justify-center px-4 py-3 rounded-full border border-moss/20 bg-moss/5 text-xs font-mono tracking-widest text-moss cursor-pointer active:scale-95 hover:scale-105 transition-all">
                            <Hospital size={14} />
                            <span>For Hospitals & Nephrologists</span>
                        </div>
                        <a href="/login" className="w-full text-center bg-moss text-white hover:text-white font-sans font-bold px-5 py-3 rounded-full text-xs uppercase tracking-widest active:scale-95 hover:scale-105 transition-all">
                            Login
                        </a>
                    </div>
                </div>
            )}
        </div>
    );
};
