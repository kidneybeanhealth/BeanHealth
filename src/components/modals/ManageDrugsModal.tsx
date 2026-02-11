import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import { toast } from 'react-hot-toast';

// Drug types with icons and prefixes
const DRUG_TYPES = [
    { value: 'TAB', label: 'TAB', prefix: 'TAB.', icon: '💊', color: 'bg-blue-100 text-blue-700 border-blue-200' },
    { value: 'CAP', label: 'CAP', prefix: 'CAP.', icon: '🔶', color: 'bg-orange-100 text-orange-700 border-orange-200' },
    { value: 'INJ', label: 'INJ', prefix: 'INJ.', icon: '💉', color: 'bg-red-100 text-red-700 border-red-200' },
    { value: 'SYP', label: 'SYP', prefix: 'SYP.', icon: '🧴', color: 'bg-purple-100 text-purple-700 border-purple-200' },
];

interface SavedDrug {
    id: string;
    name: string;
    drug_type?: string;
    doctor_id?: string;
    hospital_id?: string;
}

interface ReferenceDrug {
    id: string;
    brand_name: string;
    generic_name: string;
    category: string;
}

interface DrugOption {
    id: string;
    name: string;
    category?: string;
    genericName?: string;
    isReference: boolean;
    isSaved: boolean;
}

interface ManageDrugsModalProps {
    doctorId: string;
    hospitalId: string;
    onClose: () => void;
}

