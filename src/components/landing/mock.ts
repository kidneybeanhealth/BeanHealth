// Mock data for BeanHealth landing page

interface DemoSubmission {
    id: number;
    name: string;
    email: string;
    lookingFor: string;
    timestamp: string;
}

export const demoSubmissions: DemoSubmission[] = [];

export const submitDemoRequest = (formData: { name: string; email: string; lookingFor: string }) => {
    const submission = {
        id: Date.now(),
        ...formData,
        timestamp: new Date().toISOString()
    };
    demoSubmissions.push(submission);
    console.log('Demo request submitted:', submission);
    return { success: true, data: submission };
};

export const testimonials = [
    {
        id: 1,
        name: "Dr. Rajesh Kumar",
        role: "Senior Nephrologist, Apollo Hospitals",
        quote: "BeanHealth has transformed how we monitor our CKD patients. The rule-based classification and risk flag system helps us intervene early, reducing emergency admissions by 40%."
    },
    {
        id: 2,
        name: "Sister Priya Menon",
        role: "Transplant Coordinator, KIMS Hospital",
        quote: "Managing 400+ transplant follow-ups was overwhelming. BeanHealth's coordinator module automated our routines and improved patient compliance dramatically."
    },
    {
        id: 3,
        name: "Ramesh Patel",
        role: "CKD Stage 3 Patient",
        quote: "I feel more in control of my health now. Daily vitals tracking and instant feedback gives me peace of mind, and my doctor can see everything when needed."
    }
];

export const features = [
    {
        id: 1,
        title: "Smart CKD Staging & Classification",
        description: "Rule-based classification engine based on clinical guidelines and rapid patient data analysis"
    },
    {
        id: 2,
        title: "Daily-Vitals Analytics",
        description: "Continuous monitoring of BP, weight, urine output with trend analysis and insights"
    },
    {
        id: 3,
        title: "Medication Adherence",
        description: "Track compliance, set reminders, and monitor medication effectiveness over time"
    },
    {
        id: 4,
        title: "Red-Flag Alerts",
        description: "Instant notifications for critical changes requiring immediate clinical attention"
    },
    {
        id: 5,
        title: "Transplant Follow-Up Engine",
        description: "Automated post-transplant care routines with day-specific monitoring protocols"
    },
    {
        id: 6,
        title: "Dialysis Session Monitoring",
        description: "Track dialysis sessions, complications, and adjust treatment plans accordingly"
    },
    {
        id: 7,
        title: "Document Summary Timeline",
        description: "Organised view of all lab reports, prescriptions, and consultation notes"
    },
    {
        id: 8,
        title: "Hospital Workflow Automation",
        description: "Streamline coordinator tasks, follow-up scheduling, and patient communication"
    },
    {
        id: 9,
        title: "Kits & Home-Testing Integration",
        description: "Seamless integration with BP monitors, weighing scales, and diagnostic strips"
    }
];

export const problemStats = [
    {
        id: 1,
        title: "eGFR Decline Undetected",
        description: "Gradual kidney function loss missed between visits",
        icon: "TrendingDown"
    },
    {
        id: 2,
        title: "Fluid Overload Ignored",
        description: "Untracked weight and BP trends",
        icon: "Droplets"
    },
    {
        id: 3,
        title: "Post-Transplant Gaps",
        description: "Critical 90-day windows without structured monitoring",
        icon: "Calendar"
    },
    {
        id: 4,
        title: "Emergency Admission",
        description: "Preventable hospitalization from missed early signs",
        icon: "AlertTriangle"
    }
];

export const fragmentationIssues = [
    {
        id: 1,
        issue: "Creatinine Spikes Missed",
        description: "Labs done but trends not tracked between visits"
    },
    {
        id: 2,
        issue: "Medication Non-Adherence",
        description: "Immunosuppressants skipped without detection"
    },
    {
        id: 3,
        issue: "Vitals Lost in Chaos",
        description: "BP/weight data scattered across paper & phones"
    }
];

export const comparisonData = [
    {
        feature: "Data aggregation (labs + discharge + meds)",
        telemedicine: false,
        beanhealth: true
    },
    {
        feature: "Source provenance & excerpt",
        telemedicine: false,
        beanhealth: true
    },
    {
        feature: "Explainable decision snapshot",
        telemedicine: false,
        beanhealth: true
    },
    {
        feature: "Configurable clinical rules",
        telemedicine: false,
        beanhealth: true
    },
    {
        feature: "Audit trail for follow-up decisions",
        telemedicine: false,
        beanhealth: true
    },
    {
        feature: "Actionable next-step cues",
        telemedicine: false,
        beanhealth: true
    },
    {
        feature: "Patient video consult",
        telemedicine: true,
        beanhealth: true
    }
];

export const workflowSteps = [
    {
        id: 1,
        title: "Data ingestion",
        description: "Labs, discharge summaries, medication lists, and vitals."
    },
    {
        id: 2,
        title: "Structured extraction",
        description: "Convert reports into structured clinical fields with source excerpts."
    },
    {
        id: 3,
        title: "Rule-based logic",
        description: "Deterministic CKD rules (guideline-driven) evaluate risk and pending actions."
    },
    {
        id: 4,
        title: "Snapshot generation",
        description: "One-page decision snapshot with reason and provenance."
    },
    {
        id: 5,
        title: "Clinician triage",
        description: "Auto-flagged cases for review with suggested next action."
    },
    {
        id: 6,
        title: "Audit & follow-up",
        description: "Acknowledge/resolve actions, trigger re-evaluation, store audit logs."
    }
];
