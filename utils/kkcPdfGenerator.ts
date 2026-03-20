import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { registerTamilFont, BILINGUAL_LABELS, isTamilFontLoaded } from './tamilFontHelper';

// ============================================
// HOSPITAL CONFIGURATION INTERFACE
// ============================================

export interface HospitalConfig {
    name: string;
    address: string;
    phone: string;
    emergencyPhone?: string;
    workingHours?: string;
    doctors?: Array<{ name: string; specialty: string }>;
    logoUrl?: string;
}

export const KKC_HOSPITAL_CONFIG: HospitalConfig = {
    name: 'KONGUNAD KIDNEY CENTRE',
    address: 'Coimbatore - 641 012',
    phone: '0422 - 2494333, 73588 41555, 73588 41666',
    emergencyPhone: '0422 4316000',
    workingHours: '8:00 am to 6:00 pm',
    doctors: [
        { name: 'Dr. A. Prabhakar', specialty: 'MD., C.Diab. DNB (Nephro)' },
        { name: 'Dr. A. Divakar', specialty: 'MS., M.ch., (Uro)' },
    ],
};

// ============================================
// PRESCRIPTION DATA INTERFACE
// ============================================

export interface KKCPatientInfo {
    name: string;
    fatherOrHusband?: string;
    place?: string;
    phone?: string;
    age: string;
    gender: 'M' | 'F';
    regNo?: string;
    drugAllergy?: string;
    diagnosis?: string;
}

export interface KKCMedication {
    name: string;
    quantity?: number | string;
    morning?: string;
    noon?: string;
    night?: string;
    timing: 'B/F' | 'A/F' | 'With Food' | '';
}

export interface KKCFollowUp {
    reviewDate: string;
    testsOnReview?: string;
    specialistsToSee?: string;
}

export interface KKCPrescriptionData {
    patient: KKCPatientInfo;
    medications: KKCMedication[];
    followUp: KKCFollowUp;
    doctor: { name: string; specialty: string };
    date: Date;
    hospitalConfig?: HospitalConfig;
}

// ============================================
// KKC PDF GENERATOR CLASS (Bilingual)
// ============================================

export class KKCPDFGenerator {
    private doc: jsPDF;
    private pageWidth: number;
    private pageHeight: number;
    private margin: number = 12;
    private config: HospitalConfig;
    private tamilFontReady: boolean = false;

    private colors = {
        primary: [0, 51, 102] as [number, number, number],
        text: [0, 0, 0] as [number, number, number],
        gray: [100, 100, 100] as [number, number, number],
    };

    constructor(config: HospitalConfig = KKC_HOSPITAL_CONFIG) {
        this.doc = new jsPDF();
        this.pageWidth = this.doc.internal.pageSize.getWidth();
        this.pageHeight = this.doc.internal.pageSize.getHeight();
        this.config = config;
    }

    async initTamilFont(): Promise<void> {
        try {
            await registerTamilFont(this.doc);
            this.tamilFontReady = true;
        } catch (error) {
            console.warn('Tamil font not available, using English only');
            this.tamilFontReady = false;
        }
    }

    async generatePrescriptionAsync(data: KKCPrescriptionData): Promise<jsPDF> {
        const config = data.hospitalConfig || this.config;
        this.doc = new jsPDF();
        await this.initTamilFont();

        const medCount = data.medications.filter(m => m.name).length;
        let yPos = this.margin;
        yPos = this.drawHeader(config, yPos);
        yPos = this.drawPatientInfo(data.patient, data.date, yPos);
        yPos = this.drawPrescriptionTitle(yPos);
        yPos = this.drawMedicationsTable(data.medications, yPos);
        yPos = this.drawFollowUpSection(data.followUp, yPos, medCount);
        this.drawSignatureArea(medCount);
        this.drawFooter(config, medCount);
        return this.doc;
    }

