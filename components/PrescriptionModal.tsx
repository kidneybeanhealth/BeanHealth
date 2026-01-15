import React, { useState, useEffect, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { supabase } from '../lib/supabase';
import { toast } from 'react-hot-toast';

interface PrescriptionModalProps {
  doctor: any;
  patient: any;
  onClose: () => void;
  onSendToPharmacy?: (medications: any[], notes: string) => void;
  readOnly?: boolean;
  existingData?: any;
}

const PrescriptionModal: React.FC<PrescriptionModalProps> = ({ doctor, patient, onClose, onSendToPharmacy, readOnly = false, existingData = null }) => {
  // Form States matching the PDF structure
  const [formData, setFormData] = useState({
    fatherName: '',
    place: '',
    phone: '',
    allergy: 'Nil',
    diagnosis: '',
    reviewDate: '',
    testsToReview: '',
    specialistToReview: ''
  });

  const [medications, setMedications] = useState([
    { name: '', number: '', morning: false, noon: false, night: false, beforeFood: false }
  ]);

  // Refs for printing
  const componentRef = useRef<HTMLDivElement>(null);

  // Initialize phone if available
  useEffect(() => {
    if (patient?.phone) setFormData(prev => ({ ...prev, phone: patient.phone }));

    if (existingData) {
      // Parse Existing Data for Read-Only View
      try {
        // medications
        const parsedMeds = (existingData.medications || []).map((m: any) => {
          const freqs = (m.frequency || '0-0-0').split('-');
          return {
            name: m.name,
            number: (m.dosage || '').replace(' tab', ''),
            morning: freqs[0] === '1',
            noon: freqs[1] === '1',
            night: freqs[2] === '1',
            beforeFood: (m.instruction || '').toLowerCase().includes('before')
          };
        });
        if (parsedMeds.length > 0) setMedications(parsedMeds);

        // Notes parsing
        const notes = existingData.notes || '';
        const diagnosis = notes.match(/Diagnosis: (.*?)(\n|$)/)?.[1] || '';
        const review = notes.match(/Review: (.*?)(\n|$)/)?.[1] || '';
        const tests = notes.match(/Tests: (.*?)(\n|$)/)?.[1] || '';
        // New fields
        const place = notes.match(/Place: (.*?)(\n|$)/)?.[1] || '';
        const phone = notes.match(/Phone: (.*?)(\n|$)/)?.[1] || '';

        setFormData(prev => ({
          ...prev,
          diagnosis,
          reviewDate: review,
          testsToReview: tests,
          place: place || prev.place,
          phone: phone || prev.phone
        }));

      } catch (e) {
        console.error("Error parsing existing prescription:", e);
      }
    }
  }, [patient, existingData]);

  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    documentTitle: `Prescription-${patient?.name || 'Patient'}-${new Date().toLocaleDateString()}`,
    onPrintError: (error) => console.error('Print failed:', error),
  } as any);

  // Medicine Handlers
  const addRow = () => {
    if (readOnly) return;
    setMedications([...medications, { name: '', number: '', morning: false, noon: false, night: false, beforeFood: false }]);
  };

  const removeRow = (index: number) => {
    if (readOnly) return;
    if (medications.length === 1) return;
    const newMeds = [...medications];
    newMeds.splice(index, 1);
    setMedications(newMeds);
  };

  const updateMed = (index: number, field: string, value: any) => {
    if (readOnly) return;
    const newMeds = [...medications];
    (newMeds[index] as any)[field] = value;
    setMedications(newMeds);
  };

  const handleSend = () => {
    if (readOnly) return;
    // Convert to pharmacy format
    const pharmacyMeds = medications.filter(m => m.name).map(m => {
      const freq = `${m.morning ? '1' : '0'}-${m.noon ? '1' : '0'}-${m.night ? '1' : '0'}`;
      return {
        name: m.name,
        dosage: m.number + ' tab',
        frequency: freq,
        duration: 'See Review Date',
        instruction: m.beforeFood ? 'Before Food' : 'After Food'
      };
    });

    // We pack the extra metadata (Place, Phone, etc) into the notes field so it persists without schema changes
    const notes = `Place: ${formData.place}\nPhone: ${formData.phone}\nDiagnosis: ${formData.diagnosis}\nReview: ${formData.reviewDate}\nTests: ${formData.testsToReview}`;
    if (onSendToPharmacy) onSendToPharmacy(pharmacyMeds, notes);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl flex flex-col max-h-[95vh] overflow-hidden animate-scale-in">

        {/* Scrollable Content Area */}
        <div className="flex-1 overflow-y-auto p-2 bg-gray-100">

          {/* PRINT PREVIEW AREA - EXACT REPLICA OF PDF */}
          <div ref={componentRef} className="bg-white mx-auto shadow-sm p-8 max-w-[210mm] min-h-[297mm] text-black" style={{ fontFamily: '"Times New Roman", Times, serif' }}>

            {/* Header */}
            <div className="flex items-center justify-between border-b-2 border-black pb-2 mb-2">
              <div className="w-24 h-24 relative">
                <img src="/kkc_logo.jpg" alt="KKC Logo" className="w-[124px] h-[124px] object-contain absolute -top-2 left-0" />
              </div>
              <div className="text-center flex-1">
                <h1 className="text-2xl font-bold text-blue-900 leading-tight">KONGUNAD KIDNEY CENTRE, Coimbatore - 641 012</h1>
                <h2 className="text-xl font-bold text-blue-900 leading-tight">கொங்குநாடு கிட்னி சென்டர், கோயம்புத்தூர் - 641 012</h2>
              </div>
            </div>

            {/* Patient Details Grid Box */}
            <div className="border-2 border-black mb-4 text-sm font-bold">
              {/* Row 1 */}
              <div className="flex border-b border-black">
                <div className="w-1/2 flex border-r border-black">
                  <div className="w-40 p-1">பெயர் / NAME</div>
                  <div className="flex-1 p-1 uppercase">{patient.name}</div>
                </div>
                <div className="w-1/2 flex">
                  <div className="w-40 p-1 border-r border-black">வயது / ஆ/பெ <br /> AGE / M/F</div>
                  <div className="flex-1 p-1 flex items-center">{patient.age} / {patient.gender || 'M'}</div>
                </div>
              </div>
              {/* Row 2 */}
              <div className="flex border-b border-black">
                <div className="w-1/2 flex border-r border-black">
                  <div className="w-40 p-1 text-xs">தகப்பன் / கணவன் <br /> FATHER/HUSBAND</div>
                  <input
                    className="flex-1 p-1 outline-none font-normal"
                    value={formData.fatherName}
                    onChange={e => setFormData({ ...formData, fatherName: e.target.value })}
                  />
                </div>
                <div className="w-1/2 flex">
                  <div className="w-40 p-1 border-r border-black">பதிவு எண் <br /> REG. No.</div>
                  <div className="flex-1 p-1 flex items-center">{patient.token_number}</div>
                </div>
              </div>
              {/* Row 3 */}
              <div className="flex border-b border-black">
                <div className="w-1/2 flex border-r border-black">
                  <div className="w-40 p-1">ஊர் / PLACE</div>
                  <input
                    className="flex-1 p-1 outline-none font-normal"
                    value={formData.place}
                    onChange={e => setFormData({ ...formData, place: e.target.value })}
                  />
                </div>
                <div className="w-1/2 flex">
                  <div className="w-40 p-1 border-r border-black">தேதி <br /> DATE</div>
                  <div className="flex-1 p-1 flex items-center">{new Date().toLocaleDateString('en-GB')}</div>
                </div>
              </div>
              {/* Row 4 */}
              <div className="flex border-b border-black">
                <div className="flex-1 flex">
                  <div className="w-40 p-1">போன் / PHONE</div>
                  <input
                    className="flex-1 p-1 outline-none font-normal"
                    value={formData.phone}
                    onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  />
                </div>
              </div>
              {/* Row 5 */}
              <div className="flex border-b border-black">
                <div className="w-1/2 flex border-r border-black">
                  <div className="w-40 p-1">மருந்து / Drug <br /> அலர்ஜி / Allergy</div>
                  <input
                    className="flex-1 p-1 outline-none font-normal text-red-600"
                    value={formData.allergy}
                    onChange={e => setFormData({ ...formData, allergy: e.target.value })}
                  />
                </div>
              </div>
              {/* Row 6 */}
              <div className="flex">
                <div className="flex-1 flex">
                  <div className="w-40 p-1">வியாதிகள் / Diagnosis</div>
                  <input
                    className="flex-1 p-1 outline-none font-normal w-full"
                    value={formData.diagnosis}
                    onChange={e => setFormData({ ...formData, diagnosis: e.target.value })}
                  />
                </div>
              </div>
            </div>

            {/* Medicine Table Box */}
            <div className="border-2 border-black mb-4 min-h-[400px]">
              <div className="text-center font-bold border-b border-black py-1">
                மருந்துகள் பரிந்துரை விபரம் - MEDICINES PRESCRIPTION DETAILS
              </div>

              {/* Table Headers */}
              <div className="flex border-b border-black text-center font-bold text-sm">
                <div className="w-12 border-r border-black py-2 p-1 flex items-center justify-center shrink-0">
                  வ/எண் <br /> S/No.
                </div>
                <div className="flex-1 border-r border-black py-2 p-1 flex items-center justify-center min-w-0">
                  மருந்துக்கள் <br /> DRUGS
                </div>
                <div className="w-[300px] shrink-0 flex flex-col">
                  <div className="border-b border-black py-1">அளவு - Dose</div>
                  <div className="flex flex-1 items-stretch">
                    <div className="w-14 border-r border-black py-1 text-xs flex flex-col items-center justify-center shrink-0 leading-tight">
                      <span>Number</span>
                      <span>எண்</span>
                    </div>
                    <div className="w-12 border-r border-black py-1 text-xs px-0.5 flex flex-col items-center justify-center shrink-0 leading-tight">
                      <span>Morn</span>
                      <span>காலை</span>
                    </div>
                    <div className="w-12 border-r border-black py-1 text-xs px-0.5 flex flex-col items-center justify-center shrink-0 leading-tight">
                      <span>Noon</span>
                      <span>மதியம்</span>
                    </div>
                    <div className="w-12 border-r border-black py-1 text-xs px-0.5 flex flex-col items-center justify-center shrink-0 leading-tight">
                      <span>Night</span>
                      <span>இரவு</span>
                    </div>
                    <div className="w-[50px] py-1 text-xs px-0.5 border-r border-black flex flex-col items-center justify-center shrink-0 leading-tight">
                      <span>சா.மு</span>
                      <span>B/F</span>
                    </div>
                    <div className="w-[50px] py-1 text-xs px-0.5 flex flex-col items-center justify-center shrink-0 leading-tight">
                      <span>சா.பி</span>
                      <span>A/F</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Table Body (Rows) */}
              {medications.map((med, i) => (
                <div key={i} className="flex border-b border-black text-sm relative group">
                  <div className="w-12 border-r border-black py-1 text-center flex items-center justify-center shrink-0">
                    {i + 1}
                  </div>
                  <div className="flex-1 border-r border-black py-1 px-2 relative min-w-0">
                    <input
                      className="w-full outline-none font-bold uppercase"
                      placeholder="DRUG NAME"
                      value={med.name}
                      onChange={e => updateMed(i, 'name', e.target.value)}
                    />
                    {/* Row Controls (Hidden in Print) */}
                    <div className="absolute right-0 top-0 h-full hidden group-hover:flex items-center pr-2 print:hidden bg-white">
                      {medications.length > 1 && (
                        <button onClick={() => removeRow(i)} className="text-red-500 hover:text-red-700 font-bold px-2">×</button>
                      )}
                    </div>
                  </div>
                  <div className="w-[300px] flex shrink-0">
                    <div className="w-14 border-r border-black py-1 px-1 flex items-center justify-center shrink-0">
                      <input className="w-full text-center outline-none" placeholder="1" value={med.number} onChange={e => updateMed(i, 'number', e.target.value)} />
                    </div>
                    {/* Checkboxes for M-N-N */}
                    <div className="w-12 border-r border-black py-1 flex items-center justify-center cursor-pointer font-bold shrink-0" onClick={() => updateMed(i, 'morning', !med.morning)}>
                      {med.morning ? '1' : ''}
                    </div>
                    <div className="w-12 border-r border-black py-1 flex items-center justify-center cursor-pointer font-bold shrink-0" onClick={() => updateMed(i, 'noon', !med.noon)}>
                      {med.noon ? '1' : ''}
                    </div>
                    <div className="w-12 border-r border-black py-1 flex items-center justify-center cursor-pointer font-bold shrink-0" onClick={() => updateMed(i, 'night', !med.night)}>
                      {med.night ? '1' : ''}
                    </div>
                    <div className="w-[50px] border-r border-black py-1 flex items-center justify-center cursor-pointer font-bold shrink-0" onClick={() => { updateMed(i, 'beforeFood', true); }}>
                      {med.beforeFood ? '✓' : ''}
                    </div>
                    <div className="w-[50px] py-1 flex items-center justify-center cursor-pointer font-bold shrink-0" onClick={() => { updateMed(i, 'beforeFood', false); }}>
                      {!med.beforeFood ? '✓' : ''}
                    </div>
                  </div>
                </div>
              ))}
              {/* Add Row Button (Hidden in Print and ReadOnly) */}
              {!readOnly && (
                <div className="p-2 text-center print:hidden border-t border-dashed border-gray-300">
                  <button onClick={addRow} className="text-emerald-600 text-sm font-bold hover:underline">+ Add Medicine Row</button>
                </div>
              )}
            </div>

            {/* Footer Review Section */}
            <div className="space-y-4 text-sm font-bold mb-8">
              <div className="flex gap-2 items-end">
                <div>மீண்டும் வரவேண்டிய நாள் <br /> To Come for review on :</div>
                <input className="flex-1 border-b border-black border-dashed outline-none px-2" value={formData.reviewDate} onChange={e => !readOnly && setFormData({ ...formData, reviewDate: e.target.value })} readOnly={readOnly} />
              </div>
              <div className="flex gap-2 items-end">
                <div>மீண்டும் வரும்போது செய்ய வேண்டிய பரிசோதனைகள் <br /> Tests to be done on review :</div>
                <input className="flex-1 border-b border-black border-dashed outline-none px-2" value={formData.testsToReview} onChange={e => !readOnly && setFormData({ ...formData, testsToReview: e.target.value })} readOnly={readOnly} />
              </div>
              <div className="flex gap-2 items-end">
                <div>மீண்டும் வரும்போது பார்க்க வேண்டிய சிறப்பு டாக்டர்கள் <br /> Specialists to be seen on review :</div>
                <input className="flex-1 border-b border-black border-dashed outline-none px-2" value={formData.specialistToReview} onChange={e => !readOnly && setFormData({ ...formData, specialistToReview: e.target.value })} readOnly={readOnly} />
              </div>
            </div>

            {/* Signature */}
            <div className="flex justify-end mt-12 mb-4">
              <div className="text-center">
                <div className="h-12"></div> {/* Space for signature */}
                <div className="font-bold border-t border-black px-4 pt-1">
                  டாக்டர் கையொப்பம். <br /> DOCTOR SIGNATURE.
                </div>
              </div>
            </div>

            {/* Footer Box */}
            <div className="border border-black p-2 text-xs leading-relaxed">
              <p className="font-bold">முன்பதிவு செய்வது சிறப்பு டாக்டர் இருப்பது உறுதிபடுத்தி காலதாமதத்தை குறைக்கும்</p>
              <p className="mb-1">Prior registration will confirm availability of the specialist and avoid delay</p>

              <p className="font-bold">சிறப்பு டாக்டரை பார்க்க முன் பதிவு ! <span className="font-normal font-sans">For Specialist appointment : 0422 - 2494333, 73588 41555, 73588 41666</span></p>
              <p className="font-sans mb-1 font-bold"> நேரம் / Time : 800 am to 6.00 pm</p>

              <p className="font-bold mt-2">சிறப்பு சிறுநீரக மருத்துவ நிபுணர் : <span className="font-sans">Dr. A. பிரபாகர் / Dr. A. Prabhakar MD., C.Diab. DNB (Nephro)</span></p>
              <p className="font-bold">சிறப்பு சிறுநீரக மருத்துவ நிபுணர் : <span className="font-sans">Dr. A. திவாகர் / Dr. A. Divakar MS., M.ch., (Uro)</span></p>

              <div className="mt-2 font-bold flex gap-2">
                <span>அவசர உதவிக்கு / போன் -</span>
                <span className="font-sans">Emergency Contact / Phone : 0422 4316000</span>
              </div>
            </div>

            <div className="text-center font-bold text-sm mt-1">
              அவசர கேஸ்கள் 24 மணி நேரமும் பார்க்கப்படும் - For Emergency cases 24 hrs Service
            </div>

          </div>
        </div>

        {/* Footer Controls */}
        <div className="bg-white p-6 border-t border-gray-100 flex justify-end gap-3 z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
          <button onClick={onClose} className="px-6 py-3 text-gray-600 font-bold hover:bg-gray-50 rounded-xl transition-colors">
            Cancel
          </button>
          <button
            onClick={handlePrint}
            className="px-8 py-3 bg-gray-900 text-white font-bold rounded-xl hover:bg-black flex items-center gap-2 shadow-lg transition-all active:scale-95"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" /></svg>
            Print PDF
          </button>
          {!readOnly && (
            <button
              onClick={handleSend}
              className="px-8 py-3 bg-emerald-600 text-white font-bold rounded-xl hover:bg-emerald-700 flex items-center gap-2 shadow-lg shadow-emerald-600/20 transition-all active:scale-95"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
              Send to Pharmacy
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default PrescriptionModal;
