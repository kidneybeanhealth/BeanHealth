import React, { useState, useEffect } from 'react';
import { UpcomingTest } from '../types';
import { UpcomingTestsService } from '../services/upcomingTestsService';

interface UpcomingTestsCardProps {
    patientId: string;
}

const UpcomingTestsCard: React.FC<UpcomingTestsCardProps> = ({ patientId }) => {
    const [upcomingTests, setUpcomingTests] = useState<UpcomingTest[]>([]);
    const [overdueTests, setOverdueTests] = useState<UpcomingTest[]>([]);
    const [isAddingTest, setIsAddingTest] = useState(false);
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

        try {
            await UpcomingTestsService.deleteUpcomingTest(testId);
            await loadTests();
        } catch (error) {
            console.error('Error deleting test:', error);
            alert('Failed to delete test. Please try again.');
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
        <div className="bg-white dark:bg-[#8AC43C]/[0.08] backdrop-blur-md p-4 rounded-2xl shadow-[0_6px_16px_rgba(0,0,0,0.06)] dark:shadow-[0_0_15px_rgba(138,196,60,0.1)] transition-all duration-300 border border-transparent dark:border-[#8AC43C]/20">
            <div className="flex items-center justify-between mb-3">
                <h3 className="text-xl font-bold text-[#222222] dark:text-white">Upcoming Tests</h3>
                <button
                    onClick={() => setIsAddingTest(true)}
                    className="min-w-[120px] px-4 py-2 text-xs font-bold text-white dark:text-[#222222] bg-[#8AC43C] rounded-full hover:opacity-90 transition-all shadow-sm active:scale-95"
                >
                    + Schedule Test
                </button>
            </div>

            {/* Add Test Modal */}
            {isAddingTest && (
                <div className="mb-8 p-6 bg-gray-50 dark:bg-gray-800/50 rounded-2xl border-none">
                    <h4 className="text-lg font-bold text-[#222222] dark:text-white mb-6">Schedule New Test</h4>
                    <div className="space-y-3 mb-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Test Name</label>
                            <select
                                value={newTest.testName}
                                onChange={(e) => setNewTest({ ...newTest, testName: e.target.value })}
                                className="w-full px-4 py-3 bg-white dark:bg-[#1e1e1e] border-none rounded-xl text-base font-semibold text-[#222222] dark:text-white shadow-sm focus:ring-2 focus:ring-[#222222] transition-all"
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
                                    className="w-full mt-2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-secondary-700 text-gray-900 dark:text-gray-100"
                                />
                            )}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Date</label>
                                <input
                                    type="date"
                                    value={newTest.scheduledDate}
                                    onChange={(e) => setNewTest({ ...newTest, scheduledDate: e.target.value })}
                                    min={new Date().toISOString().split('T')[0]}
                                    className="w-full px-4 py-3 bg-white dark:bg-[#1e1e1e] border-none rounded-xl text-base font-semibold text-[#222222] dark:text-white shadow-sm focus:ring-2 focus:ring-[#222222] transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Location</label>
                                <input
                                    type="text"
                                    value={newTest.location}
                                    onChange={(e) => setNewTest({ ...newTest, location: e.target.value })}
                                    placeholder="Lab location"
                                    className="w-full px-4 py-3 bg-white dark:bg-[#1e1e1e] border-none rounded-xl text-base font-semibold text-[#222222] dark:text-white shadow-sm focus:ring-2 focus:ring-[#222222] transition-all"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Doctor (Optional)</label>
                            <input
                                type="text"
                                value={newTest.doctorName}
                                onChange={(e) => setNewTest({ ...newTest, doctorName: e.target.value })}
                                placeholder="Ordering physician"
                                className="w-full px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-gray-900 dark:text-gray-100"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Notes (Optional)</label>
                            <textarea
                                value={newTest.notes}
                                onChange={(e) => setNewTest({ ...newTest, notes: e.target.value })}
                                placeholder="Special instructions..."
                                rows={2}
                                className="w-full px-4 py-3 bg-white dark:bg-[#1e1e1e] border-none rounded-xl text-base font-semibold text-[#222222] dark:text-white shadow-sm focus:ring-2 focus:ring-[#222222] transition-all"
                            />
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={handleAddTest}
                            className="flex-1 min-w-[100px] px-4 py-2.5 bg-[#8AC43C] hover:bg-[#7ab332] text-white dark:text-[#222222] text-xs font-bold rounded-full transition-colors"
                        >
                            Schedule Test
                        </button>
                        <button
                            onClick={() => setIsAddingTest(false)}
                            className="flex-1 min-w-[100px] px-4 py-2.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-[#222222] dark:text-white text-xs font-bold rounded-full transition-colors"
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* Overdue Alert */}
            {overdueTests.length > 0 && (
                <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                    <p className="text-sm font-medium text-red-700 dark:text-red-400">
                        ⚠️ {overdueTests.length} overdue test{overdueTests.length > 1 ? 's' : ''}
                    </p>
                </div>
            )}

            {/* Tests List */}
            <div className="space-y-3 max-h-96 overflow-y-auto">
                {allTests.length > 0 ? (
                    allTests.map((test) => {
                        const daysUntil = getDaysUntil(test.scheduledDate);
                        const isOverdue = daysUntil < 0;

                        return (
                            <div
                                key={test.id}
                                className={`p-5 rounded-2xl border-none transition-all ${isOverdue
                                    ? 'bg-red-50 dark:bg-red-900/10'
                                    : 'bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800'
                                    }`}
                            >
                                <div className="flex items-start gap-3">
                                    <input
                                        type="checkbox"
                                        checked={test.completed}
                                        onChange={() => handleToggleComplete(test.id, test.completed)}
                                        className="mt-1 w-5 h-5 text-secondary-700 rounded focus:ring-2 focus:ring-secondary-700"
                                    />
                                    <div className="flex-1">
                                        <h4 className={`font-semibold text-gray-900 dark:text-gray-100 ${test.completed ? 'line-through opacity-50' : ''}`}>
                                            {test.testName}
                                        </h4>
                                        <div className="flex items-center gap-4 mt-1 text-sm">
                                            <span className={`font-medium ${getDateColor(daysUntil)}`}>
                                                📅 {new Date(test.scheduledDate).toLocaleDateString()}
                                                {isOverdue && ' (Overdue)'}
                                                {!isOverdue && daysUntil === 0 && ' (Today)'}
                                                {!isOverdue && daysUntil > 0 && ` (in ${daysUntil} days)`}
                                            </span>
                                            {test.location && (
                                                <span className="text-gray-600 dark:text-gray-400">
                                                    📍 {test.location}
                                                </span>
                                            )}
                                        </div>
                                        {test.doctorName && (
                                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                                Dr. {test.doctorName}
                                            </p>
                                        )}
                                        {test.notes && (
                                            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 italic">
                                                {test.notes}
                                            </p>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => handleDeleteTest(test.id)}
                                        className="text-red-500 hover:text-red-700 text-sm font-medium"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        );
                    })
                ) : (
                    <p className="text-center text-gray-500 dark:text-gray-400 py-8 italic">
                        No upcoming tests scheduled
                    </p>
                )}
            </div>
        </div>
    );
};

export default UpcomingTestsCard;
