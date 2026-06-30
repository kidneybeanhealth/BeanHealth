export const heroPills: string[] = [
  "Reduce clinical overload",
  "Rapid risk flags",
  "Explainable provenance",
];

export const heroMetrics: { value: string; label: string }[] = [
  { value: "6-step", label: "closed-loop nephrology workflow" },
  { value: "1 screen", label: "decision snapshot for clinicians" },
  { value: "24/7", label: "follow-up visibility between visits" },
];

export const problemCards: { title: string; description: string; accent: string }[] = [
  {
    title: "Untracked deterioration between visits",
    description:
      "Gradual declines and critical trends are missed when labs, messages, and summaries stay fragmented.",
    accent: "from-rose-500/20 via-transparent to-transparent",
  },
  {
    title: "Manual reconstruction of patient history",
    description:
      "Nephrologists spend precious time collating reports, medications, and notes before each decision.",
    accent: "from-amber-400/20 via-transparent to-transparent",
  },
  {
    title: "Reactive emergency-driven care",
    description:
      "Delayed follow-up and missed actions contribute to avoidable admissions and poor continuity of care.",
    accent: "from-[#73BA27]/20 via-transparent to-transparent",
  },
];

export const stakeholderImpact: { name: string; detail: string }[] = [
  {
    name: "Patient",
    detail: "Delayed intervention, mounting anxiety, and preventable deterioration.",
  },
  {
    name: "Nephrologist",
    detail: "Blind spots between visits and reactive care instead of proactive triage.",
  },
  {
    name: "Hospital",
    detail: "ER overload, patient retention loss, and revenue leakage from fragmented follow-up.",
  },
];

export const comparisonRows: [string, string, string][] = [
  ["Data aggregation", "Partial across siloed tools", "Labs, discharge, meds, and vitals in one place"],
  ["Source provenance", "Rarely available at point of care", "Excerpt, page, and timestamp for every extracted fact"],
  ["Explainable decision snapshot", "Manual chart review required", "Clinician-ready summary with reasons and next cues"],
  ["Configurable clinical rules", "Generic workflows", "Deterministic CKD logic aligned with reviewed protocols"],
  ["Audit trail", "Patchy follow-up visibility", "Acknowledgement, resolve flows, and complete accountability"],
  ["Video consult", "Commonly present", "Works alongside follow-up intelligence instead of replacing it"],
];

export const platformComponents: { title: string; description: string }[] = [
  {
    title: "Clinician Intelligence Console",
    description:
      "Single-screen clinical snapshot with CKD stage, risk tier, abnormal trends, and next-step cues.",
  },
  {
    title: "Extraction & Provenance Engine",
    description:
      "Converts discharge summaries, labs, and notes into structured facts with source text, page, and timestamp.",
  },
  {
    title: "Workflow Orchestration & Audit",
    description:
      "Tracks pending labs, review actions, and acknowledgement logs for auditable follow-up decisions.",
  },
];

export const workflowSteps: { step: string; title: string; description: string }[] = [
  {
    step: "01",
    title: "Data ingestion",
    description: "Labs, discharge summaries, medication lists, and vitals are gathered into one stream.",
  },
  {
    step: "02",
    title: "Structured extraction",
    description: "Clinical reports are transformed into usable fields with source-linked provenance.",
  },
  {
    step: "03",
    title: "Rule-based logic",
    description: "Deterministic CKD rules evaluate risk, deterioration, and pending actions.",
  },
  {
    step: "04",
    title: "Snapshot generation",
    description: "A one-page explainable decision snapshot shows what changed and why it matters.",
  },
  {
    step: "05",
    title: "Clinician triage",
    description: "Flagged cases are reviewed quickly with a suggested next action for faster intervention.",
  },
  {
    step: "06",
    title: "Audit & follow-up",
    description: "Actions are acknowledged, resolved, and re-evaluated with a complete audit trail.",
  },
];

export const featureColumns: { category: string; badge: string; items: string[] }[] = [
  {
    category: "Clinician-facing",
    badge: "MVP",
    items: [
      "Explainable risk flags & CKD staging",
      "Document timeline & one-click source excerpts",
      "Follow-up & pending lab tracker",
    ],
  },
  {
    category: "Coordinator / Ops",
    badge: "Workflow",
    items: [
      "Task orchestration and visit preparation checklist",
      "Audit trail and documentation export",
      "Reminder-led coordination for follow-up readiness",
    ],
  },
  {
    category: "Patient support",
    badge: "Phase 2",
    items: [
      "Daily vitals logging and adherence reminders",
      "Device kit integration for BP and weight sync",
      "Structured patient guidance that supports clinician-led care",
    ],
  },
];

export const alertCards: { label: string; time: string; value: string; tone: string }[] = [
  { label: "Critical Alert", time: "2 min ago", value: "eGFR dropped to 28 — Stage 4 CKD threshold", tone: "text-rose-600" },
  { label: "Weight Alert", time: "1 hour ago", value: "+2.5kg in 3 days — possible fluid retention", tone: "text-amber-600" },
  { label: "Compliance", time: "Today", value: "All medications logged for past 7 days", tone: "text-emerald-600" },
];

