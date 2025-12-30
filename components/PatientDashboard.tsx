import React, { useState, useMemo, useEffect } from "react";
import { useAuth } from "../contexts/AuthContext";
import { NotificationProvider, useNotifications } from "../contexts/NotificationContext";
import { UrgentCreditsProvider, useUrgentCredits } from "../contexts/UrgentCreditsContext";
import Header from "./Header";
import Sidebar from "./Sidebar";
import MobileBottomNav from "./MobileBottomNav";
import Dashboard from "./Dashboard";
import CKDDashboard from "./CKDDashboard";
import Records from "./Records";
import Upload from "./Upload";
import Messages from "./Messages";
import WhatsAppChatWindow from "./WhatsAppChatWindow";
import Billing from "./Billing";
import DoctorsPage from "./DoctorsPage";
import ExtractedMedicationsModal from "./ExtractedMedicationsModal";
import { View, Patient, Vitals, Medication, MedicalRecord, User, Doctor, ChatMessage, ExtractedMedication } from "../types";
import { MedicalRecordsService } from "../services/medicalRecordsService";
import { uploadFileToSupabase, uploadFileToSupabaseSimple, testStorageConnection, deleteFileFromSupabase } from "../services/storageService";
import { analyzeMedicalRecord, summarizeAllRecords, ExtractedVitals, AIExtractedMedication, AIExtractedCaseDetails } from "../services/geminiService";
import { categorizeMedicalRecord } from "../services/categorizationService";
import { UserService } from "../services/authService";
import { PatientAdditionService } from "../services/patientInvitationService";
import { ChatService } from "../services/chatService";
import { VitalsService } from "../services/dataService";
import { CaseDetailsService } from "../services/caseDetailsService";
import { useDocumentTitle } from "../hooks/useDocumentTitle";


