import { useEffect, useMemo, useRef, useState } from "react";
import {
  motion,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import {
  Activity,
  ArrowRight,
  BadgeCheck,
  BrainCircuit,
  Building2,
  Check,
  ChevronRight,
  FileStack,
  FolderKanban,
  GitBranch,
  HeartPulse,
  Hourglass,
  Layers,
  Linkedin,
  Mail,
  Menu,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Tag,
  Users,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import CKDEngineSection from "./CKDEngineSection";
import {
  alertCards,
  comparisonRows,
  deploymentModes,
  differentiators,
  featureColumns,
  heroMetrics,
  heroPills,
  ongoingProjects,
  platformComponents,
  pricingPlans,
  problemCards,
  stakeholderImpact,
  teamMembers,
  valueItems,
  workflowSteps,
} from "@/data/beanhealthContent";
import "@/styles/beanhealth-landing.css";

const navLinks = [
  { label: "Projects", href: "#projects", Icon: FolderKanban },
  { label: "Platform", href: "#platform", Icon: Layers },
  { label: "Workflow", href: "#workflow", Icon: GitBranch },
  { label: "Pricing", href: "#pricing", Icon: Tag },
  { label: "Team", href: "#team", Icon: Users },
];

const loginHref = "/start";

const sectionReveal = {
  hidden: { opacity: 0, y: 28 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
  },
};

const iconMap = [HeartPulse, FileStack, Hourglass];

const inputClassName =
  "w-full rounded-[1.4rem] border border-slate-200/80 bg-white/80 px-5 py-4 text-sm text-slate-900 outline-none transition-[border-color,box-shadow,transform] duration-300 placeholder:text-slate-400 focus:border-[#8FC94F] focus:shadow-[0_0_0_4px_rgba(115,186,39,0.12)]";

interface FormState {
  name: string;
  email: string;
  interest: string;
}

interface SubmitState {
  type: "idle" | "success" | "error";
  message: string;
}

export default function BeanHealthLanding() {
  const reduceMotion = useReducedMotion();
  const heroRef = useRef<HTMLElement>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [billingCycle, setBillingCycle] = useState<"annual" | "monthly">("annual");
  const [formState, setFormState] = useState<FormState>({ name: "", email: "", interest: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitState, setSubmitState] = useState<SubmitState>({ type: "idle", message: "" });

  // Smooth scroll — native CSS only (Lenis not required)
  useEffect(() => {
    if (!reduceMotion) {
      document.documentElement.style.scrollBehavior = "smooth";
    }
    return () => { document.documentElement.style.scrollBehavior = ""; };
  }, [reduceMotion]);

  const { scrollYProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });

  const dashboardRotateX = useTransform(scrollYProgress, [0, 1], reduceMotion ? [0, 0] : [22, 0]);
  const dashboardRotateZ = useTransform(scrollYProgress, [0, 1], reduceMotion ? [0, 0] : [-7, 0]);
  const dashboardY = useTransform(scrollYProgress, [0, 1], reduceMotion ? [0, 0] : [70, -60]);
  const dashboardScale = useTransform(scrollYProgress, [0, 1], reduceMotion ? [1, 1] : [0.9, 1.02]);
  const floatingY = useTransform(scrollYProgress, [0, 1], reduceMotion ? [0, 0] : [0, -30]);
  const accentX = useTransform(scrollYProgress, [0, 1], reduceMotion ? [0, 0] : [0, 110]);
  const provenanceY = useTransform(scrollYProgress, [0, 1], reduceMotion ? [0, 0] : [0, -18]);

  const eGFRData = useMemo(
    () => [
      { month: "Jul", value: 92 },
      { month: "Aug", value: 80 },
      { month: "Sep", value: 66 },
      { month: "Oct", value: 59 },
      { month: "Nov", value: 44 },
      { month: "Dec", value: 28 },
    ],
    [],
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormState((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setSubmitState({ type: "idle", message: "" });

    try {
      // Try EmailJS if configured, otherwise show success
      const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID;
      const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID;
      const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY;

      if (serviceId && templateId && publicKey) {
        const emailjs = await import("@emailjs/browser");
        await emailjs.send(serviceId, templateId, {
          from_name: formState.name,
          from_email: formState.email,
          message: formState.interest,
        }, publicKey);
      }

      setSubmitState({
        type: "success",
        message: "Thank you! We'll be in touch within 24 hours to schedule your demo.",
      });
      setFormState({ name: "", email: "", interest: "" });
    } catch {
      setSubmitState({
        type: "error",
        message: "We couldn't send your request right now. Please email us directly at hello@beanhealth.in",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bh-landing page-shell">
      <div className="orb orb--one" />
      <div className="orb orb--two" />
      <div className="orb orb--three" />

      {/* ── Navbar ── */}
      <header className="sticky top-0 z-50 px-4 pt-4 sm:px-6 lg:px-8">
        <div className="glass-panel mx-auto flex max-w-7xl items-center justify-between rounded-full px-4 py-3 sm:px-6">
          <a href="#top" className="flex items-center gap-3">
            <img
              src="https://www.beanhealth.in/logo.png"
              alt="BeanHealth"
              className="h-11 w-auto"
            />
          </a>

          <nav className="hidden items-center gap-1 lg:flex">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="group flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium text-slate-600 transition-all duration-200 hover:bg-[#F0F9E6] hover:text-[#5FA01F]"
              >
                <link.Icon className="h-3.5 w-3.5 text-slate-400 transition-colors duration-200 group-hover:text-[#73BA27]" />
                {link.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <a
              href={loginHref}
              className="hidden rounded-full border border-slate-200 bg-white/90 px-5 py-3 text-sm font-semibold text-slate-800 shadow-[0_12px_28px_rgba(15,23,42,0.06)] transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-0.5 hover:border-[#C2E29A] hover:shadow-[0_18px_36px_rgba(15,23,42,0.08)] sm:inline-flex"
            >
              Login
            </a>
            <a
              href="#cta"
              className="hidden rounded-full bg-[#73BA27] px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_40px_rgba(92,160,31,0.22)] transition-[transform,box-shadow,background-color] duration-300 hover:-translate-y-0.5 hover:bg-[#5FA01F] hover:shadow-[0_24px_50px_rgba(92,160,31,0.28)] sm:inline-flex"
            >
              Schedule Demo
            </a>
            <button
              type="button"
              className="inline-flex rounded-full border border-slate-200 bg-white/80 p-3 text-slate-700 transition-[transform,background-color] duration-300 hover:-translate-y-0.5 hover:bg-white lg:hidden"
              onClick={() => setMobileMenuOpen((c) => !c)}
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-panel mx-auto mt-3 flex max-w-7xl flex-col gap-3 rounded-[2rem] px-5 py-5 lg:hidden"
          >
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="flex items-center gap-2.5 rounded-2xl px-3 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-[#F0F9E6] hover:text-[#5FA01F]"
                onClick={() => setMobileMenuOpen(false)}
              >
                <link.Icon className="h-4 w-4 text-slate-400" />
                {link.label}
              </a>
            ))}
            <div className="grid gap-3 sm:grid-cols-2">
              <a href={loginHref} className="rounded-full border border-slate-200 bg-white px-5 py-3 text-center text-sm font-semibold text-slate-800" onClick={() => setMobileMenuOpen(false)}>Login</a>
              <a href="#cta" className="rounded-full bg-[#73BA27] px-5 py-3 text-center text-sm font-semibold text-white" onClick={() => setMobileMenuOpen(false)}>Schedule Demo</a>
            </div>
          </motion.div>
        )}
      </header>

      <main className="relative z-10">
        {/* ── Hero ── */}
        <section id="top" ref={heroRef} className="px-4 pb-20 pt-16 sm:px-6 lg:px-8 lg:pb-28 lg:pt-12">
          <div className="mx-auto grid max-w-7xl gap-14 lg:grid-cols-[1.03fr_0.97fr] lg:items-center">
            <motion.div initial="hidden" animate="visible" variants={sectionReveal} className="max-w-2xl">
              <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#D4EDBC] bg-white/80 px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-[#5FA01F] shadow-[0_12px_24px_rgba(92,160,31,0.08)]">
                <Sparkles className="h-3.5 w-3.5" />
                For Hospitals &amp; Nephrologists
              </div>
              <h1 className="text-balance text-4xl font-semibold leading-[1.02] text-slate-950 sm:text-5xl lg:text-6xl">
                Turn CKD follow-up chaos into a single clinical snapshot
              </h1>
              <p className="mt-6 max-w-xl text-sm leading-7 text-slate-600 sm:text-base">
                BeanHealth compresses fragmented medical data into a clinician-ready decision snapshot — highlighting deterioration, pending actions, and provenance so nephrologists can act faster with confidence and less manual review.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                {heroPills.map((pill) => (
                  <span key={pill} className="rounded-full border border-slate-200/80 bg-white/80 px-4 py-2 text-sm text-slate-700 shadow-[0_8px_20px_rgba(15,23,42,0.04)]">{pill}</span>
                ))}
              </div>
              <p className="mt-7 max-w-2xl text-sm leading-7 text-slate-500">
                <span className="font-semibold text-slate-700">Provenance &amp; disclaimer:</span> BeanHealth extracts decision-relevant facts from clinical records and surfaces explainable, rule-based risk flags. The snapshot supports clinician decision-making and never replaces full medical review or clinical judgement.
              </p>
              <div className="mt-10 flex flex-col gap-4 sm:flex-row">
                <a href="#cta" className="inline-flex items-center justify-center gap-2 rounded-full bg-[#73BA27] px-6 py-4 text-sm font-semibold text-white shadow-[0_18px_48px_rgba(92,160,31,0.24)] transition-[transform,box-shadow,background-color] duration-300 hover:-translate-y-1 hover:bg-[#5FA01F]">
                  Schedule Clinical Demo <ArrowRight className="h-4 w-4" />
                </a>
                <a href="#workflow" className="inline-flex items-center justify-center gap-2 rounded-full border border-slate-200 bg-white/80 px-6 py-4 text-sm font-semibold text-slate-800 transition-[transform,box-shadow,border-color] duration-300 hover:-translate-y-1 hover:border-[#C2E29A]">
                  See How It Works <ChevronRight className="h-4 w-4" />
                </a>
              </div>
              <div className="mt-12 grid gap-4 sm:grid-cols-3">
                {heroMetrics.map((metric) => (
                  <div key={metric.label} className="glass-panel rounded-[2rem] px-5 py-5">
                    <div className="font-mono text-sm text-[#73BA27]">{metric.value}</div>
                    <p className="mt-3 text-sm leading-6 text-slate-600">{metric.label}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            <div className="hero-stage relative lg:min-h-[760px]">
              <motion.img
                src="https://images.pexels.com/photos/36022686/pexels-photo-36022686.png?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940"
                alt="Abstract 3D healthcare background"
                loading="lazy"
                className="pointer-events-none absolute inset-x-10 top-4 hidden w-[78%] rounded-[3rem] opacity-90 sm:block"
                style={{ x: accentX }}
              />
              <motion.div className="relative mt-8 rounded-[2.6rem] p-4 sm:p-6" style={{ y: dashboardY }}>
                <motion.div
                  className="dashboard-shadow glass-panel section-sheen relative overflow-hidden rounded-[2.8rem] p-3 sm:p-5"
                  style={{ rotateX: dashboardRotateX, rotateZ: dashboardRotateZ, scale: dashboardScale }}
                >
                  <div className="grid-noise absolute inset-0 rounded-[2.5rem] bg-[linear-gradient(180deg,rgba(255,255,255,0.7),rgba(240,245,255,0.8))]" />
                  <img
                    src="https://www.beanhealth.in/dashboard-mockup.png"
                    alt="BeanHealth dashboard mockup"
                    fetchPriority="high"
                    className="relative z-10 w-full rounded-[2.1rem] border border-white/60 object-contain"
                  />
                </motion.div>
                <motion.div
                  className="glass-panel absolute -left-4 top-6 z-20 max-w-[220px] rounded-[1.8rem] px-4 py-4 sm:-left-10"
                  style={{ y: floatingY }}
                >
                  <div className="font-mono text-xs uppercase tracking-[0.24em] text-rose-500">Rapid risk flag</div>
                  <p className="mt-3 text-sm font-medium text-slate-900">eGFR deterioration detected before the next planned visit.</p>
                </motion.div>
                <motion.div
                  className="glass-panel absolute -right-1 bottom-4 z-20 max-w-[220px] rounded-[1.8rem] px-4 py-4 sm:-right-10"
                  style={{ y: provenanceY }}
                >
                  <div className="font-mono text-xs uppercase tracking-[0.24em] text-[#73BA27]">Provenance ready</div>
                  <p className="mt-3 text-sm font-medium text-slate-900">Every extracted fact links back to source text, page, and timestamp.</p>
                </motion.div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ── Problem ── */}
        <section className="px-4 py-24 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl rounded-[3rem] bg-slate-50/90 px-6 py-12 shadow-[0_20px_60px_rgba(15,23,42,0.04)] sm:px-10 lg:px-12 lg:py-16">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-120px" }} variants={sectionReveal}>
              <p className="font-mono text-xs uppercase tracking-[0.3em] text-slate-500">Clinician workflow is broken — not clinical knowledge</p>
              <h2 className="mt-4 max-w-3xl text-3xl font-semibold text-slate-950 sm:text-4xl">
                Fragmented patient context slows decisions, hides deterioration, and pushes renal care into reactive mode.
              </h2>
            </motion.div>
            <div className="mt-10 grid gap-5 lg:grid-cols-[1.25fr_0.75fr]">
              <div className="grid gap-5 md:grid-cols-2">
                {problemCards.map((card, index) => {
                  const Icon = iconMap[index] ?? HeartPulse;
                  return (
                    <motion.article
                      key={card.title}
                      initial={{ opacity: 0, y: 32 }}
                      whileInView={{ opacity: 1, y: 0 }}
                      viewport={{ once: true, margin: "-90px" }}
                      transition={{ duration: 0.65, delay: index * 0.08 }}
                      className="glass-panel section-sheen relative overflow-hidden rounded-[2.2rem] p-8"
                    >
                      <div className={`absolute inset-0 bg-gradient-to-br ${card.accent}`} />
                      <div className="relative z-10">
                        <Icon className="h-6 w-6 text-[#73BA27]" />
                        <h3 className="mt-6 text-xl font-semibold text-slate-950">{card.title}</h3>
                        <p className="mt-3 text-sm leading-7 text-slate-600">{card.description}</p>
                      </div>
                    </motion.article>
                  );
                })}
                <motion.article
                  initial={{ opacity: 0, y: 32 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-90px" }}
                  transition={{ duration: 0.65, delay: 0.24 }}
                  className="glass-panel section-sheen relative overflow-hidden rounded-[2.2rem] p-8 md:col-span-2"
                >
                  <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <div className="font-mono text-xs uppercase tracking-[0.28em] text-slate-500">Who suffers?</div>
                      <h3 className="mt-3 text-2xl font-semibold text-slate-950">Every stakeholder pays for disconnected follow-up.</h3>
                    </div>
                    <div className="rounded-full bg-[#F0F9E6] px-4 py-2 text-sm font-medium text-[#5FA01F]">BeanHealth closes the visibility gap.</div>
                  </div>
                  <div className="mt-8 grid gap-4 md:grid-cols-3">
                    {stakeholderImpact.map((item) => (
                      <div key={item.name} className="glass-panel rounded-[1.8rem] p-5">
                        <div className="text-lg font-semibold text-slate-900">{item.name}</div>
                        <p className="mt-3 text-sm leading-6 text-slate-600">{item.detail}</p>
                      </div>
                    ))}
                  </div>
                </motion.article>
              </div>
              <motion.div
                initial={{ opacity: 0, x: 24 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                className="glass-panel section-sheen flex flex-col justify-between rounded-[2.4rem] p-8"
              >
                <div>
                  <div className="font-mono text-xs uppercase tracking-[0.28em] text-[#73BA27]">AI assists, doctor decides</div>
                  <p className="mt-4 text-2xl font-semibold text-slate-950">Insights surface instantly, but every clinical decision stays with the treating nephrologist.</p>
                </div>
                <div className="mt-8 rounded-[2rem] border border-[#D4EDBC] bg-[#F0F9E6]/80 p-5">
                  <ShieldCheck className="h-8 w-8 text-[#73BA27]" />
                  <p className="mt-4 text-sm leading-7 text-slate-700">Trusted decision support means explainable rules, transparent provenance, and zero black-box ambiguity.</p>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* ── Platform / Comparison ── */}
        <section id="platform" className="px-4 py-24 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={sectionReveal}>
              <p className="font-mono text-xs uppercase tracking-[0.3em] text-slate-500">The gap in existing EMR &amp; telemedicine</p>
              <div className="mt-5 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <h2 className="max-w-3xl text-3xl font-semibold text-slate-950 sm:text-4xl">
                  BeanHealth adds the missing clinical intelligence layer that typical tools never designed for CKD follow-up.
                </h2>
                <p className="max-w-xl text-sm leading-7 text-slate-600">
                  Rather than duplicating generic telemedicine features, BeanHealth turns scattered records into one explainable clinical snapshot with reasons, cues, and accountability.
                </p>
              </div>
            </motion.div>

            <div className="glass-panel mt-10 overflow-hidden rounded-[2.6rem]">
              <div className="grid grid-cols-[1.1fr_0.95fr_1fr] border-b border-slate-200/70 bg-slate-50/90 px-6 py-5 text-sm font-semibold text-slate-600 sm:px-8">
                <div>Capability</div>
                <div>Traditional EMR / Telemedicine</div>
                <div className="text-[#5FA01F]">BeanHealth</div>
              </div>
              {comparisonRows.map(([capability, traditional, bean], index) => (
                <div key={capability} className="grid grid-cols-1 gap-4 border-b border-slate-200/60 px-6 py-6 last:border-b-0 sm:px-8 md:grid-cols-[1.1fr_0.95fr_1fr]">
                  <div className="font-semibold text-slate-950">{capability}</div>
                  <div className="rounded-[1.5rem] bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-600">{traditional}</div>
                  <div className="rounded-[1.5rem] bg-[linear-gradient(135deg,rgba(240,249,230,1),rgba(255,255,255,0.95))] px-4 py-4 text-sm leading-6 text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_0_32px_rgba(92,160,31,0.08)]">{bean}</div>
                </div>
              ))}
            </div>

            <div className="mt-14 grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
              <motion.div
                initial={{ opacity: 0, x: -24 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                className="glass-panel section-sheen overflow-hidden rounded-[2.6rem] p-4 sm:p-6"
              >
                <img
                  src="https://images.unsplash.com/photo-1576669801838-1b1c52121e6a?crop=entropy&cs=srgb&fm=jpg&q=85"
                  alt="Modern clinical environment"
                  loading="lazy"
                  className="aspect-[4/5] w-full rounded-[2.1rem] object-cover object-center"
                />
              </motion.div>
              <div className="space-y-5">
                <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-100px" }} className="glass-panel rounded-[2.4rem] p-8">
                  <div className="font-mono text-xs uppercase tracking-[0.28em] text-[#73BA27]">How we fix it</div>
                  <h3 className="mt-4 text-2xl font-semibold text-slate-950">An explainable clinical snapshot for faster triage and auditable action.</h3>
                  <p className="mt-4 text-sm leading-7 text-slate-600">BeanHealth converts unstructured records into structured clinical facts, applies rule-based risk flags, and delivers actionable next steps without hiding the original evidence.</p>
                </motion.div>
                <div className="grid gap-5 md:grid-cols-3">
                  {platformComponents.map((component, index) => {
                    const icons = [BrainCircuit, Activity, ShieldCheck];
                    const Icon = icons[index] ?? BrainCircuit;
                    return (
                      <motion.article
                        key={component.title}
                        initial={{ opacity: 0, y: 24 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true, margin: "-100px" }}
                        transition={{ duration: 0.6, delay: index * 0.08 }}
                        className="glass-panel rounded-[2rem] p-6"
                      >
                        <Icon className="h-6 w-6 text-[#73BA27]" />
                        <h3 className="mt-5 text-lg font-semibold text-slate-950">{component.title}</h3>
                        <p className="mt-3 text-sm leading-6 text-slate-600">{component.description}</p>
                      </motion.article>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Workflow ── */}
        <section id="workflow" className="px-4 py-24 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl rounded-[3rem] bg-[linear-gradient(180deg,rgba(248,250,252,0.9),rgba(255,255,255,0.92))] px-6 py-12 sm:px-10 lg:px-12 lg:py-16">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={sectionReveal} className="max-w-3xl">
              <p className="font-mono text-xs uppercase tracking-[0.3em] text-slate-500">How BeanHealth works</p>
              <h2 className="mt-4 text-3xl font-semibold text-slate-950 sm:text-4xl">A complete closed-loop system from patient monitoring to clinician action.</h2>
              <p className="mt-5 text-sm leading-7 text-slate-600">Based on KDIGO guidelines and nephrologist-reviewed protocols, each stage builds towards faster intervention with clear reasoning and provenance.</p>
            </motion.div>
            <div className="mt-12 grid gap-10 lg:grid-cols-[0.72fr_1.28fr]">
              <div className="glass-panel sticky top-28 h-fit rounded-[2.4rem] p-8">
                <div className="inline-flex items-center gap-2 rounded-full bg-[#F0F9E6] px-4 py-2 text-sm font-semibold text-[#5FA01F]">
                  <BadgeCheck className="h-4 w-4" />
                  Nephrologist-reviewed protocols
                </div>
                <p className="mt-6 text-2xl font-semibold text-slate-950">Every workflow step keeps evidence visible while guiding the next best action.</p>
                <div className="mt-8 space-y-4">
                  {alertCards.map((alert) => (
                    <div key={alert.value} className="glass-panel rounded-[1.8rem] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <span className={`text-sm font-semibold ${alert.tone}`}>{alert.label}</span>
                        <span className="font-mono text-xs uppercase tracking-[0.18em] text-slate-400">{alert.time}</span>
                      </div>
                      <p className="mt-3 text-sm leading-6 text-slate-600">{alert.value}</p>
                    </div>
                  ))}
                </div>
              </div>
              <div className="relative pl-10 sm:pl-14">
                <div className="timeline-line absolute left-2 top-0 h-full w-px sm:left-4" />
                <div className="space-y-7">
                  {workflowSteps.map((step, index) => (
                    <motion.article
                      key={step.step}
                      initial={{ opacity: 0, x: 48 }}
                      whileInView={{ opacity: 1, x: 0 }}
                      viewport={{ once: true, margin: "-100px" }}
                      transition={{ duration: 0.65, delay: index * 0.04 }}
                      className="relative"
                    >
                      <div className="absolute left-[-2.4rem] top-7 flex h-5 w-5 items-center justify-center rounded-full border-4 border-white bg-[#73BA27] shadow-[0_0_0_12px_rgba(115,186,39,0.12)] sm:left-[-2.8rem]" />
                      <div className="glass-panel rounded-[2.2rem] p-7">
                        <div className="font-mono text-xs uppercase tracking-[0.28em] text-[#73BA27]">Step {step.step}</div>
                        <h3 className="mt-4 text-xl font-semibold text-slate-950">{step.title}</h3>
                        <p className="mt-3 text-sm leading-7 text-slate-600">{step.description}</p>
                      </div>
                    </motion.article>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Features ── */}
        <section className="px-4 py-24 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={sectionReveal} className="max-w-3xl">
              <p className="font-mono text-xs uppercase tracking-[0.3em] text-slate-500">Complete feature set</p>
              <h2 className="mt-4 text-3xl font-semibold text-slate-950 sm:text-4xl">Clinician-first capabilities designed to reduce chart review time and missed deterioration.</h2>
            </motion.div>

            <div className="mt-12 grid gap-6 lg:grid-cols-[3fr_2fr]">
              <div className="grid gap-5 sm:grid-cols-3">
                {featureColumns.map((column, index) => (
                  <motion.article
                    key={column.category}
                    initial={{ opacity: 0, y: 22 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ duration: 0.65, delay: index * 0.08 }}
                    className="glass-panel flex flex-col rounded-[2.2rem] p-6"
                  >
                    <div className="mb-4">
                      <span className="inline-block rounded-full bg-[#F0F9E6] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#5FA01F]">{column.badge}</span>
                      <h3 className="mt-3 text-base font-semibold leading-snug text-slate-950">{column.category}</h3>
                    </div>
                    <div className="space-y-3">
                      {column.items.map((item) => (
                        <div key={item} className="flex gap-2.5 text-sm leading-6 text-slate-600">
                          <Check className="mt-1 h-3.5 w-3.5 shrink-0 text-[#73BA27]" />
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </motion.article>
                ))}
              </div>

              <motion.div
                initial={{ opacity: 0, x: 24 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                className="glass-panel flex flex-col rounded-[2.6rem] p-7"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-mono text-xs uppercase tracking-[0.28em] text-slate-500">eGFR Trend</p>
                    <h3 className="mt-2 text-2xl font-semibold text-slate-950">Last 6 months</h3>
                    <p className="mt-1.5 text-sm text-[#5FA01F]">Declining trajectory surfaced before emergency threshold.</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-600">Declining</span>
                </div>
                <div className="mt-6 h-44 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={eGFRData} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
                      <defs>
                        <linearGradient id="eGFRGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#73BA27" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#73BA27" stopOpacity={0.03} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} />
                      <YAxis domain={[20, 100]} tick={{ fontSize: 11, fill: "#94A3B8" }} axisLine={false} tickLine={false} ticks={[30, 60, 90]} />
                      <Tooltip
                        contentStyle={{ fontSize: 12, borderRadius: 12, border: "1px solid #E2E8F0", boxShadow: "0 4px 16px rgba(15,23,42,0.08)" }}
                        formatter={(v: number) => [`${v} mL/min`, "eGFR"]}
                        labelStyle={{ fontWeight: 600, color: "#0F172A" }}
                      />
                      <ReferenceLine y={30} stroke="#FDA4AF" strokeDasharray="4 3" strokeWidth={1.5} label={{ value: "Stage 4", position: "insideTopRight", fontSize: 10, fill: "#F43F5E" }} />
                      <Area type="monotone" dataKey="value" stroke="#73BA27" strokeWidth={2.5} fill="url(#eGFRGradient)" dot={{ r: 4, fill: "#5FA01F", strokeWidth: 0 }} activeDot={{ r: 6, fill: "#4D8619", strokeWidth: 0 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-5 space-y-3">
                  {alertCards.map((alert) => (
                    <div key={alert.label} className="flex items-start justify-between gap-3 rounded-2xl border border-slate-200/80 bg-white/80 px-4 py-3">
                      <div>
                        <p className={`text-sm font-semibold ${alert.tone}`}>{alert.label}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-600">{alert.value}</p>
                      </div>
                      <span className="shrink-0 font-mono text-[10px] uppercase tracking-[0.14em] text-slate-400">{alert.time}</span>
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>

            <div className="mt-14 grid gap-5 md:grid-cols-3">
              {([
                { icon: ShieldCheck, title: "End-to-end data encryption" },
                { icon: FileStack, title: "Complete audit trails" },
                { icon: Users, title: "Patient consent management" },
              ] as const).map((item) => (
                <div key={item.title} className="glass-panel rounded-[2rem] p-6">
                  <item.icon className="h-6 w-6 text-[#73BA27]" />
                  <p className="mt-5 text-lg font-semibold text-slate-950">{item.title}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Pricing ── */}
        <section id="pricing" className="px-4 py-24 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl rounded-[3rem] bg-slate-50/80 px-6 py-12 sm:px-10 lg:px-12 lg:py-16">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={sectionReveal}>
              <p className="font-mono text-xs uppercase tracking-[0.3em] text-slate-500">Clinic subscription plans</p>
              <div className="mt-4 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <h2 className="max-w-3xl text-3xl font-semibold text-slate-950 sm:text-4xl">Flexible pricing for nephrology departments, dialysis centers, and hospital workflows.</h2>
                <div className="inline-flex rounded-full border border-slate-200 bg-white p-2">
                  {(["annual", "monthly"] as const).map((key) => (
                    <button
                      key={key}
                      type="button"
                      className={`rounded-full px-4 py-2 text-sm font-semibold transition-[background-color,color,transform] duration-300 ${billingCycle === key ? "bg-[#73BA27] text-white shadow-[0_10px_26px_rgba(92,160,31,0.18)]" : "text-slate-600 hover:-translate-y-0.5"}`}
                      onClick={() => setBillingCycle(key)}
                    >
                      {key === "annual" ? "Billed Annually" : "Billed Monthly"}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>

            <div className="mt-12 grid gap-6 lg:grid-cols-[0.92fr_1.08fr]">
              {pricingPlans.map((plan) => (
                <motion.article
                  key={plan.key}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  className={`rounded-[2.5rem] p-8 glass-panel skeuomorph-card ${plan.emphasis ? "iridescent" : ""}`}
                >
                  {plan.emphasis && (
                    <div className="mb-5 inline-flex rounded-full bg-[#73BA27] px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-white">Most Popular</div>
                  )}
                  <h3 className="text-2xl font-semibold text-slate-950">{plan.name}</h3>
                  <p className="mt-5 text-4xl font-semibold text-slate-950">{plan[billingCycle]}</p>
                  <div className="mt-6 space-y-4">
                    {plan.features.map((feature) => (
                      <div key={feature} className="flex items-start gap-3 text-sm leading-6 text-slate-600">
                        <Check className="mt-1 h-4 w-4 shrink-0 text-[#73BA27]" />
                        <span>{feature}</span>
                      </div>
                    ))}
                  </div>
                  <a
                    href="#cta"
                    className={`mt-8 inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition-[transform,box-shadow,background-color] duration-300 hover:-translate-y-0.5 ${plan.emphasis ? "bg-[#73BA27] text-white shadow-[0_16px_42px_rgba(92,160,31,0.24)] hover:bg-[#5FA01F]" : "border border-slate-200 bg-white text-slate-900 hover:shadow-[0_16px_38px_rgba(15,23,42,0.08)]"}`}
                  >
                    Request Pilot <ArrowRight className="h-4 w-4" />
                  </a>
                </motion.article>
              ))}
            </div>

            <div className="mt-8 rounded-[2rem] border border-[#D4EDBC] bg-[#F0F9E6]/75 px-6 py-5 text-sm leading-7 text-slate-700">
              Already have an EMR or prescription system? Integrate the CKD Snapshot module with your existing workflow. Pricing is per clinic with no setup or development fees and a free 7-day pilot for clinics.
            </div>
          </div>
        </section>

        {/* ── Team ── */}
        <section id="team" className="px-4 py-24 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={sectionReveal} className="max-w-3xl">
              <p className="font-mono text-xs uppercase tracking-[0.3em] text-slate-500">The founding team</p>
              <h2 className="mt-4 text-3xl font-semibold text-slate-950 sm:text-4xl">Built by a product and engineering team focused on practical chronic-care infrastructure.</h2>
            </motion.div>
            <div className="mt-12 grid gap-6">
              {teamMembers.slice(0, 1).map((member) => (
                <motion.article
                  key={member.name}
                  initial={{ opacity: 0, y: 24 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-100px" }}
                  className="glass-panel rounded-[2.4rem] p-7 lg:grid lg:grid-cols-[minmax(240px,300px)_1fr] lg:items-center lg:gap-8 lg:p-9"
                >
                  <div className="mx-auto w-full max-w-[300px] lg:max-w-none">
                    <img src={member.image} alt={member.name} loading="lazy" className="aspect-[4/5] w-full rounded-[2rem] border border-white/70 object-cover object-top shadow-[0_24px_54px_rgba(15,23,42,0.1)]" />
                  </div>
                  <div>
                    <div className="mt-7 lg:mt-0">
                      <h3 className="text-3xl font-semibold text-slate-950 sm:text-4xl">{member.name}</h3>
                      <p className="mt-2 text-sm font-medium text-slate-500">{member.role}</p>
                      <p className="mt-6 max-w-2xl text-base leading-8 text-slate-600">{member.description}</p>
                    </div>
                    <div className="mt-6 rounded-[1.8rem] border border-[#D4EDBC] bg-[#F0F9E6]/70 p-5">
                      <p className="text-sm leading-7 text-slate-700">Driving product, technology, and business strategy to turn BeanHealth into scalable chronic-care infrastructure for the next generation of telemedicine.</p>
                    </div>
                    <div className="mt-6 flex flex-wrap gap-2">
                      {member.skills.map((skill) => (
                        <span key={skill} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600">{skill}</span>
                      ))}
                    </div>
                    {/* Social links */}
                    <div className="mt-6 flex gap-3">
                      {member.email && (
                        <a
                          href={`mailto:${member.email}`}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition-all duration-200 hover:bg-slate-200 hover:text-slate-900"
                          title={`Email ${member.name}`}
                        >
                          <Mail className="h-4 w-4" />
                        </a>
                      )}
                      {member.linkedin && (
                        <a
                          href={member.linkedin}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#0077B5] text-white transition-all duration-200 hover:bg-[#005885] hover:shadow-[0_4px_12px_rgba(0,119,181,0.35)]"
                          title={`${member.name} on LinkedIn`}
                        >
                          <Linkedin className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  </div>
                </motion.article>
              ))}
              <div className="grid gap-6 sm:grid-cols-2">
                {teamMembers.slice(1).map((member, index) => (
                  <motion.article
                    key={member.name}
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ duration: 0.65, delay: (index + 1) * 0.08 }}
                    className="glass-panel rounded-[2.4rem] p-7"
                  >
                    <img src={member.image} alt={member.name} loading="lazy" className="h-24 w-24 rounded-full border border-white/70 object-cover object-[center_18%] shadow-[0_18px_40px_rgba(15,23,42,0.08)]" />
                    <div className="mt-6">
                      <h3 className="text-xl font-semibold text-slate-950">{member.name}</h3>
                      <p className="mt-2 text-sm font-medium text-slate-500">{member.role}</p>
                      <p className="mt-5 text-sm leading-7 text-slate-600">{member.description}</p>
                    </div>
                    <div className="mt-6 flex flex-wrap gap-2">
                      {member.skills.map((skill) => (
                        <span key={skill} className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600">{skill}</span>
                      ))}
                    </div>
                    {/* Social links */}
                    <div className="mt-5 flex gap-3">
                      {member.email && (
                        <a
                          href={`mailto:${member.email}`}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition-all duration-200 hover:bg-slate-200 hover:text-slate-900"
                          title={`Email ${member.name}`}
                        >
                          <Mail className="h-4 w-4" />
                        </a>
                      )}
                      {member.linkedin && (
                        <a
                          href={member.linkedin}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#0077B5] to-[#005885] px-4 py-2 text-xs font-medium text-white shadow-[0_4px_12px_rgba(0,119,181,0.3)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_6px_18px_rgba(0,119,181,0.4)]"
                          title={`${member.name} on LinkedIn`}
                        >
                          <Linkedin className="h-3.5 w-3.5" />
                          LinkedIn
                        </a>
                      )}
                    </div>
                  </motion.article>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Projects ── */}
        <section id="projects" className="px-4 py-24 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: "-100px" }} variants={sectionReveal} className="max-w-3xl">
              <p className="font-mono text-xs uppercase tracking-[0.3em] text-slate-500">What we&apos;re building</p>
              <h2 className="mt-4 text-3xl font-semibold text-slate-950 sm:text-4xl">Ongoing projects shaping the future of chronic disease care.</h2>
              <p className="mt-4 text-sm leading-7 text-slate-600">A live view into the initiatives our team is actively building — from mobile biosensor apps to AI risk engines.</p>
            </motion.div>

            <div className="mt-12 grid gap-6 sm:grid-cols-2">
              {ongoingProjects.map((project, index) => {
                const statusStyles: Record<string, { badge: string; dot: string }> = {
                  amber: { badge: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-400" },
                  blue: { badge: "bg-[#F0F9E6] text-[#5FA01F] border-[#C2E29A]", dot: "bg-[#73BA27]" },
                  slate: { badge: "bg-slate-100 text-slate-600 border-slate-200", dot: "bg-slate-400" },
                  green: { badge: "bg-[#F0F9E6] text-[#5FA01F] border-[#C2E29A]", dot: "bg-[#73BA27]" },
                };
                const cardAccents = [
                  { gradient: "from-violet-500/10 via-[#8FC94F]/5 to-transparent", icon: "bg-violet-50", iconColor: "text-violet-600", bar: "bg-gradient-to-r from-violet-500 to-[#73BA27]", tag: "bg-violet-50 text-violet-700", featured: false },
                  { gradient: "from-[#73BA27]/22 via-cyan-400/18 to-indigo-500/10", icon: "bg-[#D4EDBC]", iconColor: "text-[#5FA01F]", bar: "bg-gradient-to-r from-[#73BA27] via-cyan-400 to-indigo-500", tag: "bg-[#D4EDBC] text-[#4D8619]", featured: true },
                  { gradient: "from-emerald-500/10 via-teal-400/5 to-transparent", icon: "bg-emerald-50", iconColor: "text-emerald-600", bar: "bg-gradient-to-r from-emerald-500 to-teal-400", tag: "bg-emerald-50 text-emerald-700", featured: false },
                  { gradient: "from-rose-500/10 via-orange-400/5 to-transparent", icon: "bg-rose-50", iconColor: "text-rose-600", bar: "bg-gradient-to-r from-rose-500 to-orange-400", tag: "bg-rose-50 text-rose-700", featured: false },
                ];
                const accent = cardAccents[index % cardAccents.length];
                const s = statusStyles[project.statusColor] ?? statusStyles.slate;
                return (
                  <motion.article
                    key={project.name}
                    initial={{ opacity: 0, y: 24 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-100px" }}
                    transition={{ duration: 0.6, delay: index * 0.08 }}
                    className={`glass-panel relative flex flex-col overflow-hidden rounded-[2.4rem] p-7 ${accent.featured ? "ring-2 ring-[#8FC94F]/40 shadow-[0_0_48px_rgba(115,186,39,0.18),0_20px_60px_rgba(115,186,39,0.12)]" : ""}`}
                  >
                    <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${accent.gradient}`} />
                    {accent.featured && (
                      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#8FC94F]/80 to-transparent" />
                    )}
                    <div className="flex items-start justify-between gap-4">
                      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${accent.icon}`}>
                        <FolderKanban className={`h-5 w-5 ${accent.iconColor}`} />
                      </div>
                      <div className="flex items-center gap-2">
                        {accent.featured && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#73BA27] px-3 py-1 text-xs font-semibold text-white shadow-[0_4px_12px_rgba(93,153,31,0.35)]">
                            ★ Core Product
                          </span>
                        )}
                        <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${s.badge}`}>
                          <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
                          {project.status}
                        </span>
                      </div>
                    </div>
                    <div className="mt-5 flex-1">
                      <h3 className="text-lg font-semibold text-slate-950">{project.name}</h3>
                      <p className="mt-3 text-sm leading-7 text-slate-600">{project.description}</p>
                    </div>
                    <div className="mt-6">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="text-xs font-medium text-slate-500">Progress</span>
                        <span className="text-xs font-semibold text-slate-700">{project.progress}%</span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                        <motion.div
                          className={`h-full rounded-full ${accent.bar}`}
                          initial={{ width: 0 }}
                          whileInView={{ width: `${project.progress}%` }}
                          viewport={{ once: true }}
                          transition={{ duration: 1, delay: index * 0.1 + 0.3, ease: "easeOut" }}
                        />
                      </div>
                    </div>
                    <div className="mt-5 flex flex-wrap gap-2">
                      {project.tags.map((tag) => (
                        <span key={tag} className={`rounded-full px-3 py-1 text-xs font-medium ${accent.tag}`}>{tag}</span>
                      ))}
                    </div>
                  </motion.article>
                );
              })}
            </div>
            <CKDEngineSection />
          </div>
        </section>

        {/* ── Value ── */}
        <section className="px-4 py-24 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[1.02fr_0.98fr]">
            <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-100px" }} className="glass-panel rounded-[2.6rem] p-8">
              <div className="font-mono text-xs uppercase tracking-[0.3em] text-slate-500">Value for everyone</div>
              <h2 className="mt-4 text-3xl font-semibold text-slate-950">Clinical workflow infrastructure for hospitals, nephrologists, and patients.</h2>
              <div className="mt-8 grid gap-4 md:grid-cols-2">
                {valueItems.map((item) => (
                  <div key={item} className="glass-panel flex gap-3 rounded-[1.7rem] p-4 text-sm leading-6 text-slate-600">
                    <Check className="mt-1 h-4 w-4 shrink-0 text-[#73BA27]" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-100px" }} className="grid gap-5">
              {differentiators.map((item) => (
                <article key={item.title} className="glass-panel rounded-[2.2rem] p-7">
                  <h3 className="text-xl font-semibold text-slate-950">{item.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-slate-600">{item.description}</p>
                </article>
              ))}
            </motion.div>
          </div>
          <div className="mx-auto mt-6 max-w-7xl rounded-[2.6rem] bg-[linear-gradient(180deg,rgba(240,249,255,0.95),rgba(255,255,255,0.96))] px-8 py-8 shadow-[0_18px_52px_rgba(15,23,42,0.05)]">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="font-mono text-xs uppercase tracking-[0.3em] text-slate-500">Flexible deployment model</div>
                <p className="mt-4 max-w-3xl text-lg font-semibold text-slate-950">BeanHealth is sold to hospitals and nephrology practices as clinical workflow infrastructure — not a consumer health app.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {deploymentModes.map((mode) => (
                  <div key={mode} className="flex items-center gap-3 rounded-full border border-[#D4EDBC] bg-white px-4 py-3 text-sm text-slate-600">
                    <Building2 className="h-4 w-4 text-[#73BA27]" />
                    {mode}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── CTA ── */}
        <section id="cta" className="px-4 pb-24 pt-10 sm:px-6 lg:px-8">
          <div className="mx-auto grid max-w-7xl gap-6 rounded-[3rem] glass-panel skeuomorph-card px-6 py-10 sm:px-10 lg:grid-cols-[0.88fr_1.12fr] lg:px-12 lg:py-12">
            <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-100px" }} className="flex flex-col justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-[#F0F9E6] px-4 py-2 text-sm font-semibold text-[#5FA01F]">
                  <Stethoscope className="h-4 w-4" />
                  Modernise your CKD department today
                </div>
                <h2 className="mt-6 text-3xl font-semibold text-slate-950 sm:text-4xl">Schedule a demo to see how BeanHealth transforms renal follow-up into one clear clinical view.</h2>
                <p className="mt-5 text-sm leading-7 text-slate-600">Tell us what you want to improve — clinician review time, patient follow-up visibility, or CKD snapshot workflows — and we&apos;ll tailor the walkthrough.</p>
              </div>
              <div className="mt-10 grid gap-4 sm:grid-cols-2">
                {["Reduced complication load", "Faster clinician triage", "Audit-ready follow-up", "Clear integration path"].map((item) => (
                  <div key={item} className="glass-panel flex items-center gap-3 rounded-[1.6rem] px-4 py-4 text-sm font-medium text-slate-700">
                    <BadgeCheck className="h-4 w-4 text-[#73BA27]" />
                    {item}
                  </div>
                ))}
              </div>
            </motion.div>

            <motion.form
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-100px" }}
              onSubmit={handleSubmit}
              className="glass-panel rounded-[2.6rem] p-6 sm:p-8"
            >
              <div className="grid gap-5">
                <div>
                  <label htmlFor="name" className="mb-3 block text-sm font-semibold text-slate-700">Name *</label>
                  <input id="name" name="name" value={formState.name} onChange={handleChange} required className={inputClassName} placeholder="Your name" />
                </div>
                <div>
                  <label htmlFor="email" className="mb-3 block text-sm font-semibold text-slate-700">Email *</label>
                  <input id="email" name="email" type="email" value={formState.email} onChange={handleChange} required className={inputClassName} placeholder="you@hospital.com" />
                </div>
                <div>
                  <label htmlFor="interest" className="mb-3 block text-sm font-semibold text-slate-700">What are you looking for? *</label>
                  <textarea id="interest" name="interest" rows={5} value={formState.interest} onChange={handleChange} required className={`${inputClassName} resize-none`} placeholder="Tell us about your workflow goals" />
                </div>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="inline-flex items-center justify-center gap-2 rounded-full bg-[#73BA27] px-6 py-4 text-sm font-semibold text-white shadow-[0_16px_44px_rgba(92,160,31,0.24)] transition-[transform,box-shadow,background-color] duration-300 hover:-translate-y-0.5 hover:bg-[#5FA01F] disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSubmitting ? "Sending Request" : "Request Demo"}
                  <ArrowRight className="h-4 w-4" />
                </button>
                {submitState.type !== "idle" && (
                  <div className={`rounded-[1.6rem] px-4 py-4 text-sm leading-6 ${submitState.type === "success" ? "border border-emerald-200 bg-emerald-50 text-emerald-700" : "border border-rose-200 bg-rose-50 text-rose-600"}`}>
                    {submitState.message}
                  </div>
                )}
              </div>
            </motion.form>
          </div>
        </section>
      </main>
    </div>
  );
}
