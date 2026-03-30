import React, { useState, useEffect } from 'react';
import { UpcomingTest } from '../types';
import { UpcomingTestsService } from '../services/upcomingTestsService';
import { CalendarIcon } from './icons/CalendarIcon';
import { LocationIcon } from './icons/LocationIcon';
import { DoctorIcon } from './icons/DoctorIcon';
import { BeakerIcon } from './icons/BeakerIcon';
import { ChatIcon } from './icons/ChatIcon';
import { AlertIcon } from './icons/AlertIcon';
import { TrashIcon } from './icons/TrashIcon';

interface UpcomingTestsCardProps {
    patientId: string;
}

const UpcomingTestsCard: React.FC<UpcomingTestsCardProps> = ({ patientId }) => {
    const [upcomingTests, setUpcomingTests] = useState<UpcomingTest[]>([]);
    const [overdueTests, setOverdueTests] = useState<UpcomingTest[]>([]);
    const [isAddingTest, setIsAddingTest] = useState(false);
    const [deletingTestId, setDeletingTestId] = useState<string | null>(null);
    const [newTest, setNewTest] = useState({
        testName: '',
        scheduledDate: '',
        location: '',
        doctorName: '',
        notes: ''
    });
    const [showCompleted, setShowCompleted] = useState(false);

    useEffect(() => {
        loadTests();
    }, [patientId, showCompleted]);

    const loadTests = async () => {
        try {
            const [upcoming, overdue] = await Promise.all([
                UpcomingTestsService.getTestsInNextDays(patientId, 60),
                UpcomingTestsService.getOverdueTests(patientId)
            ]);
            setUpcomingTests(upcoming);
            setOverdueTests(overdue);
        } catch (error) {
            console.error('Error loading upcoming tests:', error);
        }
    };

    const handleAddTest = async () => {
        if (!newTest.testName || !newTest.scheduledDate) {
            alert('Please enter test name and date');
            return;
        }

        try {
            await UpcomingTestsService.addUpcomingTest(
                patientId,
                newTest.testName,
                newTest.scheduledDate,
                newTest.location,
                newTest.doctorName,
                newTest.notes
            );
            await loadTests();
            setIsAddingTest(false);
            setNewTest({
                testName: '',
                scheduledDate: '',
                location: '',
                doctorName: '',
                notes: ''
            });
        } catch (error) {
            console.error('Error adding test:', error);
            alert('Failed to add test. Please try again.');
        }
    };

    const handleToggleComplete = async (testId: string, isCompleted: boolean) => {
        try {
            if (isCompleted) {
                await UpcomingTestsService.markTestIncomplete(testId);
            } else {
                await UpcomingTestsService.markTestComplete(testId);
            }
            await loadTests();
        } catch (error) {
            console.error('Error toggling test completion:', error);
            alert('Failed to update test. Please try again.');
        }
    };

    const handleDeleteTest = async (testId: string) => {
        if (!confirm('Delete this test?')) return;

        // Start the trashing animation
        setDeletingTestId(testId);
        
        // Wait for animation to complete
        await new Promise(resolve => setTimeout(resolve, 500));

        try {
            await UpcomingTestsService.deleteUpcomingTest(testId);
            await loadTests();
        } catch (error) {
            console.error('Error deleting test:', error);
            alert('Failed to delete test. Please try again.');
        } finally {
            setDeletingTestId(null);
        }
    };

    const getDaysUntil = (dateString: string): number => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const testDate = new Date(dateString);
        testDate.setHours(0, 0, 0, 0);
        const diffTime = testDate.getTime() - today.getTime();
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    };

    const getDateColor = (daysUntil: number): string => {
        if (daysUntil < 0) return 'text-red-600 dark:text-red-400';
        if (daysUntil <= 7) return 'text-orange-600 dark:text-orange-400';
        if (daysUntil <= 14) return 'text-yellow-600 dark:text-yellow-400';
        return 'text-gray-600 dark:text-gray-400';
    };

    const allTests = [...overdueTests, ...upcomingTests];

    return (
        <div className="bg-white dark:bg-[#8AC43C]/[0.08] backdrop-blur-md p-3 sm:p-4 rounded-xl sm:rounded-2xl shadow-[0_6px_16px_rgba(0,0,0,0.06)] dark:shadow-[0_0_15px_rgba(138,196,60,0.1)] transition-all duration-300 border border-transparent dark:border-[#8AC43C]/20">
            <div className="flex items-center justify-between mb-2 sm:mb-3">
                <h3 className="text-base sm:text-lg md:text-xl font-bold text-[#222222] dark:text-white">Upcoming Tests</h3>
                <button
                    onClick={() => setIsAddingTest(true)}
                    className="min-w-[90px] sm:min-w-[100px] md:min-w-[120px] px-2.5 sm:px-3 md:px-4 py-1.5 sm:py-2 text-[10px] sm:text-xs font-bold text-white dark:text-[#222222] bg-[#8AC43C] rounded-full hover:opacity-90 transition-all shadow-sm active:scale-95"
                >
                    + Schedule Test
                </button>
            </div>

            {/* Add Test Modal */}
            {isAddingTest && (
                <div className="mb-4 sm:mb-6 md:mb-8 p-3 sm:p-4 md:p-6 bg-gray-50 dark:bg-gray-800/50 rounded-xl sm:rounded-2xl border-none">
                    <h4 className="text-sm sm:text-base md:text-lg font-bold text-[#222222] dark:text-white mb-3 sm:mb-4 md:mb-6">Schedule New Test</h4>
                    <div className="space-y-2 sm:space-y-3 mb-3 sm:mb-4">
                        <div>
                            <label className="block text-[10px] sm:text-xs md:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 sm:mb-2">Test Name</label>
                            <select
                                value={newTest.testName}
                                onChange={(e) => setNewTest({ ...newTest, testName: e.target.value })}
                                className="w-full px-2 sm:px-3 md:px-4 py-2 sm:py-2.5 md:py-3 bg-white dark:bg-[#1e1e1e] border-none rounded-lg sm:rounded-xl text-xs sm:text-sm md:text-base font-semibold text-[#222222] dark:text-white shadow-sm focus:ring-2 focus:ring-[#222222] transition-all"
                            >
                                <option value="">Select a test...</option>
                                {UpcomingTestsService.COMMON_TESTS.map((test) => (
                                    <option key={test} value={test}>{test}</option>
                                ))}
                                <option value="custom">Other (type below)</option>
                            </select>
                            {newTest.testName === 'custom' && (
                                <input
                                    type="text"
                                    placeholder="Enter custom test name"
                                    onChange={(e) => setNewTest({ ...newTest, testName: e.target.value })}
                                    className="w-full mt-2 px-2 sm:px-3 py-1.5 sm:py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary-700 text-xs sm:text-sm text-gray-900 dark:text-gray-100"
                                />
                            )}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
                            <div>
                                <label className="block text-[10px] sm:text-xs md:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 sm:mb-2">Date</label>
                                <input
                                    type="date"
                                    value={newTest.scheduledDate}
                                    onChange={(e) => setNewTest({ ...newTest, scheduledDate: e.target.value })}
                                    min={new Date().toISOString().split('T')[0]}
                                    className="w-full px-2 sm:px-3 md:px-4 py-2 sm:py-2.5 md:py-3 bg-white dark:bg-[#1e1e1e] border-none rounded-lg sm:rounded-xl text-xs sm:text-sm md:text-base font-semibold text-[#222222] dark:text-white shadow-sm focus:ring-2 focus:ring-[#222222] transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-[10px] sm:text-xs md:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 sm:mb-2">Location</label>
                                <input
                                    type="text"
                                    value={newTest.location}
                                    onChange={(e) => setNewTest({ ...newTest, location: e.target.value })}
                                    placeholder="Lab location"
                                    className="w-full px-2 sm:px-3 md:px-4 py-2 sm:py-2.5 md:py-3 bg-white dark:bg-[#1e1e1e] border-none rounded-lg sm:rounded-xl text-xs sm:text-sm md:text-base font-semibold text-[#222222] dark:text-white shadow-sm focus:ring-2 focus:ring-[#222222] transition-all"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-[10px] sm:text-xs md:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 sm:mb-2">Doctor (Optional)</label>
                            <input
                                type="text"
                                value={newTest.doctorName}
                                onChange={(e) => setNewTest({ ...newTest, doctorName: e.target.value })}
                                placeholder="Ordering physician"
                                className="w-full px-2 sm:px-3 py-1.5 sm:py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-xs sm:text-sm text-gray-900 dark:text-gray-100"
                            />
                        </div>
                        <div>
                            <label className="block text-[10px] sm:text-xs md:text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 sm:mb-2">Notes (Optional)</label>
                            <textarea
                                value={newTest.notes}
                                onChange={(e) => setNewTest({ ...newTest, notes: e.target.value })}
                                placeholder="Special instructions..."
                                rows={2}
                                className="w-full px-2 sm:px-3 md:px-4 py-2 sm:py-2.5 md:py-3 bg-white dark:bg-[#1e1e1e] border-none rounded-lg sm:rounded-xl text-xs sm:text-sm md:text-base font-semibold text-[#222222] dark:text-white shadow-sm focus:ring-2 focus:ring-[#222222] transition-all"
                            />
                        </div>
                    </div>
                    <div className="flex gap-2 sm:gap-3">
                        <button
                            onClick={handleAddTest}
                            className="flex-1 min-w-[80px] sm:min-w-[100px] px-3 sm:px-4 py-2 sm:py-2.5 bg-[#8AC43C] hover:bg-[#7ab332] text-white dark:text-[#222222] text-[10px] sm:text-xs font-bold rounded-full transition-colors"
                        >
                            Schedule Test
                        </button>
                        <button
                            onClick={() => setIsAddingTest(false)}
                            className="flex-1 min-w-[80px] sm:min-w-[100px] px-3 sm:px-4 py-2 sm:py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-[#222222] dark:text-white text-[10px] sm:text-xs font-bold rounded-full transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Overdue Alert */}
            {overdueTests.length > 0 && (
                <div className="mb-3 sm:mb-4 p-2.5 sm:p-3 md:p-4 bg-gradient-to-r from-red-500/10 to-rose-500/10 dark:from-red-500/20 dark:to-rose-500/20 border border-red-200 dark:border-red-500/30 rounded-xl sm:rounded-2xl flex items-center gap-2 sm:gap-3">
                    <div className="p-1.5 sm:p-2 bg-red-500 rounded-lg sm:rounded-xl flex-shrink-0">
                        <AlertIcon className="w-3 h-3 sm:w-4 sm:h-4 text-white" />
                    </div>
                    <p className="text-[10px] sm:text-xs md:text-sm font-bold text-red-700 dark:text-red-400 tracking-tight">
                        {overdueTests.length} overdue test{overdueTests.length > 1 ? 's' : ''} need{overdueTests.length === 1 ? 's' : ''} attention
                    </p>
                </div>
            )}

            {/* Tests List */}
            <div className="space-y-2 sm:space-y-3 max-h-80 sm:max-h-96 overflow-y-auto scrollbar-hide">
                {allTests.length > 0 ? (
                    allTests.map((test) => {
                        const daysUntil = getDaysUntil(test.scheduledDate);
                        const isOverdue = daysUntil < 0;
                        const isToday = daysUntil === 0;
                        const isThisWeek = daysUntil > 0 && daysUntil <= 7;

                        return (
                            <div
                                key={test.id}
                                className={`group p-2.5 sm:p-3 md:p-4 rounded-xl sm:rounded-2xl border transition-all duration-300 hover:scale-[1.01] ${
                                    deletingTestId === test.id
                                        ? 'animate-trash-out opacity-0 scale-95 -translate-x-4 rotate-[-2deg]'
                                        : ''
                                } ${
                                    isOverdue
                                        ? 'bg-gradient-to-br from-red-50 to-rose-100 dark:from-red-500/10 dark:to-rose-600/5 border-red-200/50 dark:border-red-500/20 hover:shadow-lg hover:shadow-red-500/10'
                                        : isToday
                                        ? 'bg-gradient-to-br from-amber-50 to-orange-100 dark:from-amber-500/10 dark:to-orange-600/5 border-amber-200/50 dark:border-amber-500/20 hover:shadow-lg hover:shadow-amber-500/10'
                                        : isThisWeek
                                        ? 'bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-blue-500/10 dark:to-indigo-600/5 border-blue-200/50 dark:border-blue-500/20 hover:shadow-lg hover:shadow-blue-500/10'
                                        : 'bg-gradient-to-br from-gray-50 to-slate-100 dark:from-gray-500/10 dark:to-slate-600/5 border-gray-200/50 dark:border-gray-500/20 hover:shadow-lg hover:shadow-gray-500/10'
                                }`}
                                style={{
                                    transition: deletingTestId === test.id 
                                        ? 'all 0.5s cubic-bezier(0.4, 0, 0.2, 1)' 
                                        : 'all 0.2s ease'
                                }}
                            >
                                <div className="flex items-start gap-2 sm:gap-3">
                                    {/* Custom Checkbox */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleToggleComplete(test.id, test.completed);
                                        }}
                                        className={`mt-0.5 w-4 h-4 sm:w-5 sm:h-5 rounded-md sm:rounded-lg border-2 flex items-center justify-center transition-all duration-200 flex-shrink-0 ${
                                            test.completed
                                                ? 'bg-[#8AC43C] border-[#8AC43C] text-white'
                                                : 'border-gray-300 dark:border-gray-600 hover:border-[#8AC43C] dark:hover:border-[#8AC43C]'
                                        }`}
                                    >
                                        {test.completed && (
                                            <svg className="w-2 h-2 sm:w-3 sm:h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                            </svg>
                                        )}
                                    </button>
                                    
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap">
                                            <h4 className={`text-xs sm:text-sm md:text-base font-bold text-[#222222] dark:text-white tracking-tight ${test.completed ? 'line-through opacity-50' : ''}`}>
                                                {test.testName}
                                            </h4>
                                            {isOverdue && (
                                                <span className="px-1.5 sm:px-2 py-0.5 text-[8px] sm:text-[10px] font-bold uppercase tracking-wider bg-red-500 text-white rounded-full">
                                                    Overdue
                                                </span>
                                            )}
                                            {isToday && !isOverdue && (
                                                <span className="px-1.5 sm:px-2 py-0.5 text-[8px] sm:text-[10px] font-bold uppercase tracking-wider bg-amber-500 text-white rounded-full">
                                                    Today
                                                </span>
                                            )}
                                        </div>
                                        
                                        <div className="flex flex-wrap items-center gap-2 sm:gap-3 md:gap-4 mt-1 sm:mt-2">
                                            <div className={`flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs font-semibold tracking-tight ${
                                                isOverdue ? 'text-red-600 dark:text-red-400' :
                                                isToday ? 'text-amber-600 dark:text-amber-400' :
                                                isThisWeek ? 'text-blue-600 dark:text-blue-400' :
                                                'text-[#717171] dark:text-[#a0a0a0]'
                                            }`}>
                                                <CalendarIcon className="w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0" />
                                                <span>{new Date(test.scheduledDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                                                {!isOverdue && daysUntil > 0 && (
                                                    <span className="text-[#717171] dark:text-[#a0a0a0] font-medium hidden sm:inline">• in {daysUntil}d</span>
                                                )}
                                            </div>
                                            
                                            {test.location && (
                                                <div className="flex items-center gap-1 sm:gap-1.5 text-[10px] sm:text-xs font-medium text-[#717171] dark:text-[#a0a0a0] tracking-tight">
                                                    <LocationIcon className="w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0" />
                                                    <span className="truncate max-w-[80px] sm:max-w-none">{test.location}</span>
                                                </div>
                                            )}
                                        </div>
                                        
                                        {test.doctorName && (
                                            <div className="text-[10px] sm:text-xs text-[#717171] dark:text-[#a0a0a0] mt-1 sm:mt-2 flex items-center gap-1 sm:gap-1.5 font-medium tracking-tight">
                                                <DoctorIcon className="w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0" />
                                                <span>Dr. {test.doctorName}</span>
                                            </div>
                                        )}
                                        
                                        {test.notes && (
                                            <div className="text-[10px] sm:text-xs text-[#717171] dark:text-[#a0a0a0] mt-1 sm:mt-2 flex items-center gap-1 sm:gap-1.5 bg-white/50 dark:bg-black/20 px-2 sm:px-2.5 py-1 sm:py-1.5 rounded-lg sm:rounded-xl font-medium">
                                                <ChatIcon className="w-3 h-3 sm:w-3.5 sm:h-3.5 flex-shrink-0" />
                                                <span className="italic truncate">{test.notes}</span>
                                            </div>
                                        )}
                                    </div>
                                    
                                    {/* Delete Button */}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteTest(test.id);
                                        }}
                                        disabled={deletingTestId === test.id}
                                        className={`p-1.5 sm:p-2 rounded-lg sm:rounded-xl transition-all duration-200 flex-shrink-0 ${
                                            deletingTestId === test.id
                                                ? 'opacity-100 text-red-600 animate-bounce'
                                                : 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20'
                                        }`}
                                        title="Delete test"
                                    >
                                        <TrashIcon className={`w-3 h-3 sm:w-4 sm:h-4 ${deletingTestId === test.id ? 'animate-wiggle' : ''}`} />
                                    </button>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <div className="text-center py-8 sm:py-12">
                        <div className="inline-flex items-center justify-center w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-gray-100 dark:bg-gray-800 mb-3 sm:mb-4">
                            <BeakerIcon className="w-6 h-6 sm:w-8 sm:h-8 text-[#717171] dark:text-[#a0a0a0]" />
                        </div>
                        <p className="text-xs sm:text-sm text-[#717171] dark:text-[#a0a0a0] font-bold tracking-tight">No upcoming tests scheduled</p>
                        <p className="text-[10px] sm:text-xs text-[#717171] dark:text-[#a0a0a0] mt-1 font-medium">Click "Schedule Test" to add one</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UpcomingTestsCard;
