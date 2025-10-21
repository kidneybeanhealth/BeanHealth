import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Prescription, PrescriptionMedication } from '../types';

interface PrescriptionPDFData {
  prescription: Prescription;
  doctorName: string;
  doctorSpecialty: string;
  patientName: string;
  patientAge?: string;
}

export class PDFGenerator {
  /**
   * Generate a prescription PDF
   */
  static generatePrescriptionPDF(data: PrescriptionPDFData): jsPDF {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    
    // Colors
    const primaryColor: [number, number, number] = [14, 165, 233]; // Sky blue
    const secondaryColor: [number, number, number] = [99, 102, 241]; // Indigo
    const textColor: [number, number, number] = [51, 65, 85]; // Slate gray
    const lightGray: [number, number, number] = [241, 245, 249];
    
    // Header with gradient effect (simulated with rectangles)
    doc.setFillColor(...primaryColor);
    doc.rect(0, 0, pageWidth, 40, 'F');
    doc.setFillColor(...secondaryColor);
    doc.rect(0, 0, pageWidth, 35, 'F');
    
    // Logo area (placeholder - you can add actual logo if available)
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(15, 10, 30, 20, 3, 3, 'F');
    doc.setFontSize(14);
    doc.setTextColor(14, 165, 233);
    doc.setFont('helvetica', 'bold');
    doc.text('BH', 23, 23);
    
    // App name
    doc.setFontSize(22);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text('BeanHealth', 50, 20);
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text('Healthcare Management Platform', 50, 27);
    
    // Title
    doc.setFontSize(18);
    doc.setTextColor(...textColor);
    doc.setFont('helvetica', 'bold');
    doc.text('PRESCRIPTION', pageWidth / 2, 55, { align: 'center' });
    
    // Doctor Information Box
    let yPos = 70;
    doc.setFillColor(...lightGray);
    doc.roundedRect(15, yPos, (pageWidth - 30) / 2 - 5, 30, 3, 3, 'F');
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryColor);
    doc.text('Doctor Information', 20, yPos + 7);
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...textColor);
    doc.setFontSize(9);
    doc.text(`Dr. ${data.doctorName}`, 20, yPos + 14);
    doc.text(data.doctorSpecialty, 20, yPos + 20);
    
    // Patient Information Box
    const patientBoxX = pageWidth / 2 + 5;
    doc.setFillColor(...lightGray);
    doc.roundedRect(patientBoxX, yPos, (pageWidth - 30) / 2 - 5, 30, 3, 3, 'F');
    
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryColor);
    doc.setFontSize(10);
    doc.text('Patient Information', patientBoxX + 5, yPos + 7);
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...textColor);
    doc.setFontSize(9);
    doc.text(data.patientName, patientBoxX + 5, yPos + 14);
    if (data.patientAge) {
      doc.text(`Age: ${data.patientAge}`, patientBoxX + 5, yPos + 20);
    }
    
    // Date
    yPos += 38;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...textColor);
    const date = new Date(data.prescription.createdAt);
    doc.text(`Date: ${date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })}`, 15, yPos);
    
    // Rx Symbol
    yPos += 10;
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryColor);
    doc.text('℞', 15, yPos);
    
    // Medications Header
    yPos += 5;
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...textColor);
    doc.text('Prescribed Medications', 27, yPos - 3);
    
    // Medications Table
    yPos += 2;
    const tableData = data.prescription.medications.map((med: PrescriptionMedication, index: number) => [
      (index + 1).toString(),
      med.name,
      med.dosage,
      med.frequency,
      med.duration,
      med.timing || '-',
      med.instructions || '-'
    ]);
    
    autoTable(doc, {
      startY: yPos,
      head: [['#', 'Medication', 'Dosage', 'Frequency', 'Duration', 'Timing', 'Instructions']],
      body: tableData,
      theme: 'grid',
      headStyles: {
        fillColor: primaryColor,
        textColor: [255, 255, 255],
        fontSize: 9,
        fontStyle: 'bold',
        halign: 'center'
      },
      bodyStyles: {
        fontSize: 8,
        textColor: textColor,
        cellPadding: 4
      },
      columnStyles: {
        0: { cellWidth: 10, halign: 'center' },
        1: { cellWidth: 35, fontStyle: 'bold' },
        2: { cellWidth: 25 },
        3: { cellWidth: 25 },
        4: { cellWidth: 20 },
        5: { cellWidth: 25 },
        6: { cellWidth: 'auto' }
      },
      alternateRowStyles: {
        fillColor: [249, 250, 251]
      },
      margin: { left: 15, right: 15 }
    });
    
    // Get Y position after table
    const finalY = (doc as any).lastAutoTable.finalY;
    yPos = finalY + 10;
    
    // Additional Notes
    if (data.prescription.notes && data.prescription.notes.trim()) {
      doc.setFillColor(...lightGray);
      doc.roundedRect(15, yPos, pageWidth - 30, 'auto' as any, 3, 3, 'F');
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(...primaryColor);
      doc.text('Additional Notes:', 20, yPos + 7);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(...textColor);
      const notes = doc.splitTextToSize(data.prescription.notes, pageWidth - 50);
      doc.text(notes, 20, yPos + 14);
      
      yPos += 10 + (notes.length * 5);
    }
    
    // Doctor's Signature Line
    yPos = Math.max(yPos + 15, pageHeight - 60);
    doc.setDrawColor(...textColor);
    doc.setLineWidth(0.5);
    doc.line(pageWidth - 80, yPos, pageWidth - 20, yPos);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...textColor);
    doc.text("Doctor's Signature", pageWidth - 50, yPos + 6, { align: 'center' });
    
    // Footer with logo and disclaimer
    const footerY = pageHeight - 30;
    doc.setDrawColor(...lightGray);
    doc.setLineWidth(0.5);
    doc.line(15, footerY - 5, pageWidth - 15, footerY - 5);
    
    // Logo in footer
    doc.setFillColor(...primaryColor);
    doc.circle(pageWidth / 2, footerY + 5, 8, 'F');
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text('BH', pageWidth / 2, footerY + 8, { align: 'center' });
    
    // Footer text
    doc.setFontSize(9);
    doc.setTextColor(...textColor);
    doc.setFont('helvetica', 'bold');
    doc.text('BeanHealth', pageWidth / 2, footerY + 18, { align: 'center' });
    
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text('Healthcare Management Platform', pageWidth / 2, footerY + 23, { align: 'center' });
    
    // Disclaimer
    doc.setFontSize(6);
    doc.setTextColor(148, 163, 184);
    doc.text(
      'This is a digitally generated prescription. Please verify all medications with your pharmacist.',
      pageWidth / 2,
      footerY + 28,
      { align: 'center' }
    );
    
    return doc;
  }
  
  /**
   * Generate and download prescription PDF
   */
  static downloadPrescriptionPDF(data: PrescriptionPDFData): void {
    const doc = this.generatePrescriptionPDF(data);
    const fileName = `Prescription_${data.patientName.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
  }
  
  /**
   * Generate and open prescription PDF in new tab
   */
  static previewPrescriptionPDF(data: PrescriptionPDFData): void {
    const doc = this.generatePrescriptionPDF(data);
    const pdfBlob = doc.output('blob');
    const pdfUrl = URL.createObjectURL(pdfBlob);
    window.open(pdfUrl, '_blank');
  }
  
  /**
   * Get PDF as blob for upload or sharing
   */
  static getPrescriptionPDFBlob(data: PrescriptionPDFData): Blob {
    const doc = this.generatePrescriptionPDF(data);
    return doc.output('blob');
  }
}