const PatientDashboard: React.FC = () => {
    const { user, profile, signOut } = useAuth();
    const [activeView, setActiveView] = useState<View>("dashboard");

    // Dynamic document title based on view
    const getViewTitle = () => {
        switch (activeView) {
            case "dashboard": return "Patient Portal";
            case "records": return "Medical Records";
            case "upload": return "Upload Record";
            case "messages": return "Messages";
            case "billing": return "Billing & Plan";
            case "doctors": return "My Doctors";
            default: return "Patient Portal";
        }
    };

    useDocumentTitle(getViewTitle());
    const [sidebarOpen, setSidebarOpen] = useState(false);

    // State management
    const [vitals, setVitals] = useState<Vitals>({
        bloodPressure: { value: "", unit: "mmHg", trend: "stable" },
        heartRate: { value: "", unit: "bpm", trend: "stable" },
        temperature: { value: "", unit: "°F", trend: "stable" },
    });

    const [medications, setMedications] = useState<Medication[]>([]);
    const [medicalRecords, setMedicalRecords] = useState<MedicalRecord[]>([]);
    const [doctors, setDoctors] = useState<User[]>([]);
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [allChatContacts, setAllChatContacts] = useState<User[]>([]); // All contacts with chat history
    const [linkedDoctorIds, setLinkedDoctorIds] = useState<string[]>([]); // IDs of currently linked doctors

    // State for fullscreen WhatsApp chat
    const [showFullScreenChat, setShowFullScreenChat] = useState(false);
    const [preselectedChatContactId, setPreselectedChatContactId] = useState<string | null>(null);

    const [aiSummary, setAiSummary] = useState(
        "Upload your first medical record to get an AI-powered health summary."
    );
    const [summaryNote, setSummaryNote] = useState("");
    const [isSummaryLoading, setIsSummaryLoading] = useState(false);
    const [isUploadLoading, setIsUploadLoading] = useState(false);

    const [vitalsLastUpdatedFromRecord, setVitalsLastUpdatedFromRecord] = useState<{
        bloodPressure?: string;
        heartRate?: string;
        temperature?: string;
        glucose?: string;
    }>({});

    // State for extracted medications modal
    const [showExtractedMedsModal, setShowExtractedMedsModal] = useState(false);
    const [extractedMedsData, setExtractedMedsData] = useState<{
        medications: ExtractedMedication[];
        recordId: string;
        recordType: string;
        recordDate: string;
    } | null>(null);

    // Load medical records from database and setup storage
    useEffect(() => {
        const initializeApp = async () => {
            if (user?.id) {
                try {
                    // Initialize storage
                    await testStorageConnection();

                    // Load existing vitals from database
                    const latestVitals = await VitalsService.getLatestVitals(user.id);
                    if (latestVitals) {
                        setVitals(latestVitals);
                        console.log('✅ Loaded vitals from database:', latestVitals);
                    }

                    // Load existing medical records
                    const records = await MedicalRecordsService.getMedicalRecordsByPatientId(user.id);
                    setMedicalRecords(records);

                    // Generate initial AI summary if records exist
                    if (records.length > 0) {
                        setIsSummaryLoading(true);
                        try {
                            const summary = await summarizeAllRecords(records);
                            setAiSummary(summary);
                        } catch (error) {
                            console.error('Error generating initial AI summary:', error);
                        } finally {
                            setIsSummaryLoading(false);
                        }
                    }

                    // Check if we need to extract vitals from the most recent record on app load
                    // This is useful if vitals are empty but we have recent records
                    const hasEmptyVitals = !latestVitals || (!latestVitals.bloodPressure.value && !latestVitals.heartRate.value && !latestVitals.temperature.value);
                    if (hasEmptyVitals && records.length > 0) {
                        // Find the most recent record
                        const sortedRecords = records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                        const mostRecentRecord = sortedRecords[0];

                        // Only check records from the last 30 days to avoid outdated vitals
                        const thirtyDaysAgo = new Date();
                        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

                        if (new Date(mostRecentRecord.date) > thirtyDaysAgo) {
                            // This would require the file to extract vitals, which we don't have access to here
                            // So we'll skip this for now, but the feature will work for newly uploaded records
                        }
                    }
                } catch (error) {
                    console.error('Error initializing app:', error);
                }
            }
        };

        initializeApp();
    }, [user?.id]);

    // Auto-refresh AI summary when records change (debounced)
    useEffect(() => {
        if (medicalRecords.length === 0) {
            setAiSummary("Upload your first medical record to get an AI-powered health summary.");
            return;
        }

        // Debounce the summary generation to avoid too many API calls
        const timeoutId = setTimeout(async () => {
            if (!isSummaryLoading) {
                setIsSummaryLoading(true);
                try {
                    const summary = await summarizeAllRecords(medicalRecords);
                    setAiSummary(summary);
                } catch (error) {
                    console.error('Error auto-refreshing AI summary:', error);
                } finally {
                    setIsSummaryLoading(false);
                }
            }
        }, 1000); // Wait 1 second after records change

        return () => clearTimeout(timeoutId);
    }, [medicalRecords.length]); // Only trigger when the number of records changes

    // Fetch doctors for this patient
    useEffect(() => {
        const fetchDoctors = async () => {
            if (!user?.id) return;
            try {
                const doctorsData = await PatientAdditionService.getPatientDoctors(user.id);
                setDoctors(doctorsData);
                // Track linked doctor IDs
                setLinkedDoctorIds(doctorsData.map(d => d.id));
            } catch (error) {
                console.error('Error fetching doctors:', error);
            }
        };

        fetchDoctors();
    }, [user?.id]);

    // Fetch chat messages and build chat contacts list (including unlinked doctors)
    useEffect(() => {
        const fetchMessagesAndContacts = async () => {
            if (!user?.id) return;
            try {
                const messagesData = await ChatService.getAllConversations(user.id);
                setChatMessages(messagesData);
                
                // Get unique contact IDs from chat messages (other than current user)
                const contactIds = new Set<string>();
                messagesData.forEach(msg => {
                    if (msg.senderId !== user.id) contactIds.add(msg.senderId);
                    if (msg.recipientId !== user.id) contactIds.add(msg.recipientId);
                });
                
                // Fetch contact details for IDs not in the linked doctors list
                const unlinkedIds = Array.from(contactIds).filter(id => !doctors.some(d => d.id === id));
                
                if (unlinkedIds.length > 0) {
                    // Fetch user details for unlinked contacts
                    const { supabase } = await import('../lib/supabase');
                    const { data: unlinkedContacts } = await supabase
                        .from('users')
                        .select('id, name, email, specialty, referral_code, role')
                        .in('id', unlinkedIds)
                        .eq('role', 'doctor');
                    
                    if (unlinkedContacts && unlinkedContacts.length > 0) {
                        // Combine linked doctors with unlinked contacts that have chat history
                        const allContacts = [
                            ...doctors,
                            ...unlinkedContacts.map(c => ({
                                ...c,
                                referralCode: c.referral_code,
                            } as User))
                        ];
                        setAllChatContacts(allContacts);
                    } else {
                        setAllChatContacts(doctors);
                    }
                } else {
                    setAllChatContacts(doctors);
                }
            } catch (error) {
                console.error('Error fetching messages:', error);
            }
        };

        fetchMessagesAndContacts();
    }, [user?.id, doctors]);

    // Convert auth user to app user format
    const appUser = {
        ...profile,
        id: user?.id || profile?.id || "",
        name: profile?.name || user?.user_metadata?.full_name || user?.email || "User",
        email: user?.email || "",
        role: "patient" as const,
        avatarUrl: profile?.avatarUrl || profile?.avatar_url || "",
        urgentCredits: profile?.urgent_credits ?? 5, // Include urgent credits for messaging
        // Ensure patient ID is passed
        patientId: profile?.patientId || profile?.patient_id,
        patient_id: profile?.patientId || profile?.patient_id,
    };

    // Remove debug logging for avatar sources since we no longer use external sources

    // Create patient object
    const patient: Patient = useMemo(
        () => ({
            id: appUser.id,
            name: appUser.name,
            email: appUser.email,
            role: "patient",
            dateOfBirth: profile?.date_of_birth || "1990-01-01",
            condition: profile?.condition || "General Health Monitoring",
            vitals,
            vitalsHistory: [
                {
                    date: new Date().toISOString().split("T")[0],
                    vitals,
                },
            ],
            medications,
            records: medicalRecords,
            doctors: doctors.map(doctor => ({
                ...doctor,
                role: 'doctor' as const,
                specialty: doctor.specialty || 'General Practice'
            })) as Doctor[],
            chatMessages: chatMessages,
            subscriptionTier: profile?.subscription_tier as "FreeTrial" | "Paid" || "FreeTrial",
            urgentCredits: profile?.urgent_credits || 5,
            notes: summaryNote,
            avatarUrl: appUser.avatarUrl,
            trialEndsAt: profile?.trial_ends_at || new Date(Date.now() + 14 * 86400000).toISOString()
        }),
        [appUser, vitals, medications, medicalRecords, doctors, chatMessages, summaryNote, profile]
    );

    // Original event handlers
    const handleVitalsChange = async (vitalKey: keyof Vitals, newValue: string) => {
        // Update local state immediately for responsive UI
        setVitals((prev) => ({
            ...prev,
            [vitalKey]: { ...prev[vitalKey], value: newValue },
        }));

        // Save to database if user is logged in and value is not empty
        if (user?.id && newValue.trim()) {
            try {
                await VitalsService.updateVital(user.id, vitalKey, newValue);
                console.log(`✅ Updated ${vitalKey} in database:`, newValue);
            } catch (error) {
                console.error(`❌ Error updating ${vitalKey} in database:`, error);
                // Could show a toast notification here instead of console.error
            }
        }
    };

    const handleMedicationAdd = (newMedication: Omit<Medication, "id">) => {
        const medication = {
            ...newMedication,
            id: Date.now().toString(),
        };
        setMedications((prev) => [...prev, medication]);
    };

    const handleMedicationChange = (updatedMedication: Medication) => {
        setMedications((prev) =>
            prev.map((med) =>
                med.id === updatedMedication.id ? updatedMedication : med
            )
        );
    };

    const handleMedicationRemove = (medicationId: string) => {
        setMedications((prev) => prev.filter((med) => med.id !== medicationId));
    };

    const handleRefreshSummary = async () => {
        if (isSummaryLoading) {
            return;
        }

        setIsSummaryLoading(true);
        try {
            const summary = await summarizeAllRecords(medicalRecords);
            setAiSummary(summary);
        } catch (error) {
            console.error('Error generating AI summary:', error);
            setAiSummary('Unable to generate summary at this time. Please try again later.');
        } finally {
            setIsSummaryLoading(false);
        }
    };





    // Function to update vitals from extracted medical record data
    const updateVitalsFromRecord = async (extractedVitals: ExtractedVitals, recordDate: string, allRecords: MedicalRecord[]) => {
        // Check if this is the most recent record with vital signs
        const recordsWithDates = allRecords
            .map(record => ({ ...record, dateObj: new Date(record.date) }))
            .sort((a, b) => b.dateObj.getTime() - a.dateObj.getTime());

        const currentRecordDate = new Date(recordDate);
        const mostRecentRecord = recordsWithDates[0];

        // Only update vitals if this is the most recent record or if current vitals are empty
        const isCurrentVitalsEmpty = !vitals.bloodPressure.value && !vitals.heartRate.value && !vitals.temperature.value;
        const isMostRecentRecord = mostRecentRecord.dateObj.getTime() === currentRecordDate.getTime();
        const shouldUpdate = isMostRecentRecord || isCurrentVitalsEmpty;

        if (!shouldUpdate) {
            return;
        }

        const updatedVitals = { ...vitals };
        let hasUpdates = false;
        const updatedFields: string[] = [];

        // Update blood pressure
        if (extractedVitals.bloodPressure) {
            const { systolic, diastolic } = extractedVitals.bloodPressure;
            updatedVitals.bloodPressure = {
                value: `${systolic}/${diastolic}`,
                unit: "mmHg",
                trend: "stable"
            };
            hasUpdates = true;
            updatedFields.push("Blood Pressure");
        }

        // Update heart rate
        if (extractedVitals.heartRate) {
            updatedVitals.heartRate = {
                value: extractedVitals.heartRate.toString(),
                unit: "bpm",
                trend: "stable"
            };
            hasUpdates = true;
            updatedFields.push("Heart Rate");
        }

        // Update temperature
        if (extractedVitals.temperature) {
            const { value, unit } = extractedVitals.temperature;
            // Convert to Fahrenheit if needed
            const tempInF = unit === 'C' ? (value * 9 / 5) + 32 : value;
            updatedVitals.temperature = {
                value: tempInF.toFixed(1),
                unit: "°F",
                trend: "stable"
            };
            hasUpdates = true;
            updatedFields.push("Temperature");
        }

        // Update glucose if available
        if (extractedVitals.glucose && updatedVitals.glucose) {
            updatedVitals.glucose = {
                value: extractedVitals.glucose.toString(),
                unit: "mg/dL",
                trend: "stable"
            };
            hasUpdates = true;
            updatedFields.push("Blood Glucose");
        } else if (extractedVitals.glucose) {
            // Add glucose if it doesn't exist
            updatedVitals.glucose = {
                value: extractedVitals.glucose.toString(),
                unit: "mg/dL",
                trend: "stable"
            };
            hasUpdates = true;
            updatedFields.push("Blood Glucose");
        }

        if (hasUpdates && user?.id) {
            try {
                // Save vitals to database
                await VitalsService.addVitals(user.id, updatedVitals);
                console.log('✅ Vitals saved to database:', updatedVitals);

                // Update local state
                setVitals(updatedVitals);

                // Update the tracking of when vitals were last updated from records
                setVitalsLastUpdatedFromRecord(prev => {
                    const updated = { ...prev };
                    if (extractedVitals.bloodPressure) updated.bloodPressure = recordDate;
                    if (extractedVitals.heartRate) updated.heartRate = recordDate;
                    if (extractedVitals.temperature) updated.temperature = recordDate;
                    if (extractedVitals.glucose) updated.glucose = recordDate;
                    return updated;
                });

                // Show a single notification to the user
                setTimeout(() => {
                    const fieldsText = updatedFields.join(", ");
                    alert(`Vital signs updated and saved: ${fieldsText}\nFrom medical record dated ${new Date(recordDate).toLocaleDateString()}`);
                }, 1000);
            } catch (error) {
                console.error('❌ Error saving vitals to database:', error);
                // Still update local state even if database save fails
                setVitals(updatedVitals);

                setTimeout(() => {
                    const fieldsText = updatedFields.join(", ");
                    alert(`Vital signs updated locally: ${fieldsText}\nWarning: Could not save to database. Please check your connection.`);
                }, 1000);
            }
        }
    };

    const handleFileUpload = async (file: File) => {
        if (!user?.id) {
            alert('Please log in to upload files.');
            return;
        }

        setIsUploadLoading(true);

        try {
            // Step 1: AI categorizes the document (fast, minimal tokens)
            console.log('🤖 Step 1: AI categorizing document...');
            const category = await categorizeMedicalRecord(file);
            console.log(`✅ Document categorized as: ${category}`);

            // Step 2: Start file upload and detailed AI analysis in parallel
            const uploadPromise = (async () => {
                try {
                    // Try simplified upload first (skips bucket existence check)
                    return await uploadFileToSupabaseSimple(file);
                } catch (simpleError) {
                    // Fallback to full upload method
                    return await uploadFileToSupabase(file);
                }
            })();

            const analysisPromise = analyzeMedicalRecord(file);

            // Wait for both operations to complete
            console.log('⏳ Step 2: Uploading file and analyzing content...');
            const [fileUrl, analysisResult] = await Promise.all([
                uploadPromise,
                analysisPromise
            ]);

            // Extract vitals from the combined analysis result
            const extractedVitals = analysisResult.extractedVitals;

            // Create the medical record in the database
            const newRecord = await MedicalRecordsService.createMedicalRecord({
                patientId: user.id,
                date: analysisResult.date,
                type: analysisResult.type,
                summary: analysisResult.summary,
                doctor: analysisResult.doctor,
                category: category, // Use AI-generated category
                fileUrl: fileUrl,
            });

            // Update local state with the new record
            const updatedRecords = [newRecord, ...medicalRecords];
            setMedicalRecords(updatedRecords);

            // Update vitals if extracted from the medical record
            if (extractedVitals) {
                await updateVitalsFromRecord(extractedVitals, newRecord.date, updatedRecords);
            } else {
                console.log('❌ No vitals extracted from the medical record');

                // For testing when AI quota is exceeded: simulate vitals extraction
                // This helps test the vitals update feature when AI is unavailable
                if (analysisResult.summary.toLowerCase().includes('patient') ||
                    analysisResult.type.toLowerCase().includes('doctor') ||
                    analysisResult.type.toLowerCase().includes('medical')) {

                    const simulatedVitals: ExtractedVitals = {
                        bloodPressure: { systolic: 120, diastolic: 80 },
                        heartRate: 72,
                        temperature: { value: 98.6, unit: "F" },
                        date: newRecord.date
                    };

                    console.log('🧪 AI quota exceeded - using simulated vitals for testing:', simulatedVitals);
                    await updateVitalsFromRecord(simulatedVitals, newRecord.date, updatedRecords);
                }
            }

            // Generate AI summary with the updated records immediately
            setIsSummaryLoading(true);

            try {
                const summary = await summarizeAllRecords(updatedRecords);
                setAiSummary(summary);
            } catch (summaryError) {
                console.error('Error generating AI summary:', summaryError);
                // Don't fail the entire upload if summary generation fails
                setAiSummary('Record uploaded successfully. Summary will be updated shortly.');
            } finally {
                setIsSummaryLoading(false);
            }

            // Switch to records view to show the new record
            setActiveView("records");

            // Create a more informative success message
            let successMessage = 'Medical record uploaded and analyzed successfully!';
            if (extractedVitals) {
                const extractedFields = [];
                if (extractedVitals.bloodPressure) extractedFields.push('Blood Pressure');
                if (extractedVitals.heartRate) extractedFields.push('Heart Rate');
                if (extractedVitals.temperature) extractedFields.push('Temperature');
                if (extractedVitals.glucose) extractedFields.push('Blood Glucose');

                if (extractedFields.length > 0) {
                    successMessage += `\n\n📊 Vital signs detected: ${extractedFields.join(', ')}`;
                }
            }

            // Check for extracted medications
            const extractedMeds = analysisResult.extractedMedications;
            if (extractedMeds && extractedMeds.length > 0) {
                successMessage += `\n\n💊 ${extractedMeds.length} medication(s) detected!`;
                // Convert to ExtractedMedication format and show modal
                setExtractedMedsData({
                    medications: extractedMeds.map((m: AIExtractedMedication) => ({
                        name: m.name,
                        dosage: m.dosage,
                        unit: m.unit,
                        frequency: m.frequency,
                        instructions: m.instructions,
                    })),
                    recordId: newRecord.id,
                    recordType: newRecord.type,
                    recordDate: newRecord.date,
                });
                setShowExtractedMedsModal(true);
            }

            // Update case details if extracted
            const extractedCaseDetails = analysisResult.extractedCaseDetails;
            if (extractedCaseDetails && user?.id) {
                try {
                    await CaseDetailsService.autoPopulateFromRecord(user.id, {
                        'Current Issue/Reason for Visit': extractedCaseDetails.latestComplaint ? [extractedCaseDetails.latestComplaint] : undefined,
                        'Medical History': extractedCaseDetails.medicalHistory,
                        'Diagnosis': extractedCaseDetails.primaryCondition ? [extractedCaseDetails.primaryCondition] : undefined,
                    });
                    console.log('📋 Case details updated from record');
                } catch (caseError) {
                    console.error('Error updating case details:', caseError);
                }
            }

            alert(successMessage);

        } catch (error) {
            console.error('Error in file upload process:', error);

            let errorMessage = 'Failed to upload and analyze the medical record.';
            if (error instanceof Error) {
                errorMessage += ` Error: ${error.message}`;


            }

            alert(errorMessage + ' Please check the console for more details.');
        } finally {
            setIsUploadLoading(false);
        }
    };

    const renderContent = () => {
        switch (activeView) {
            case "dashboard":
                return (
                    <CKDDashboard
                        patient={patient}
                        onNavigateToDoctors={() => setActiveView("doctors")}
                    />
                );
            case "records":
                return (
                    <Records
                        records={patient.records}
                        onRemoveRecord={async (recordId) => {
                            try {
                                // Delete the record and get the file URL
                                const fileUrl = await MedicalRecordsService.deleteMedicalRecord(recordId);

                                // Delete the file from storage if it exists
                                if (fileUrl) {
                                    const storageDeleted = await deleteFileFromSupabase(fileUrl);
                                    if (!storageDeleted) {
                                        console.warn('Record deleted from database but file may still exist in storage');
                                    }
                                }

                                // Update local state
                                setMedicalRecords((prev) =>
                                    prev.filter((record) => record.id !== recordId)
                                );

                                // Refresh AI summary after removing record (only if there are remaining records)
                                const remainingRecords = medicalRecords.filter((record) => record.id !== recordId);
                                if (remainingRecords.length > 0) {
                                    // Use the remaining records directly to avoid state delay
                                    const summary = await summarizeAllRecords(remainingRecords);
                                    setAiSummary(summary);
                                } else {
                                    setAiSummary("Upload your first medical record to get an AI-powered health summary.");
                                }

                            } catch (error) {
                                console.error('Error removing record:', error);
                                alert('Failed to remove record. Please try again.');
                            }
                        }}
                    />
                );
            case "upload":
                return (
                    <div className="space-y-6">
                        <Upload
                            onUpload={handleFileUpload}
                            isLoading={isUploadLoading}
                        />
                    </div>
                );
            case "messages":
                // Open fullscreen chat automatically when messages view is selected
                if (!showFullScreenChat) {
                    // Clear preselected contact when opening from navbar to show contact list
                    setPreselectedChatContactId(null);
                    setShowFullScreenChat(true);
                }
                return null;
            case "billing":
                return (
                    <Billing
                        patient={patient}
                        onPurchaseCredits={(amount) => {
                            console.log("Purchasing credits:", amount);
                            // In a real app, this would handle payment processing
                        }}
                        onUpgradeSubscription={(tier) => {
                            console.log("Upgrading subscription to:", tier);
                            // In a real app, this would handle subscription upgrade
                        }}
                    />
                );
            case "doctors":
                return (
                    <DoctorsPage
                        patientId={user!.id}
                        onNavigateToChat={(doctorId) => {
                            // Navigate to messages and could pre-select the doctor
                            setActiveView("messages");
                        }}
                        onDoctorLinked={async () => {
                            // Refresh doctors list so Messages component has updated contacts
                            if (user?.id) {
                                try {
                                    const doctorsData = await PatientAdditionService.getPatientDoctors(user.id);
                                    setDoctors(doctorsData);
                                } catch (error) {
                                    console.error('Error refreshing doctors:', error);
                                }
                            }
                        }}
                    />
                );
            default:
                return (
                    <Dashboard
                        patient={patient}
                        aiSummary={aiSummary}
                        onRefreshSummary={handleRefreshSummary}
                        isSummaryLoading={isSummaryLoading}
                        onSummaryChange={setAiSummary}
                        summaryNote={summaryNote}
                        onSummaryNoteChange={setSummaryNote}
                        onVitalsChange={handleVitalsChange}
                        onMedicationAdd={handleMedicationAdd}
                        onMedicationChange={handleMedicationChange}
                        onMedicationRemove={handleMedicationRemove}
                        vitalsLastUpdatedFromRecord={vitalsLastUpdatedFromRecord}
                    />
                );
        }
    };

    return (
        <UrgentCreditsProvider userId={user?.id || ''} initialCredits={profile?.urgent_credits ?? 5}>
            <NotificationProvider userId={user?.id || ''} activeView={activeView} userRole="patient">
                <div className="h-screen bg-gray-100 dark:bg-black flex flex-col md:flex-row overflow-hidden">
                    {/* Sidebar */}

                    <SidebarWithNotifications
                        activeView={activeView}
                        setActiveView={setActiveView}
                        isOpen={sidebarOpen}
                        onClose={() => setSidebarOpen(false)}
                    />

                    {/* Mobile Bottom Nav */}
                    <MobileBottomNavWithNotifications
                        activeView={activeView}
                        setActiveView={setActiveView}
                    />

                    {/* Main content wrapper */}
                    <div className="flex-1 flex flex-col min-w-0 w-full md:w-auto h-full overflow-hidden">
                        {/* Hide header on mobile when in messages view */}
                        <div className={`flex-shrink-0 ${activeView === 'messages' ? 'hidden md:block' : ''}`}>
                            <Header
                                user={appUser}
                                onLogout={signOut}
                                onMenuClick={() => setSidebarOpen(true)}
                                onTitleClick={() => setActiveView('dashboard')}
                                showMenu={false}
                            />
                        </div>

                        <main className={`flex-1 min-h-0 ${activeView === 'messages' ? 'px-2 sm:px-4 pt-2 sm:pt-4 pb-20 sm:pb-24 md:pb-4 flex flex-col overflow-hidden' : 'overflow-y-auto px-2 sm:px-4 md:px-5 lg:px-6 pt-3 sm:pt-4 md:pt-6 pb-24 sm:pb-28 md:pb-8'}`}>{renderContent()}</main>
                    </div>

                    {/* Extracted Medications Modal */}
                    {extractedMedsData && (
                        <ExtractedMedicationsModal
                            isOpen={showExtractedMedsModal}
                            onClose={() => {
                                setShowExtractedMedsModal(false);
                                setExtractedMedsData(null);
                            }}
                            extractedMedications={extractedMedsData.medications}
                            sourceRecordId={extractedMedsData.recordId}
                            sourceRecordType={extractedMedsData.recordType}
                            sourceRecordDate={extractedMedsData.recordDate}
                            patientId={user?.id || ''}
                            onMedicationsAdded={(added, skipped) => {
                                console.log(`✅ Added ${added.length} medications, skipped ${skipped.length}`);
                                if (added.length > 0) {
                                    alert(`${added.length} medication(s) added to your tracker!${skipped.length > 0 ? `\n${skipped.length} already existed and were skipped.` : ''}`);
                                }
                            }}
                        />
                    )}

                    {/* WhatsApp-style Full Screen Chat */}
                    {showFullScreenChat && (
                        <WhatsAppChatWindow
                            key={preselectedChatContactId ? `chat-${preselectedChatContactId}` : 'chat-list'}
                            currentUser={appUser}
                            contacts={allChatContacts.length > 0 ? allChatContacts.map(d => ({
                                ...d,
                                role: 'doctor' as const,
                                specialty: d.specialty || 'General Practice'
                            })) : patient.doctors}
                            messages={patient.chatMessages}
                            linkedContactIds={linkedDoctorIds}
                            onSendMessage={async (message) => {
                                try {
                                    await ChatService.sendMessage(
                                        message.senderId,
                                        message.recipientId,
                                        message.text,
                                        message.isUrgent
                                    );
                                    const updatedMessages = await ChatService.getAllConversations(user!.id);
                                    setChatMessages(updatedMessages);
                                } catch (error) {
                                    console.error("Error sending message:", error);
                                    alert("Failed to send message. Please try again.");
                                }
                            }}
                            onMarkMessagesAsRead={(contactId) => {
                                console.log("Marking messages as read for:", contactId);
                            }}
                            preselectedContactId={preselectedChatContactId}
                            clearPreselectedContact={() => setPreselectedChatContactId(null)}
                            onNavigateToBilling={() => {
                                setShowFullScreenChat(false);
                                setActiveView("billing");
                            }}
                            onNavigateToDoctors={() => {
                                setShowFullScreenChat(false);
                                setActiveView("doctors");
                            }}
                            onClose={() => {
                                setShowFullScreenChat(false);
                                setActiveView("dashboard");
                            }}
                            isFullScreen={true}
                        />
                    )}
                </div>
            </NotificationProvider>
        </UrgentCreditsProvider>
    );
};

// Sidebar wrapper that uses notification context
const SidebarWithNotifications: React.FC<{
    activeView: View;
    setActiveView: (view: View) => void;
    isOpen: boolean;
    onClose: () => void;
}> = ({ activeView, setActiveView, isOpen, onClose }) => {
    const { unreadMessageCount, hasUrgentMessages } = useNotifications();

    return (
        <Sidebar
            activeView={activeView}
            setActiveView={setActiveView}
            isOpen={isOpen}
            onClose={onClose}
            unreadMessageCount={unreadMessageCount}
            hasUrgentMessages={hasUrgentMessages}
        />
    );
};

// Mobile Bottom Nav wrapper that uses notification context
const MobileBottomNavWithNotifications: React.FC<{
    activeView: View;
    setActiveView: (view: View) => void;
}> = ({ activeView, setActiveView }) => {
    const { unreadMessageCount, hasUrgentMessages } = useNotifications();

    return (
        <MobileBottomNav
            activeView={activeView}
            setActiveView={setActiveView}
            unreadMessageCount={unreadMessageCount}
            hasUrgentMessages={hasUrgentMessages}
        />
    );
};

export default PatientDashboard;