export const pricingPlans: {
  key: string;
  name: string;
  annual: string;
  monthly: string;
  features: string[];
  emphasis: boolean;
}[] = [
  {
    key: "prescription",
    name: "Prescription + Hospital Workflow",
    annual: "₹1,20,000 / year",
    monthly: "₹10,000 / month",
    features: [
      "Digital prescriptions",
      "Pharmacy queue management",
      "Medication dropdown",
      "Clinic-branded printouts",
      "Support included",
    ],
    emphasis: false,
  },
  {
    key: "snapshot",
    name: "Hospital Workflow + CKD Snapshot",
    annual: "₹1,70,000 / year",
    monthly: "₹14,167 / month",
    features: [
      "All prescription features",
      "CKD follow-up dashboard",
      "Lab trend monitoring",
      "Patient app access",
      "Follow-up alerts",
    ],
    emphasis: true,
  },
];

export const teamMembers: {
  name: string;
  role: string;
  image: string;
  description: string;
  skills: string[];
  linkedin?: string;
  email?: string;
}[] = [
  {
    name: "Harish S",
    role: "Founder & CEO",
    image: "/harish-profile.png",
    description:
      "Building the future of chronic disease care through connected healthtech, decision layers, and scalable infrastructure.",
    skills: ["Biosensor & device integration", "Data analytics pipelines", "Clinical decision layers", "Scalable infrastructure"],
    linkedin: "https://www.linkedin.com/in/harish-s-espresso/",
    email: "harish@beanhealth.in",
  },
  {
    name: "Bonthu Jnani Venkata Ratna Kumar",
    role: "Full Stack Developer",
    image: "/jnani-profile.png",
    description: "Building robust backend systems and intuitive user interfaces for seamless patient care experiences.",
    skills: ["React", "Node.js", "MongoDB"],
    linkedin: "https://www.linkedin.com/in/bonthu-jnani-venkata-ratna-kumar-314874165/",
  },
  {
    name: "Saran Kathiravan",
    role: "Mobile & IoT Developer",
    image: "/saran-profile.png",
    description: "Developing mobile applications and device integrations for rapid health monitoring and follow-up workflows.",
    skills: ["Flutter", "IoT", "BLE"],
    linkedin: "https://www.linkedin.com/in/saran-kathiravan17/",
  },
];

export const ongoingProjects: {
  name: string;
  status: string;
  statusColor: string;
  description: string;
  tags: string[];
  progress: number;
}[] = [
  {
    name: "BeanHealth Mobile App",
    status: "In Development",
    statusColor: "amber",
    description:
      "Cross-platform Flutter app enabling patients to log vitals, view risk flags, and receive follow-up reminders — fully integrated with BLE biosensors.",
    tags: ["Flutter", "BLE", "IoT", "Push Notifications"],
    progress: 68,
  },
  {
    name: "CKD Risk Intelligence Engine",
    status: "Beta",
    statusColor: "green",
    description:
      "AI-powered module that stratifies chronic kidney disease risk from lab trends, flags deterioration early, and surfaces explainable decision provenance for clinicians.",
    tags: ["Machine Learning", "Python", "FastAPI", "FHIR"],
    progress: 85,
  },
  {
    name: "BeanHealth Ayush Screening Tool",
    status: "In Development",
    statusColor: "amber",
    description:
      "Training on large open-source anonymous patient datasets — lab values and nutrition patterns — to identify nephrolithiasis and renal lithiasis risk, and recommend personalised Ayurveda-based treatment protocols.",
    tags: ["ML / Deep Learning", "Python", "Nutrition Analytics", "Ayurveda", "Kidney Stones"],
    progress: 38,
  },
  {
    name: "BeanHealth CLR Screening Tool",
    status: "In Development",
    statusColor: "amber",
    description:
      "15-frame video analysis tool using MediaPipe and Python to detect the eye, analyse corneal light reflex (CLR), and identify squint eye deviations — enabling non-invasive strabismus screening in ophthalmology patients.",
    tags: ["MediaPipe", "Python", "Computer Vision", "Strabismus", "CLR Analysis"],
    progress: 52,
  },
];

export const valueItems: string[] = [
  "Reduced complication load and emergency admissions",
  "Faster patient triage and prioritisation",
  "Reduced clinician chart-review time",
  "Audit trail for follow-up accountability",
  "Clear daily patient guidance",
  "Organised reports, medication history, and care continuity",
];

export const differentiators: { title: string; description: string }[] = [
  {
    title: "Clinically validated",
    description: "Built from direct input of nephrologists and coordinators rather than generic telemedicine assumptions.",
  },
  {
    title: "CKD-specific platform",
    description: "Designed around renal workflows, not broad one-size-fits-all consult tooling.",
  },
  {
    title: "Explainable rule engine",
    description: "Deterministic, configurable logic that keeps clinical reasoning transparent.",
  },
  {
    title: "Workflow & accountability",
    description: "Acknowledge and resolve actions with timestamped visibility for the whole department.",
  },
];

export const deploymentModes: string[] = [
  "Hospital subscription",
  "Per-patient activation",
  "Enterprise licensing for multi-location chains",
  "Optional device kits add-on",
];