    generatePrescription(data: KKCPrescriptionData): jsPDF {
        const config = data.hospitalConfig || this.config;
        this.doc = new jsPDF();
        const medCount = data.medications.filter(m => m.name).length;
        let yPos = this.margin;
        yPos = this.drawHeader(config, yPos);
        yPos = this.drawPatientInfo(data.patient, data.date, yPos);
        yPos = this.drawPrescriptionTitle(yPos);
        yPos = this.drawMedicationsTable(data.medications, yPos);
        yPos = this.drawFollowUpSection(data.followUp, yPos, medCount);
        this.drawSignatureArea(medCount);
        this.drawFooter(config, medCount);
        return this.doc;
    }

    private drawHeader(config: HospitalConfig, yPos: number): number {
        this.doc.setDrawColor(...this.colors.primary);
        this.doc.setLineWidth(1.5);
        this.doc.circle(22, yPos + 10, 9);
        this.doc.setLineWidth(2);
        this.doc.line(22, yPos + 5, 22, yPos + 15);
        this.doc.line(16, yPos + 10, 28, yPos + 10);

        this.doc.setFontSize(16);
        this.doc.setFont('helvetica', 'bold');
        this.doc.setTextColor(...this.colors.primary);
        this.doc.text(config.name, 38, yPos + 9);

        this.doc.setFontSize(10);
        this.doc.setFont('helvetica', 'normal');
        this.doc.text(config.address, this.pageWidth - this.margin, yPos + 9, { align: 'right' });

        yPos += 22;
        this.doc.setDrawColor(0, 0, 0);
        this.doc.setLineWidth(0.5);
        this.doc.line(this.margin, yPos, this.pageWidth - this.margin, yPos);
        return yPos + 3;
    }

    private renderLabel(label: { en: string; ta: string }, x: number, y: number): number {
        this.doc.setFont('helvetica', 'bold');
        this.doc.setFontSize(8);
        this.doc.text(label.en, x, y);
        const enWidth = this.doc.getTextWidth(label.en);

        if (this.tamilFontReady) {
            try {
                this.doc.setFont('NotoSansTamil', 'normal');
                this.doc.setFontSize(7);
                this.doc.text(` / ${label.ta}`, x + enWidth, y);
            } catch (e) { }
        }

        this.doc.setFont('helvetica', 'normal');
        this.doc.setFontSize(9);
        return enWidth + (this.tamilFontReady ? 20 : 0);
    }