const ManageDrugsModal: React.FC<ManageDrugsModalProps> = ({ doctorId, hospitalId, onClose }) => {
    const [savedDrugs, setSavedDrugs] = useState<SavedDrug[]>([]);
    const [newDrugName, setNewDrugName] = useState('');
    const [newDrugType, setNewDrugType] = useState('TAB');
    const [editingDrug, setEditingDrug] = useState<SavedDrug | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [loading, setLoading] = useState(true);

    // Autocomplete state
    const [showDropdown, setShowDropdown] = useState(false);
    const [filteredDrugs, setFilteredDrugs] = useState<DrugOption[]>([]);
    const inputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Fetch saved drugs AND reference drugs
    useEffect(() => {
        const fetchAllDrugs = async () => {
            try {
                // Fetch doctor's saved drugs
                const { data: savedData, error: savedError } = await supabase
                    .from('hospital_doctor_drugs' as any)
                    .select('*')
                    .eq('doctor_id', doctorId)
                    .order('name', { ascending: true });

                if (savedError) throw savedError;
                setSavedDrugs(savedData || []);
            } catch (err) {
                console.error('Error fetching drugs:', err);
                toast.error('Failed to load drugs');
            } finally {
                setLoading(false);
            }
        };
        fetchAllDrugs();
    }, [doctorId]);

    // Combine saved drugs for autocomplete
    const allDrugOptions: DrugOption[] = [
        ...savedDrugs.map(d => ({
            id: d.id,
            name: d.name,
            isReference: false,
            isSaved: true
        }))
    ];

    // Filter drugs as user types
    useEffect(() => {
        if (newDrugName.trim().length > 0) {
            const query = newDrugName.toLowerCase();
            const filtered = allDrugOptions.filter(drug =>
                drug.name.toLowerCase().includes(query) ||
                (drug.genericName && drug.genericName.toLowerCase().includes(query))
            ).slice(0, 15); // Show 15 suggestions
            setFilteredDrugs(filtered);
            setShowDropdown(filtered.length > 0 && !editingDrug);
        } else {
            setFilteredDrugs([]);
            setShowDropdown(false);
        }
    }, [newDrugName, savedDrugs, editingDrug]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
                inputRef.current && !inputRef.current.contains(e.target as Node)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Handle selecting a drug type - add prefix to name
    const handleTypeChange = (type: string) => {
        const typeInfo = DRUG_TYPES.find(t => t.value === type);
        const oldTypeInfo = DRUG_TYPES.find(t => t.value === newDrugType);

        // Remove old prefix if exists
        let cleanName = newDrugName;
        if (oldTypeInfo && cleanName.startsWith(oldTypeInfo.prefix)) {
            cleanName = cleanName.slice(oldTypeInfo.prefix.length).trim();
        }

        // Add new prefix
        if (typeInfo && cleanName && !cleanName.startsWith(typeInfo.prefix)) {
            setNewDrugName(`${typeInfo.prefix}${cleanName}`);
        }

        setNewDrugType(type);
    };

    const handleSelectSuggestion = (drug: DrugOption) => {
        // Get current type prefix
        const typeInfo = DRUG_TYPES.find(t => t.value === newDrugType);
        const prefix = typeInfo?.prefix || '';

        // Add prefix if not already present
        let drugName = drug.name;
        const hasAnyPrefix = DRUG_TYPES.some(t => drugName.toUpperCase().startsWith(t.prefix));
        if (!hasAnyPrefix && prefix) {
            drugName = `${prefix}${drugName}`;
        }

        setNewDrugName(drugName);
        setShowDropdown(false);

        // If it's an existing saved drug, set it for editing
        const existingSaved = savedDrugs.find(s => s.name.toUpperCase() === drug.name.toUpperCase());
        if (existingSaved) {
            setEditingDrug(existingSaved);
            setNewDrugType(existingSaved.drug_type || 'TAB');
        }

        inputRef.current?.focus();
    };

    const handleSaveDrug = async () => {
        if (!newDrugName.trim()) return;

        const normalizedName = newDrugName.trim().toUpperCase();

        // Check for duplicates (only if adding new, not editing)
        if (!editingDrug) {
            const isDuplicate = savedDrugs.some(
                drug => drug.name.toUpperCase() === normalizedName
            );
            if (isDuplicate) {
                toast.error(`"${normalizedName}" already exists. Click it to edit.`, {
                    icon: '⚠️',
                    duration: 3000
                });
                return;
            }
        }

        setIsSaving(true);
        try {
            if (editingDrug) {
                // Update existing drug
                const { error } = await supabase
                    .from('hospital_doctor_drugs' as any)
                    .update({ name: normalizedName, drug_type: newDrugType } as any)
                    .eq('id', editingDrug.id);
                if (error) throw error;
                toast.success('Drug updated!', { icon: '✅' });
                setSavedDrugs(savedDrugs.map(d =>
                    d.id === editingDrug.id ? { ...d, name: normalizedName, drug_type: newDrugType } : d
                ));
            } else {
                // Add new drug
                const { data, error } = await supabase
                    .from('hospital_doctor_drugs' as any)
                    .insert({
                        name: normalizedName,
                        drug_type: newDrugType,
                        doctor_id: doctorId,
                        hospital_id: hospitalId
                    } as any)
                    .select()
                    .single();

                if (error) {
                    if (error.code === '23505') {
                        toast.error(`"${normalizedName}" already exists`, { icon: '⚠️' });
                        return;
                    }
                    throw error;
                }
                toast.success('Drug added to your saved list!', { icon: '💊' });
                setSavedDrugs([...savedDrugs, data as SavedDrug]);
            }
            setNewDrugName('');
            setNewDrugType('TAB');
            setEditingDrug(null);
        } catch (err: any) {
            console.error('Error saving drug:', err);
            toast.error(err.message || 'Failed to save drug');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDeleteDrug = async (id: string) => {
        try {
            const { error } = await supabase
                .from('hospital_doctor_drugs' as any)
                .delete()
                .eq('id', id);
            if (error) throw error;
            toast.success('Drug removed!');
            setSavedDrugs(savedDrugs.filter(d => d.id !== id));
        } catch (err) {
            console.error('Error deleting drug:', err);
            toast.error('Failed to delete drug');
        }
    };

    const getDrugTypeInfo = (type: string) => {
        return DRUG_TYPES.find(t => t.value === type) || DRUG_TYPES[0];
    };

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gradient-to-r from-purple-50 to-white">
                    <div>
                        <h3 className="text-xl font-bold text-gray-900">Manage Saved Drugs</h3>
                        <p className="text-sm text-gray-500">
                            {savedDrugs.length} saved
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                    >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                {/* Add/Edit Form */}
                <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
                    <div className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                        {editingDrug ? (
                            <>
                                <span className="text-blue-600">✏️ Editing:</span>
                                <span className="text-gray-500">{editingDrug.name}</span>
                            </>
                        ) : (
                            'Add New Drug (type to search from database)'
                        )}
                    </div>

                    <div className="flex gap-2">
                        {/* Drug Type Selector */}
                        <div className="flex bg-white rounded-lg border border-gray-200 overflow-hidden">
                            {DRUG_TYPES.map(type => (
                                <button
                                    key={type.value}
                                    onClick={() => handleTypeChange(type.value)}
                                    className={`px-3 py-2 text-xs font-bold transition-all flex flex-col items-center ${newDrugType === type.value
                                        ? type.color + ' border-b-2'
                                        : 'bg-white text-gray-400 hover:text-gray-600'
                                        }`}
                                    title={`Add ${type.prefix} prefix`}
                                >
                                    <span className="text-base">{type.icon}</span>
                                    <span className="text-[10px]">{type.label}</span>
                                </button>
                            ))}
                        </div>

                        {/* Drug Name Input with Autocomplete */}
                        <div className="flex-1 relative">
                            <input
                                ref={inputRef}
                                type="text"
                                placeholder="Type drug name to search..."
                                className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none text-sm uppercase"
                                value={newDrugName}
                                onChange={e => setNewDrugName(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') handleSaveDrug();
                                    if (e.key === 'Escape') setShowDropdown(false);
                                }}
                                onFocus={() => {
                                    if (filteredDrugs.length > 0 && !editingDrug) {
                                        setShowDropdown(true);
                                    }
                                }}
                            />

                            {/* Autocomplete Dropdown */}
                            {showDropdown && (
                                <div
                                    ref={dropdownRef}
                                    className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-xl z-50 max-h-72 overflow-y-auto"
                                >
                                    <div className="p-2 text-xs text-gray-500 border-b border-gray-100 bg-gray-50 rounded-t-xl sticky top-0">
                                        💡 Click to add to your saved drugs
                                    </div>
                                    {filteredDrugs.map(drug => (
                                        <button
                                            key={drug.id}
                                            onClick={() => handleSelectSuggestion(drug)}
                                            className="w-full px-4 py-3 text-left hover:bg-purple-50 flex items-center gap-3 border-b border-gray-50 last:border-0 transition-colors"
                                        >
                                            <span className="text-lg">💊</span>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-medium text-gray-900 text-sm truncate">{drug.name}</div>
                                                {drug.genericName && (
                                                    <div className="text-xs text-gray-500 truncate">{drug.genericName}</div>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {drug.category && (
                                                    <span className="text-[10px] px-2 py-0.5 bg-purple-100 text-purple-700 rounded-full font-medium whitespace-nowrap">
                                                        {drug.category}
                                                    </span>
                                                )}
                                                {drug.isSaved && (
                                                    <span className="text-[10px] px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-medium">
                                                        SAVED
                                                    </span>
                                                )}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        <button
                            onClick={handleSaveDrug}
                            disabled={isSaving || !newDrugName.trim()}
                            className="px-6 py-2 bg-purple-600 text-white rounded-lg font-semibold text-sm hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                        >
                            {isSaving ? '...' : editingDrug ? 'Update' : 'Add'}
                        </button>
                    </div>

                    {editingDrug && (
                        <button
                            onClick={() => { setEditingDrug(null); setNewDrugName(''); setNewDrugType('TAB'); }}
                            className="text-xs text-purple-600 hover:underline mt-2"
                        >
                            ✕ Cancel Edit
                        </button>
                    )}
                </div>

                {/* Drug List */}
                <div className="flex-1 overflow-y-auto px-6 py-4">
                    <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                        Your Saved Drugs ({savedDrugs.length})
                    </div>
                    {loading ? (
                        <div className="text-center py-8 text-gray-500">Loading...</div>
                    ) : savedDrugs.length === 0 ? (
                        <div className="text-center py-8">
                            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                                <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                                </svg>
                            </div>
                            <p className="text-gray-500 text-sm">No saved drugs yet</p>
                            <p className="text-gray-400 text-xs mt-1">Add new drugs using the form above</p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {savedDrugs.map(drug => {
                                const typeInfo = getDrugTypeInfo(drug.drug_type || 'TAB');
                                return (
                                    <div
                                        key={drug.id}
                                        className="flex items-center justify-between bg-gray-50 rounded-lg px-4 py-3 hover:bg-gray-100 transition-colors group"
                                    >
                                        <div className="flex items-center gap-3">
                                            <span className={`text-xs px-2 py-1 rounded-lg font-bold ${typeInfo.color}`}>
                                                {typeInfo.icon} {drug.drug_type || 'TAB'}
                                            </span>
                                            <span className="font-medium text-gray-900 text-sm">{drug.name}</span>
                                        </div>
                                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => {
                                                    setNewDrugName(drug.name);
                                                    setNewDrugType(drug.drug_type || 'TAB');
                                                    setEditingDrug(drug);
                                                    inputRef.current?.focus();
                                                }}
                                                className="p-1.5 text-blue-600 hover:bg-blue-50 rounded"
                                                title="Edit"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                </svg>
                                            </button>
                                            <button
                                                onClick={() => handleDeleteDrug(drug.id)}
                                                className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                                                title="Delete"
                                            >
                                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default ManageDrugsModal;
