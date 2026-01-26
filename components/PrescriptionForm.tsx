import React, { useState, useRef } from 'react';

interface PrescriptionMedicine {
    id: string;
    name: string;
    quantity: string;
    morning: boolean;
    noon: boolean;
    night: boolean;
    timing: 'BF' | 'AF'; // Before Food / After Food
}

interface PrescriptionData {
    patientName: string;
    age: string;
    gender: 'M' | 'F';
    fatherHusband: string;
    place: string;
    phone: string;
    regNo: string;
    date: string;
    drugAllergy: string;
    diagnosis: string;
    medicines: PrescriptionMedicine[];
    reviewDate: string;
    testsOnReview: string;
    specialistsToSee: string;
    doctorName: string;
    doctorQualification: string;
}

interface PrescriptionFormProps {
    clinicName: string;
    clinicLogo: string | null;
    clinicLocation: string;
    clinicPhone: string;
    clinicEmergency: string;
    doctorName: string;
    doctorSpecialty: string;
    onClose: () => void;
    onSendToPharmacy: (data: PrescriptionData) => void;
    onSendToPatient: (data: PrescriptionData) => void;
}

const PrescriptionForm: React.FC<PrescriptionFormProps> = ({
    clinicName,
    clinicLogo,
    clinicLocation,
    clinicPhone,
    clinicEmergency,
    doctorName,
    doctorSpecialty,
    onClose,
    onSendToPharmacy,
    onSendToPatient
}) => {
    const printRef = useRef<HTMLDivElement>(null);
    const [prescription, setPrescription] = useState<PrescriptionData>({
        patientName: '',
        age: '',
        gender: 'M',
        fatherHusband: '',
        place: '',
        phone: '',
        regNo: `RX${Date.now().toString().slice(-6)}`,
        date: new Date().toLocaleDateString('en-IN'),
        drugAllergy: '',
        diagnosis: '',
        medicines: [
            { id: '1', name: '', quantity: '', morning: false, noon: false, night: false, timing: 'AF' }
        ],
        reviewDate: '',
        testsOnReview: '',
        specialistsToSee: '',
        doctorName: doctorName,
        doctorQualification: doctorSpecialty
    });

    const addMedicine = () => {
        setPrescription({
            ...prescription,
            medicines: [
                ...prescription.medicines,
                { id: Date.now().toString(), name: '', quantity: '', morning: false, noon: false, night: false, timing: 'AF' }
            ]
        });
    };

    const updateMedicine = (id: string, field: keyof PrescriptionMedicine, value: string | boolean) => {
        setPrescription({
            ...prescription,
            medicines: prescription.medicines.map(med =>
                med.id === id ? { ...med, [field]: value } : med
            )
        });
    };

    const removeMedicine = (id: string) => {
        if (prescription.medicines.length > 1) {
            setPrescription({
                ...prescription,
                medicines: prescription.medicines.filter(med => med.id !== id)
            });
        }
    };

    const handlePrint = () => {
        // Generate print-friendly HTML matching KKC template
        const medicineRows = prescription.medicines.map((med, idx) => `
            <tr>
                <td style="text-align: center; border: 1px solid #000; padding: 8px;">${idx + 1}</td>
                <td style="border: 1px solid #000; padding: 8px;">${med.name || ''}</td>
                <td style="text-align: center; border: 1px solid #000; padding: 8px;">${med.quantity || ''}</td>
                <td style="text-align: center; border: 1px solid #000; padding: 8px;">${med.morning ? '✓' : ''}</td>
                <td style="text-align: center; border: 1px solid #000; padding: 8px;">${med.noon ? '✓' : ''}</td>
                <td style="text-align: center; border: 1px solid #000; padding: 8px;">${med.night ? '✓' : ''}</td>
                <td style="text-align: center; border: 1px solid #000; padding: 8px;">${med.timing === 'BF' ? 'சா.மு/B/F' : 'சா.பி/A/F'}</td>
            </tr>
        `).join('');

        // Add empty rows to make 10 total
        const emptyRowsNeeded = Math.max(0, 10 - prescription.medicines.length);
        const emptyRows = Array(emptyRowsNeeded).fill('').map((_, idx) => `
            <tr>
                <td style="text-align: center; border: 1px solid #000; padding: 8px; height: 30px;">${prescription.medicines.length + idx + 1}</td>
                <td style="border: 1px solid #000; padding: 8px;"></td>
                <td style="text-align: center; border: 1px solid #000; padding: 8px;"></td>
                <td style="text-align: center; border: 1px solid #000; padding: 8px;"></td>
                <td style="text-align: center; border: 1px solid #000; padding: 8px;"></td>
                <td style="text-align: center; border: 1px solid #000; padding: 8px;"></td>
                <td style="text-align: center; border: 1px solid #000; padding: 8px;"></td>
            </tr>
        `).join('');

        const printHTML = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Prescription - ${prescription.patientName || 'Patient'}</title>
                <style>
                    @page { 
                        size: A4; 
                        margin: 15mm; 
                    }
                    * { 
                        box-sizing: border-box; 
                        margin: 0; 
                        padding: 0; 
                    }
                    body { 
                        font-family: Arial, sans-serif; 
                        font-size: 12px; 
                        line-height: 1.4;
                        color: #000;
                    }
                    .container {
                        max-width: 100%;
                        padding: 10px;
                    }
                    .header {
                        text-align: center;
                        border-bottom: 2px solid #000;
                        padding-bottom: 10px;
                        margin-bottom: 15px;
                    }
                    .header h1 {
                        font-size: 22px;
                        font-weight: bold;
                        text-transform: uppercase;
                        letter-spacing: 2px;
                        margin-bottom: 5px;
                    }
                    .header p {
                        font-size: 11px;
                        color: #333;
                    }
                    .patient-grid {
                        display: table;
                        width: 100%;
                        border-collapse: collapse;
                        margin-bottom: 15px;
                    }
                    .patient-row {
                        display: table-row;
                    }
                    .patient-cell {
                        display: table-cell;
                        border: 1px solid #000;
                        padding: 6px 8px;
                        vertical-align: top;
                        width: 33.33%;
                    }
                    .patient-label {
                        font-size: 10px;
                        color: #666;
                        margin-bottom: 2px;
                    }
                    .patient-value {
                        font-size: 12px;
                        font-weight: 500;
                    }
                    .section-title {
                        font-size: 14px;
                        font-weight: bold;
                        text-align: center;
                        margin: 15px 0 10px;
                        border-top: 1px solid #000;
                        border-bottom: 1px solid #000;
                        padding: 8px 0;
                    }
                    table.medicines {
                        width: 100%;
                        border-collapse: collapse;
                        margin-bottom: 15px;
                    }
                    table.medicines th {
                        border: 1px solid #000;
                        padding: 8px 4px;
                        background: #f5f5f5;
                        font-size: 11px;
                        text-align: center;
                        vertical-align: middle;
                    }
                    table.medicines td {
                        border: 1px solid #000;
                        padding: 6px;
                        font-size: 11px;
                    }
                    .footer-section {
                        margin-top: 15px;
                        border: 1px solid #000;
                        padding: 10px;
                    }
                    .footer-row {
                        margin-bottom: 8px;
                    }
                    .footer-label {
                        font-size: 10px;
                        color: #666;
                    }
                    .footer-value {
                        font-size: 12px;
                        border-bottom: 1px dotted #999;
                        min-height: 20px;
                        padding: 2px 0;
                    }
                    .signature-section {
                        margin-top: 30px;
                        text-align: right;
                    }
                    .signature-line {
                        width: 200px;
                        border-bottom: 1px solid #000;
                        margin-left: auto;
                        height: 40px;
                    }
                    .signature-text {
                        font-size: 12px;
                        text-align: right;
                    }
                    .signature-name {
                        font-weight: bold;
                    }
                    @media print {
                        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <!-- Header -->
                    <div class="header">
                        <h1>${clinicName}</h1>
                        <p>${clinicLocation}</p>
                        <p style="margin-top: 5px;">தொலைபேசி / Phone: ${clinicPhone} | அவசர உதவி / Emergency: ${clinicEmergency}</p>
                    </div>

                    <!-- Patient Details -->
                    <div class="patient-grid">
                        <div class="patient-row">
                            <div class="patient-cell">
                                <div class="patient-label">பெயர் / NAME</div>
                                <div class="patient-value">${prescription.patientName || ''}</div>
                            </div>
                            <div class="patient-cell">
                                <div class="patient-label">வயது / அ/பெ AGE / M/F</div>
                                <div class="patient-value">${prescription.age || ''} / ${prescription.gender === 'M' ? 'ஆண்' : 'பெண்'}</div>
                            </div>
                            <div class="patient-cell">
                                <div class="patient-label">பதிவு எண் / REG. No.</div>
                                <div class="patient-value">${prescription.regNo || ''}</div>
                            </div>
                        </div>
                        <div class="patient-row">
                            <div class="patient-cell">
                                <div class="patient-label">தந்தை/கணவர் / FATHER/HUSBAND</div>
                                <div class="patient-value">${prescription.fatherHusband || ''}</div>
                            </div>
                            <div class="patient-cell">
                                <div class="patient-label">ஊர் / PLACE</div>
                                <div class="patient-value">${prescription.place || ''}</div>
                            </div>
                            <div class="patient-cell">
                                <div class="patient-label">தேதி / DATE</div>
                                <div class="patient-value">${prescription.date || ''}</div>
                            </div>
                        </div>
                        <div class="patient-row">
                            <div class="patient-cell">
                                <div class="patient-label">போன் / PHONE</div>
                                <div class="patient-value">${prescription.phone || ''}</div>
                            </div>
                            <div class="patient-cell">
                                <div class="patient-label">மருந்து அலர்ஜி / Drug Allergy</div>
                                <div class="patient-value">${prescription.drugAllergy || ''}</div>
                            </div>
                            <div class="patient-cell">
                                <div class="patient-label">நோயறிவு / Diagnosis</div>
                                <div class="patient-value">${prescription.diagnosis || ''}</div>
                            </div>
                        </div>
                    </div>

                    <!-- Medicines Section -->
                    <div class="section-title">மருந்துகள் பரிந்துரை விபரம் – MEDICINES PRESCRIPTION DETAILS</div>
                    
                    <table class="medicines">
                        <thead>
                            <tr>
                                <th style="width: 40px;">வ/எண்<br><span style="font-weight: normal; font-size: 9px;">S/No.</span></th>
                                <th>மருந்துகள்<br><span style="font-weight: normal; font-size: 9px;">DRUGS</span></th>
                                <th style="width: 60px;">எண்ணிக்கை<br><span style="font-weight: normal; font-size: 9px;">Number</span></th>
                                <th style="width: 50px;">காலை<br><span style="font-weight: normal; font-size: 9px;">Morning</span></th>
                                <th style="width: 50px;">மதியம்<br><span style="font-weight: normal; font-size: 9px;">Noon</span></th>
                                <th style="width: 50px;">இரவு<br><span style="font-weight: normal; font-size: 9px;">Night</span></th>
                                <th style="width: 70px;">சா.மு/சா.பி<br><span style="font-weight: normal; font-size: 9px;">B/F - A/F</span></th>
                            </tr>
                        </thead>
                        <tbody>
                            ${medicineRows}
                            ${emptyRows}
                        </tbody>
                    </table>

                    <!-- Follow-up Section -->
                    <div class="footer-section">
                        <div class="footer-row">
                            <div class="footer-label">மீண்டும் வரவேண்டிய நாள் / To Come for review on</div>
                            <div class="footer-value">${prescription.reviewDate || ''}</div>
                        </div>
                        <div class="footer-row">
                            <div class="footer-label">மீண்டும் வருங்போது செய்ய வேண்டிய பரிசோதனைகள் / Tests to be done on review</div>
                            <div class="footer-value">${prescription.testsOnReview || ''}</div>
                        </div>
                        <div class="footer-row">
                            <div class="footer-label">மீண்டும் வருங்போது பார்க்க வேண்டிய சிறப்பு டாக்டர் / Specialists to be seen on review</div>
                            <div class="footer-value">${prescription.specialistsToSee || ''}</div>
                        </div>
                    </div>

                    <!-- Signature -->
                    <div class="signature-section">
                        <div class="signature-line"></div>
                        <div class="signature-text">
                            <div class="signature-name">${prescription.doctorName}</div>
                            <div>${prescription.doctorQualification}</div>
                            <div style="font-size: 10px; color: #666;">டாக்டர் கையொப்பம் / DOCTOR SIGNATURE</div>
                        </div>
                    </div>
                </div>
            </body>
            </html>
        `;

        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write(printHTML);
            printWindow.document.close();
            printWindow.focus();
            setTimeout(() => printWindow.print(), 250);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header with back button */}
            <div className="flex items-center justify-between">
                <button
                    onClick={onClose}
                    className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Back to Dashboard
                </button>
                <h2 className="text-xl font-bold text-gray-900">
                    மருந்து சீட்டு / Prescription
                </h2>
            </div>

            {/* Prescription Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

                {/* Prescription Content */}
                <div ref={printRef} className="p-6">
                    {/* Clinic Header */}
                    <div className="text-center mb-6 pb-4 border-b-2 border-gray-300">
                        <div className="flex items-center justify-center gap-4 mb-2">
                            {clinicLogo ? (
                                <img src={clinicLogo} alt="" className="w-16 h-16 object-contain" />
                            ) : (
                                <div className="w-16 h-16 rounded-xl bg-primary-100 flex items-center justify-center">
                                    <span className="text-2xl font-bold text-primary-600">{clinicName.charAt(0)}</span>
                                </div>
                            )}
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900 uppercase tracking-wide">{clinicName}</h1>
                                <p className="text-sm text-gray-600">{clinicLocation}</p>
                            </div>
                        </div>
                        <p className="text-xs text-gray-500">
                            தொலைபேசி / Phone: {clinicPhone} | அவசர உதவி / Emergency: {clinicEmergency}
                        </p>
                    </div>

                    {/* Patient Details */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
                        <div className="col-span-2 md:col-span-1">
                            <label className="block text-xs font-medium text-gray-500 mb-1">
                                பெயர் / NAME
                            </label>
                            <input
                                type="text"
                                value={prescription.patientName}
                                onChange={(e) => setPrescription({ ...prescription, patientName: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">
                                வயது / AGE
                            </label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={prescription.age}
                                    onChange={(e) => setPrescription({ ...prescription, age: e.target.value })}
                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                    placeholder="வயது"
                                />
                                <select
                                    value={prescription.gender}
                                    onChange={(e) => setPrescription({ ...prescription, gender: e.target.value as 'M' | 'F' })}
                                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                                >
                                    <option value="M">ஆண்/M</option>
                                    <option value="F">பெண்/F</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">
                                பதிவு எண் / REG. No.
                            </label>
                            <input
                                type="text"
                                value={prescription.regNo}
                                onChange={(e) => setPrescription({ ...prescription, regNo: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                                readOnly
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">
                                தந்தை/கணவர் / FATHER/HUSBAND
                            </label>
                            <input
                                type="text"
                                value={prescription.fatherHusband}
                                onChange={(e) => setPrescription({ ...prescription, fatherHusband: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">
                                ஊர் / PLACE
                            </label>
                            <input
                                type="text"
                                value={prescription.place}
                                onChange={(e) => setPrescription({ ...prescription, place: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">
                                தேதி / DATE
                            </label>
                            <input
                                type="text"
                                value={prescription.date}
                                onChange={(e) => setPrescription({ ...prescription, date: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                                readOnly
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">
                                போன் / PHONE
                            </label>
                            <input
                                type="tel"
                                value={prescription.phone}
                                onChange={(e) => setPrescription({ ...prescription, phone: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">
                                மருந்து அலர்ஜி / Drug Allergy
                            </label>
                            <input
                                type="text"
                                value={prescription.drugAllergy}
                                onChange={(e) => setPrescription({ ...prescription, drugAllergy: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                            />
                        </div>
                        <div className="col-span-2 md:col-span-1">
                            <label className="block text-xs font-medium text-gray-500 mb-1">
                                நோயறிவு / Diagnosis
                            </label>
                            <input
                                type="text"
                                value={prescription.diagnosis}
                                onChange={(e) => setPrescription({ ...prescription, diagnosis: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                            />
                        </div>
                    </div>

                    {/* Medicines Table */}
                    <div className="mb-6">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="font-semibold text-gray-900">
                                மருந்துகள் பரிந்துரை விபரம் – MEDICINES PRESCRIPTION DETAILS
                            </h3>
                            <button
                                onClick={addMedicine}
                                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary-500 text-white rounded-lg hover:bg-primary-600"
                            >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                </svg>
                                Add
                            </button>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full border border-gray-300 text-sm">
                                <thead>
                                    <tr className="bg-gray-100">
                                        <th className="border border-gray-300 px-2 py-2 w-12">
                                            வ/எண்<br /><span className="text-xs font-normal">S/No.</span>
                                        </th>
                                        <th className="border border-gray-300 px-2 py-2">
                                            மருந்துகள்<br /><span className="text-xs font-normal">DRUGS</span>
                                        </th>
                                        <th className="border border-gray-300 px-2 py-2 w-20">
                                            எண்ணிக்கை<br /><span className="text-xs font-normal">Number</span>
                                        </th>
                                        <th className="border border-gray-300 px-2 py-2 w-16">
                                            காலை<br /><span className="text-xs font-normal">Morning</span>
                                        </th>
                                        <th className="border border-gray-300 px-2 py-2 w-16">
                                            மதியம்<br /><span className="text-xs font-normal">Noon</span>
                                        </th>
                                        <th className="border border-gray-300 px-2 py-2 w-16">
                                            இரவு<br /><span className="text-xs font-normal">Night</span>
                                        </th>
                                        <th className="border border-gray-300 px-2 py-2 w-24">
                                            சா.மு/சா.பி<br /><span className="text-xs font-normal">B/F - A/F</span>
                                        </th>
                                        <th className="border border-gray-300 px-2 py-2 w-10"></th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {prescription.medicines.map((med, index) => (
                                        <tr key={med.id}>
                                            <td className="border border-gray-300 px-2 py-1 text-center">{index + 1}</td>
                                            <td className="border border-gray-300 px-1 py-1">
                                                <input
                                                    type="text"
                                                    value={med.name}
                                                    onChange={(e) => updateMedicine(med.id, 'name', e.target.value)}
                                                    className="w-full px-2 py-1 border-0 focus:ring-1 focus:ring-primary-500 rounded"
                                                    placeholder="Medicine name"
                                                />
                                            </td>
                                            <td className="border border-gray-300 px-1 py-1">
                                                <input
                                                    type="text"
                                                    value={med.quantity}
                                                    onChange={(e) => updateMedicine(med.id, 'quantity', e.target.value)}
                                                    className="w-full px-2 py-1 border-0 focus:ring-1 focus:ring-primary-500 rounded text-center"
                                                />
                                            </td>
                                            <td className="border border-gray-300 px-1 py-1">
                                                <label className="flex items-center justify-center cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={med.morning}
                                                        onChange={(e) => updateMedicine(med.id, 'morning', e.target.checked)}
                                                        className="w-5 h-5 text-primary-500 border-gray-300 rounded focus:ring-primary-500 cursor-pointer"
                                                    />
                                                </label>
                                            </td>
                                            <td className="border border-gray-300 px-1 py-1">
                                                <label className="flex items-center justify-center cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={med.noon}
                                                        onChange={(e) => updateMedicine(med.id, 'noon', e.target.checked)}
                                                        className="w-5 h-5 text-primary-500 border-gray-300 rounded focus:ring-primary-500 cursor-pointer"
                                                    />
                                                </label>
                                            </td>
                                            <td className="border border-gray-300 px-1 py-1">
                                                <label className="flex items-center justify-center cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={med.night}
                                                        onChange={(e) => updateMedicine(med.id, 'night', e.target.checked)}
                                                        className="w-5 h-5 text-primary-500 border-gray-300 rounded focus:ring-primary-500 cursor-pointer"
                                                    />
                                                </label>
                                            </td>
                                            <td className="border border-gray-300 px-1 py-1">
                                                <select
                                                    value={med.timing}
                                                    onChange={(e) => updateMedicine(med.id, 'timing', e.target.value)}
                                                    className="w-full px-1 py-1 border-0 focus:ring-1 focus:ring-primary-500 rounded text-center text-xs"
                                                >
                                                    <option value="BF">சா.மு/B/F</option>
                                                    <option value="AF">சா.பி/A/F</option>
                                                </select>
                                            </td>
                                            <td className="border border-gray-300 px-1 py-1 text-center">
                                                <button
                                                    onClick={() => removeMedicine(med.id)}
                                                    className="text-red-500 hover:text-red-700"
                                                    disabled={prescription.medicines.length === 1}
                                                >
                                                    ✕
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Follow-up Section */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">
                                மீண்டும் வரவேண்டிய நாள் / To Come for review on
                            </label>
                            <input
                                type="date"
                                value={prescription.reviewDate}
                                onChange={(e) => setPrescription({ ...prescription, reviewDate: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">
                                மீண்டும் வருங்போது செய்ய வேண்டிய பரிசோதனைகள் / Tests to be done on review
                            </label>
                            <input
                                type="text"
                                value={prescription.testsOnReview}
                                onChange={(e) => setPrescription({ ...prescription, testsOnReview: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                            />
                        </div>
                        <div className="md:col-span-2">
                            <label className="block text-xs font-medium text-gray-500 mb-1">
                                மீண்டும் வருங்போது பார்க்க வேண்டிய சிறப்பு டாக்டர் / Specialists to be seen on review
                            </label>
                            <input
                                type="text"
                                value={prescription.specialistsToSee}
                                onChange={(e) => setPrescription({ ...prescription, specialistsToSee: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                            />
                        </div>
                    </div>

                    {/* Doctor Signature */}
                    <div className="flex justify-end border-t pt-4">
                        <div className="text-right">
                            <div className="h-12 border-b border-gray-400 mb-2 w-48"></div>
                            <p className="font-semibold text-gray-900">{prescription.doctorName}</p>
                            <p className="text-sm text-gray-600">{prescription.doctorQualification}</p>
                            <p className="text-xs text-gray-500">டாக்டர் கையொப்பம் / DOCTOR SIGNATURE</p>
                        </div>
                    </div>
                </div>

                {/* Action Buttons */}
                <div className="sticky bottom-0 bg-gray-50 border-t border-gray-200 px-6 py-4 flex flex-wrap gap-3 justify-end">
                    <button
                        onClick={handlePrint}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                        </svg>
                        Print / அச்சு
                    </button>
                    <button
                        onClick={() => onSendToPharmacy(prescription)}
                        className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                        </svg>
                        Send to Pharmacy / மருந்தகத்திற்கு
                    </button>
                    <button
                        onClick={() => onSendToPatient(prescription)}
                        className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg hover:bg-primary-600 transition-colors"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                        </svg>
                        Send to Patient / நோயாளிக்கு
                    </button>
                </div>
            </div>
        </div>
    );
};

export default PrescriptionForm;