    private drawPatientInfo(patient: KKCPatientInfo, date: Date, yPos: number): number {
        const leftCol = this.margin;
        const midCol = this.pageWidth / 2 + 5;
        const labelWidth = 40;
        const lineHeight = 8;
        const boxStartY = yPos;

        this.doc.setFontSize(8);
        this.doc.setTextColor(...this.colors.text);

        this.renderLabel(BILINGUAL_LABELS.NAME, leftCol + 2, yPos + 5);
        this.doc.setFont('helvetica', 'normal');
        this.doc.text(patient.name || '', leftCol + labelWidth, yPos + 5);

        yPos += lineHeight;
        this.renderLabel(BILINGUAL_LABELS.FATHER_HUSBAND, leftCol + 2, yPos + 5);
        this.doc.setFont('helvetica', 'normal');
        this.doc.text(patient.fatherOrHusband || '', leftCol + labelWidth + 20, yPos + 5);

        yPos += lineHeight;
        this.renderLabel(BILINGUAL_LABELS.PLACE, leftCol + 2, yPos + 5);
        this.doc.setFont('helvetica', 'normal');
        this.doc.text(patient.place || '', leftCol + labelWidth, yPos + 5);

        yPos += lineHeight;
        this.renderLabel(BILINGUAL_LABELS.PHONE, leftCol + 2, yPos + 5);
        this.doc.setFont('helvetica', 'normal');
        this.doc.text(patient.phone || '', leftCol + labelWidth, yPos + 5);

        yPos += lineHeight;
        this.renderLabel(BILINGUAL_LABELS.DRUG_ALLERGY, leftCol + 2, yPos + 5);
        this.doc.setFont('helvetica', 'normal');
        this.doc.text(patient.drugAllergy || '', leftCol + labelWidth + 10, yPos + 5);

        yPos += lineHeight;
        this.renderLabel(BILINGUAL_LABELS.DIAGNOSIS, leftCol + 2, yPos + 5);
        this.doc.setFont('helvetica', 'normal');
        this.doc.text(patient.diagnosis || '', leftCol + labelWidth + 5, yPos + 5);

        let rightY = boxStartY;
        this.renderLabel(BILINGUAL_LABELS.AGE, midCol + 2, rightY + 5);
        this.doc.setFont('helvetica', 'normal');
        this.doc.text(`${patient.age} / ${patient.gender}`, midCol + 35, rightY + 5);

        rightY += lineHeight;
        this.doc.setFont('helvetica', 'bold');
        this.doc.text('REG. No.', midCol + 2, rightY + 5);
        this.doc.setFont('helvetica', 'normal');
        this.doc.text(patient.regNo || '', midCol + 30, rightY + 5);

        rightY += lineHeight;
        const formattedDate = date.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
        this.doc.setFont('helvetica', 'bold');
        this.doc.text('DATE', midCol + 2, rightY + 5);
        this.doc.setFont('helvetica', 'normal');
        this.doc.text(formattedDate, midCol + 30, rightY + 5);

        const boxHeight = lineHeight * 6 + 3;
        this.doc.setDrawColor(0, 0, 0);
        this.doc.setLineWidth(0.3);
        this.doc.rect(this.margin, boxStartY, this.pageWidth - 2 * this.margin, boxHeight);
        this.doc.line(this.pageWidth / 2, boxStartY, this.pageWidth / 2, boxStartY + boxHeight);

        for (let i = 1; i <= 5; i++) {
            this.doc.line(this.margin, boxStartY + i * lineHeight, this.pageWidth / 2, boxStartY + i * lineHeight);
        }
        this.doc.line(this.pageWidth / 2, boxStartY + lineHeight, this.pageWidth - this.margin, boxStartY + lineHeight);
        this.doc.line(this.pageWidth / 2, boxStartY + 2 * lineHeight, this.pageWidth - this.margin, boxStartY + 2 * lineHeight);

        return boxStartY + boxHeight + 5;
    }

    private drawPrescriptionTitle(yPos: number): number {
        this.doc.setFontSize(10);
        this.doc.setFont('helvetica', 'bold');
        this.doc.setTextColor(...this.colors.text);
        const title = 'MEDICINES PRESCRIPTION DETAILS';
        this.doc.text(title, this.pageWidth / 2, yPos, { align: 'center' });
        const textWidth = this.doc.getTextWidth(title);
        this.doc.setLineWidth(0.5);
        this.doc.line((this.pageWidth - textWidth) / 2, yPos + 1, (this.pageWidth + textWidth) / 2, yPos + 1);
        return yPos + 5;
    }

    private drawMedicationsTable(medications: KKCMedication[], yPos: number): number {
        const headers = [['S/No.', 'DRUGS', 'Number', 'Morning', 'Noon', 'Night', 'B/F\nA/F']];
        const tableData: string[][] = [];
        for (let i = 0; i < 12; i++) {
            if (i < medications.length && medications[i].name) {
                const med = medications[i];
                tableData.push([
                    (i + 1).toString(), med.name, med.quantity?.toString() || '',
                    med.morning || '', med.noon || '', med.night || '', med.timing || ''
                ]);
            } else {
                tableData.push([(i + 1).toString(), '', '', '', '', '', '']);
            }
        }

        autoTable(this.doc, {
            startY: yPos, head: headers, body: tableData, theme: 'grid',
            styles: { fontSize: 8, cellPadding: 1.5, lineColor: [0, 0, 0], lineWidth: 0.3, textColor: [0, 0, 0] },
            headStyles: { fillColor: [255, 255, 255], textColor: [0, 0, 0], fontStyle: 'bold', halign: 'center', valign: 'middle' },
            bodyStyles: { halign: 'center', valign: 'middle', minCellHeight: 6.5 },
            columnStyles: {
                0: { cellWidth: 15, halign: 'center' }, 1: { cellWidth: 55, halign: 'left' },
                2: { cellWidth: 22, halign: 'center' }, 3: { cellWidth: 22, halign: 'center' },
                4: { cellWidth: 22, halign: 'center' }, 5: { cellWidth: 22, halign: 'center' },
                6: { cellWidth: 22, halign: 'center' },
            },
            margin: { left: this.margin, right: this.margin },
        });
        return (this.doc as any).lastAutoTable.finalY + 5;
    }

