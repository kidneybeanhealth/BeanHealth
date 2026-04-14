/**
 * Patient App Translations — English + Tamil (தமிழ்)
 * 
 * Tamil is the default language (90% of patients are Tamil speakers).
 * Medical terms (drug names, dosages, units like mmHg, mg/dL) stay in English.
 */

export type Lang = 'ta' | 'en';

const translations: Record<string, Record<Lang, string>> = {
  // ── Login Screen ───────────────────────────────────────────
  'login.title': {
    en: 'Patient Portal',
    ta: 'நோயாளி போர்டல்',
  },
  'login.subtitle': {
    en: 'Enter your MR ID to continue',
    ta: 'தொடர உங்கள் MR எண்ணை உள்ளிடவும்',
  },
  'login.mrLabel': {
    en: 'MR Number',
    ta: 'MR எண்',
  },
  'login.continue': {
    en: 'Continue',
    ta: 'தொடரவும்',
  },
  'login.lookingUp': {
    en: 'Looking up...',
    ta: 'தேடுகிறது...',
  },
  'login.enterMR': {
    en: 'Please enter your MR ID',
    ta: 'உங்கள் MR எண்ணை உள்ளிடவும்',
  },
  'login.footer': {
    en: 'BeanHealth Pvt Ltd · Patient Portal',
    ta: 'BeanHealth Pvt Ltd · நோயாளி போர்டல்',
  },

  // ── Confirmation Screen ────────────────────────────────────
  'confirm.yes': {
    en: 'Yes, this is me, Continue',
    ta: 'ஆமாம், இது நான், தொடரவும்',
  },
  'confirm.no': {
    en: 'Not me, Go back',
    ta: 'இது நான் அல்ல, திரும்பு',
  },
  'confirm.fatherHusband': {
    en: 'Father / Husband Name',
    ta: 'தந்தை / கணவர் பெயர்',
  },
  'confirm.age': {
    en: 'Age',
    ta: 'வயது',
  },
  'confirm.gender': {
    en: 'Gender',
    ta: 'பாலினம்',
  },
  'confirm.visitDate': {
    en: 'Date of Visit',
    ta: 'வருகை தேதி',
  },
  'confirm.hospital': {
    en: 'Hospital',
    ta: 'மருத்துவமனை',
  },
  'confirm.department': {
    en: 'Department',
    ta: 'துறை',
  },
  'confirm.doctor': {
    en: 'Consulting Doctor',
    ta: 'ஆலோசனை மருத்துவர்',
  },
  'confirm.yrs': {
    en: 'yrs',
    ta: 'வயது',
  },

  // ── Header / Greeting ─────────────────────────────────────
  'greeting.morning': {
    en: 'Good Morning',
    ta: 'காலை வணக்கம்',
  },
  'greeting.afternoon': {
    en: 'Good Afternoon',
    ta: 'மதிய வணக்கம்',
  },
  'greeting.evening': {
    en: 'Good Evening',
    ta: 'மாலை வணக்கம்',
  },

  // ── Bottom Nav ─────────────────────────────────────────────
  'nav.home': {
    en: 'Home',
    ta: 'முகப்பு',
  },
  'nav.trends': {
    en: 'Trends',
    ta: 'போக்குகள்',
  },
  'nav.rx': {
    en: 'Rx',
    ta: 'மருந்துச்சீட்டு',
  },

  // ── Vitals Card ────────────────────────────────────────────
  'vitals.title': {
    en: 'Vitals',
    ta: 'உடல் அறிகுறிகள்',
  },
  'vitals.today': {
    en: 'Today',
    ta: 'இன்று',
  },
  'vitals.bp': {
    en: 'Blood Pressure',
    ta: 'இரத்த அழுத்தம்',
  },
  'vitals.glucose': {
    en: 'Blood Glucose',
    ta: 'இரத்த சர்க்கரை',
  },
  'vitals.weight': {
    en: 'Weight',
    ta: 'எடை',
  },
  'vitals.urineOutput': {
    en: 'Urine Output',
    ta: 'சிறுநீர் வெளியீடு',
  },
  'vitals.total': {
    en: 'Total',
    ta: 'மொத்தம்',
  },
  'vitals.more': {
    en: 'more',
    ta: 'மேலும்',
  },
  'vitals.addUrine': {
    en: 'Add urine output',
    ta: 'சிறுநீர் வெளியீடு சேர்',
  },

  // ── Intakes Card ───────────────────────────────────────────
  'intakes.title': {
    en: 'Daily Intake',
    ta: 'தினசரி உட்கொள்ளல்',
  },
  'intakes.prescribed': {
    en: 'Prescribed',
    ta: 'பரிந்துரை',
  },
  'intakes.salt': {
    en: 'Salt Intake',
    ta: 'உப்பு உட்கொள்ளல்',
  },
  'intakes.fluid': {
    en: 'Fluid Intake',
    ta: 'திரவ உட்கொள்ளல்',
  },
  'intakes.limit': {
    en: 'Limit',
    ta: 'வரம்பு',
  },

  // ── Medication Card ────────────────────────────────────────
  'med.title': {
    en: 'Medication',
    ta: 'மருந்து',
  },
  'med.noMeds': {
    en: 'No medications',
    ta: 'மருந்துகள் இல்லை',
  },
  'med.emptySubtext': {
    en: 'Your prescriptions will appear here after your doctor visit',
    ta: 'மருத்துவர் சந்திப்புக்குப் பிறகு உங்கள் மருந்துகள் இங்கே தோன்றும்',
  },
  'med.morning': {
    en: 'Morning',
    ta: 'காலை',
  },
  'med.afternoon': {
    en: 'Afternoon',
    ta: 'மதியம்',
  },
  'med.evening': {
    en: 'Evening',
    ta: 'மாலை',
  },
  'med.night': {
    en: 'Night',
    ta: 'இரவு',
  },
  'med.otherExternal': {
    en: 'Other / External Use',
    ta: 'பிற / வெளிப்புற பயன்பாடு',
  },
  'med.beforeFood': {
    en: 'Before Food',
    ta: 'உணவுக்கு முன்',
  },
  'med.afterFood': {
    en: 'After Food',
    ta: 'உணவுக்கு பின்',
  },
  'med.emptyStomach': {
    en: 'Empty Stomach',
    ta: 'வெறும் வயிற்றில்',
  },

  // ── BP Scroll Picker ───────────────────────────────────────
  'bp.title': {
    en: 'Blood Pressure',
    ta: 'இரத்த அழுத்தம்',
  },
  'bp.subtitle': {
    en: 'Scroll to select your reading',
    ta: 'உங்கள் அளவீட்டைத் தேர்ந்தெடுக்கவும்',
  },
  'bp.systolic': {
    en: 'Systolic',
    ta: 'மேல் அழுத்தம்',
  },
  'bp.diastolic': {
    en: 'Diastolic',
    ta: 'கீழ் அழுத்தம்',
  },
  'bp.confirm': {
    en: 'Confirm',
    ta: 'உறுதிசெய்',
  },
  'bp.low': {
    en: 'Low',
    ta: 'குறைவு',
  },
  'bp.normal': {
    en: 'Normal',
    ta: 'சாதாரணம்',
  },
  'bp.elevated': {
    en: 'Elevated',
    ta: 'உயர்வு',
  },
  'bp.high': {
    en: 'High',
    ta: 'அதிகம்',
  },

  // ── Urine Output Modal ────────────────────────────────────
  'urine.title': {
    en: 'Add Urine Output',
    ta: 'சிறுநீர் வெளியீடு சேர்',
  },
  'urine.amountLabel': {
    en: 'Amount (ml)',
    ta: 'அளவு (மிலி)',
  },
  'urine.amountPlaceholder': {
    en: 'Enter in ml',
    ta: 'மிலி-ல் உள்ளிடவும்',
  },
  'urine.notesLabel': {
    en: 'Notes (optional)',
    ta: 'குறிப்புகள் (விரும்பினால்)',
  },
  'urine.notesPlaceholder': {
    en: 'e.g. clear, dark...',
    ta: 'எ.கா. தெளிவான, கருமை...',
  },
  'urine.save': {
    en: 'Save Entry',
    ta: 'பதிவு செய்',
  },
  'urine.saving': {
    en: 'Saving...',
    ta: 'சேமிக்கிறது...',
  },

  // ── Prescriptions Tab ──────────────────────────────────────
  'rx.empty': {
    en: 'No prescriptions yet',
    ta: 'மருந்துச் சீட்டுகள் இல்லை',
  },
  'rx.emptySubtext': {
    en: 'Your prescriptions will appear here after your doctor visit',
    ta: 'மருத்துவர் சந்திப்புக்குப் பிறகு உங்கள் மருந்துச் சீட்டுகள் இங்கே தோன்றும்',
  },
  'rx.prescription': {
    en: 'prescription',
    ta: 'மருந்துச் சீட்டு',
  },
  'rx.prescriptions': {
    en: 'prescriptions',
    ta: 'மருந்துச் சீட்டுகள்',
  },
  'rx.meds': {
    en: 'meds',
    ta: 'மருந்துகள்',
  },

  // ── Trends / Charts ────────────────────────────────────────
  'trend.bp': {
    en: 'Blood Pressure',
    ta: 'இரத்த அழுத்தம்',
  },
  'trend.glucose': {
    en: 'Blood Glucose',
    ta: 'இரத்த சர்க்கரை',
  },
  'trend.weight': {
    en: 'Weight',
    ta: 'எடை',
  },
  'trend.urine': {
    en: 'Urine Output',
    ta: 'சிறுநீர் வெளியீடு',
  },
  'trend.fluid': {
    en: 'Fluid Intake',
    ta: 'திரவ உட்கொள்ளல்',
  },
  'trend.noData': {
    en: 'No data yet',
    ta: 'தரவு இல்லை',
  },
  'trend.startRecording': {
    en: 'Start recording to see trends',
    ta: 'போக்குகளைக் காண பதிவு செய்யத் தொடங்குங்கள்',
  },
  'trend.systole': {
    en: 'Systole',
    ta: 'மேல் அழுத்தம்',
  },
  'trend.diastole': {
    en: 'Diastole',
    ta: 'கீழ் அழுத்தம்',
  },

  // ── Actions & Receipts ─────────────────────────────────────
  'action.save': {
    en: 'Save',
    ta: 'சேமி',
  },
  'action.saved': {
    en: 'Saved',
    ta: 'சேமித்தவை',
  },
  'action.done': {
    en: 'Done',
    ta: 'முடிந்தது',
  },
  'receipt.vitalsTitle': {
    en: 'Vitals Saved Successfully!',
    ta: 'உடல் அறிகுறிகள் வெற்றிகரமாக சேமிக்கப்பட்டன!',
  },
  'receipt.intakesTitle': {
    en: 'Intakes Saved Successfully!',
    ta: 'உட்கொள்ளல் வெற்றிகரமாக சேமிக்கப்பட்டது!',
  },
  'receipt.time': {
    en: 'Time',
    ta: 'நேரம்',
  },
  'receipt.recorded': {
    en: 'Recorded at',
    ta: 'பதிவு செய்யப்பட்ட நேரம்',
  },
  'bp.discardChanges': {
    en: 'You have unsaved changes. Discard them?',
    ta: 'சேமிக்கப்படாத தரவுகள் உள்ளன. சேமிக்காமல் வெளியேற வேண்டுமா?',
  },
  'bp.confirmSave': {
    en: 'Save Blood Pressure as',
    ta: 'இரத்த அழுத்தத்தை இவ்வாறு சேமிக்க வேண்டுமா:',
  },

  // ── Language Toggle ────────────────────────────────────────
  'lang.tamil': {
    en: 'த',
    ta: 'த',
  },
  'lang.english': {
    en: 'EN',
    ta: 'EN',
  },
};

export default translations;
