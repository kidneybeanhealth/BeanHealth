# Multi-Select Diagnosis Implementation Guide

## Changes Needed in PrescriptionModal.tsx

### Location: Lines 824-855 (the diagnosis textarea section)

Replace the `onChange` handler:

```tsx
// OLD CODE (line 827-832):
onChange={e => {
  const val = e.target.value.toUpperCase();
  setFormData({ ...formData, diagnosis: val });
  setDiagnosisSearchQuery(val);
  setShowDiagnosisDropdown(true);
}}

// NEW CODE:
onChange={e => {
  const val = e.target.value.toUpperCase();
  setFormData({ ...formData, diagnosis: val });
  
  // Extract the current typing part (after last "/")
  const parts = val.split('/');
  const currentQuery = parts[parts.length - 1].trim();
  setDiagnosisSearchQuery(currentQuery);
  setShowDiagnosisDropdown(true);
}}
```

### Replace the `onFocus` handler (line 833):

```tsx
// OLD CODE:
onFocus={() => setShowDiagnosisDropdown(true)}

// NEW CODE:
onFocus={() => {
  const parts = (formData.diagnosis || '').split('/');
  const currentQuery = parts[parts.length - 1].trim();
  setDiagnosisSearchQuery(currentQuery);
  setShowDiagnosisDropdown(true);
}}
```

### Replace the dropdown filtering logic (lines 837-855):

```tsx
// OLD CODE:
{showDiagnosisDropdown && savedDiagnoses.filter(d => d.name.toLowerCase().includes(diagnosisSearchQuery.toLowerCase())).length > 0 && (
  <div className="absolute left-0 right-0 top-full z-[100] bg-white border-2 border-black shadow-xl max-h-48 overflow-y-auto">
    {savedDiagnoses
      .filter(d => d.name.toLowerCase().includes(diagnosisSearchQuery.toLowerCase()))
      .map(diag => (
        <button
          key={diag.id}
          type="button"
          className="w-full text-left px-3 py-2 hover:bg-emerald-50 text-xs font-bold border-b border-gray-100 last:border-0"
          onMouseDown={() => {
            setFormData({ ...formData, diagnosis: diag.name });
            setShowDiagnosisDropdown(false);
          }}
        >
          {diag.name}
        </button>
      ))}
  </div>
)}

// NEW CODE:
{(() => {
  // Get already selected diagnoses
  const selectedDiags = (formData.diagnosis || '')
    .split('/')
    .map(d => d.trim())
    .filter(Boolean);
  
  // Filter: match current query AND exclude already selected
  const filteredDiags = savedDiagnoses.filter(d => {
    const matchesQuery = d.name.toLowerCase().includes(diagnosisSearchQuery.toLowerCase());
    const notSelected = !selectedDiags.includes(d.name);
    return matchesQuery && notSelected;
  });
  
  return showDiagnosisDropdown && diagnosisSearchQuery.length > 0 && filteredDiags.length > 0 && (
    <div className="absolute left-0 right-0 top-full z-[100] bg-white border-2 border-black shadow-xl max-h-48 overflow-y-auto">
      {filteredDiags.map(diag => (
        <button
          key={diag.id}
          type="button"
          className="w-full text-left px-3 py-2 hover:bg-emerald-50 text-xs font-bold border-b border-gray-100 last:border-0"
          onMouseDown={() => {
            // Get all parts except the last (which is being typed)
            const parts = (formData.diagnosis || '').split('/');
            parts[parts.length - 1] = ''; // Clear the typing part
            
            // Add the selected diagnosis and prepare for next
            const newValue = [...parts.filter(p => p.trim()), diag.name].join('/') + '/';
            setFormData({ ...formData, diagnosis: newValue });
            setDiagnosisSearchQuery('');
            setShowDiagnosisDropdown(false);
          }}
        >
          {diag.name}
        </button>
      ))}
    </div>
  );
})()}
```

## Changes Needed in MobilePrescriptionInput.tsx

### Location: Around lines 131-170 (diagnosis input section)

Apply the same three changes as above to the mobile version.

## Testing Checklist

- [ ] Type "CKD" → Select "CKD STAGE 3" → Field shows "CKD STAGE 3/"
- [ ] Type "DIA" → Only shows diagnoses with "DIA" that aren't "CKD STAGE 3"
- [ ] Select "DIABETES" → Field shows "CKD STAGE 3/DIABETES/"
- [ ] Backspace removes characters from end correctly
- [ ] Works on both desktop and mobile
- [ ] No errors in console