    private drawFollowUpSection(followUp: KKCFollowUp, yPos: number, medCount: number = 5): number {
        const labelX = this.margin;
        const valueX = 75;
        // Updated: Scaling now starts at 5 medications to prevent overflow
        const lineHeight = medCount <= 4 ? 9 : medCount <= 6 ? 7.5 : medCount <= 8 ? 6.5 : 5.5;
        const fontSize = medCount <= 4 ? 8 : medCount <= 6 ? 7.5 : medCount <= 8 ? 7 : 6.5;

        this.doc.setFontSize(fontSize);
        this.doc.setTextColor(...this.colors.text);

        this.doc.setFont('helvetica', 'bold');
        this.doc.text('To Come for review on', labelX, yPos);
        this.doc.setFont('helvetica', 'normal');
        let reviewDateStr = followUp.reviewDate || '';
        if (reviewDateStr) {
            try { reviewDateStr = new Date(reviewDateStr).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' }); } catch { }
        }
        this.doc.text(reviewDateStr, valueX, yPos);
        this.doc.line(valueX, yPos + 1, this.pageWidth - this.margin - 60, yPos + 1);

        yPos += lineHeight;
        this.doc.setFont('helvetica', 'bold');
        this.doc.text('Tests to be done on review', labelX, yPos);
        this.doc.setFont('helvetica', 'normal');
        this.doc.text(followUp.testsOnReview || '', valueX, yPos);
        this.doc.line(valueX, yPos + 1, this.pageWidth - this.margin - 60, yPos + 1);

        yPos += lineHeight;
        this.doc.setFont('helvetica', 'bold');
        this.doc.text('Specialists to be seen on review', labelX, yPos);
        this.doc.setFont('helvetica', 'normal');
        this.doc.text(followUp.specialistsToSee || '', valueX + 5, yPos);
        this.doc.line(valueX + 5, yPos + 1, this.pageWidth - this.margin - 60, yPos + 1);

        const bottomMargin = medCount <= 5 ? 3 : medCount <= 9 ? 2 : 1.5;
        return yPos + lineHeight + bottomMargin;
    }

    private drawSignatureArea(medCount: number = 5): void {
        // Increased signature space for 7-12 medications (baseY)
        const baseY = medCount <= 4 ? 75 : medCount <= 6 ? 68 : medCount <= 9 ? 65 : 62;
        const sigX = this.pageWidth - this.margin - 50;
        const sigY = this.pageHeight - baseY;
        const fontSize = medCount <= 4 ? 8 : medCount <= 6 ? 7.5 : medCount <= 9 ? 7 : 6.5;

        this.doc.setFontSize(fontSize);
        this.doc.setFont('helvetica', 'normal');
        this.doc.setTextColor(...this.colors.text);
        this.doc.line(sigX, sigY, sigX + 45, sigY);
        this.doc.setFont('helvetica', 'bold');
        this.doc.text('DOCTOR SIGNATURE', sigX + 22.5, sigY + 4, { align: 'center' });
    }

    private drawFooter(config: HospitalConfig, medCount: number = 5): void {
        // Compressed footer slightly more to allot more signature space for 7-12 meds
        const baseFooterY = medCount <= 4 ? 40 : medCount <= 6 ? 35 : medCount <= 9 ? 28 : 24;
        const footerY = this.pageHeight - baseFooterY;
        const mainFontSize = medCount <= 4 ? 7 : medCount <= 6 ? 6.5 : medCount <= 9 ? 6 : 5.5;
        const lineSpacing = medCount <= 4 ? 4 : medCount <= 6 ? 3.5 : medCount <= 9 ? 2.8 : 2.4;
        const docSpacing = medCount <= 4 ? 3.5 : medCount <= 6 ? 3 : medCount <= 9 ? 2.3 : 2;

        this.doc.setFontSize(mainFontSize);
        this.doc.setTextColor(...this.colors.text);
        this.doc.setDrawColor(0, 0, 0);
        this.doc.setLineWidth(0.3);
        this.doc.line(this.margin, footerY - 3, this.pageWidth - this.margin, footerY - 3);

        this.doc.setFont('helvetica', 'normal');
        this.doc.text('Prior registration will confirm availability of the specialist and avoid delay', this.pageWidth / 2, footerY, { align: 'center' });
        this.doc.setFont('helvetica', 'bold');
        this.doc.text(`For Specialist appointment: ${config.phone}`, this.pageWidth / 2, footerY + lineSpacing, { align: 'center' });

        if (config.workingHours) {
            this.doc.setFont('helvetica', 'normal');
            this.doc.text(`Time: ${config.workingHours}`, this.pageWidth / 2, footerY + lineSpacing * 2, { align: 'center' });
        }

        if (config.doctors && config.doctors.length > 0) {
            let docY = footerY + lineSpacing * 3;
            config.doctors.forEach((doc) => {
                this.doc.text(`${doc.name} ${doc.specialty}`, this.pageWidth / 2, docY, { align: 'center' });
                docY += docSpacing;
            });
        }

        if (config.emergencyPhone) {
            this.doc.setFont('helvetica', 'bold');
            const emergencyY = footerY + lineSpacing * 3 + docSpacing * 2 + 2;
            this.doc.text(`Emergency Contact / Phone: ${config.emergencyPhone}`, this.pageWidth / 2, emergencyY, { align: 'center' });
        }
        this.doc.setFontSize(mainFontSize + 0.5);
        const finalY = footerY + lineSpacing * 3 + docSpacing * 2 + (medCount <= 5 ? 6 : medCount <= 9 ? 5 : 4);
        this.doc.text('For Emergency cases 24 hrs Service', this.pageWidth / 2, finalY, { align: 'center' });
    }

    // Output methods
    download(data: KKCPrescriptionData, filename?: string): void {
        const doc = this.generatePrescription(data);
        const name = filename || `Prescription_${data.patient.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
        doc.save(name);
    }

    preview(data: KKCPrescriptionData): void {
        const doc = this.generatePrescription(data);
        window.open(doc.output('bloburl'), '_blank');
    }

    getBlob(data: KKCPrescriptionData): Blob {
        return this.generatePrescription(data).output('blob');
    }

    print(data: KKCPrescriptionData): void {
        const doc = this.generatePrescription(data);
        const printWindow = window.open(doc.output('bloburl'), '_blank');
        if (printWindow) { printWindow.onload = () => printWindow.print(); }
    }

    // Bilingual async methods
    async downloadBilingual(data: KKCPrescriptionData, filename?: string): Promise<void> {
        const doc = await this.generatePrescriptionAsync(data);
        const name = filename || `Prescription_${data.patient.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
        doc.save(name);
    }

    async previewBilingual(data: KKCPrescriptionData): Promise<void> {
        const doc = await this.generatePrescriptionAsync(data);
        window.open(doc.output('bloburl'), '_blank');
    }

    async printBilingual(data: KKCPrescriptionData): Promise<void> {
        const doc = await this.generatePrescriptionAsync(data);
        const printWindow = window.open(doc.output('bloburl'), '_blank');
        if (printWindow) { printWindow.onload = () => printWindow.print(); }
    }
}

export const kkcPdfGenerator = new KKCPDFGenerator();
