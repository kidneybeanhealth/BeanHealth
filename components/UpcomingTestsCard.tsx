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
        return 'text-slate-600 dark:text-slate-400';
    };

    const allTests = [...overdueTests, ...upcomingTests];

    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200/40 dark:border-slate-700/40 hover:shadow-lg transition-all duration-300">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Upcoming Tests</h3>
                <button
                    onClick={() => setIsAddingTest(true)}
                    className="px-4 py-2 text-sm font-medium text-white bg-cyan-500 rounded-xl hover:bg-cyan-600 transition-colors"
                >
                    + Schedule Test
                </button>
            </div>

            {/* Add Test Modal */}
            {isAddingTest && (
                <div className="mb-6 p-4 bg-slate-50 dark:bg-slate-700 rounded-xl border border-slate-200 dark:border-slate-600">
                    <h4 className="font-semibold text-slate-900 dark:text-slate-100 mb-4">Schedule New Test</h4>
                    <div className="space-y-3 mb-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Test Name</label>
                            <select
                                value={newTest.testName}
                                onChange={(e) => setNewTest({ ...newTest, testName: e.target.value })}
                                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-slate-900 dark:text-slate-100"
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
                                    className="w-full mt-2 px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-slate-900 dark:text-slate-100"
                                />
                            )}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Date</label>
                                <input
                                    type="date"
                                    value={newTest.scheduledDate}
                                    onChange={(e) => setNewTest({ ...newTest, scheduledDate: e.target.value })}
                                    min={new Date().toISOString().split('T')[0]}
                                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-slate-900 dark:text-slate-100"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Location</label>
                                <input
                                    type="text"
                                    value={newTest.location}
                                    onChange={(e) => setNewTest({ ...newTest, location: e.target.value })}
                                    placeholder="Lab location"
                                    className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-slate-900 dark:text-slate-100"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Doctor (Optional)</label>
                            <input
                                type="text"
                                value={newTest.doctorName}
                                onChange={(e) => setNewTest({ ...newTest, doctorName: e.target.value })}
                                placeholder="Ordering physician"
                                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-slate-900 dark:text-slate-100"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Notes (Optional)</label>
                            <textarea
                                value={newTest.notes}
                                onChange={(e) => setNewTest({ ...newTest, notes: e.target.value })}
                                placeholder="Special instructions..."
                                rows={2}
                                className="w-full px-3 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-cyan-500 text-slate-900 dark:text-slate-100"
                            />
                        </div>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={handleAddTest}
                            className="flex-1 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white font-medium rounded-xl transition-colors"
                        >
                            Schedule Test
                        </button>
                        <button
                            onClick={() => setIsAddingTest(false)}
                            className="flex-1 px-4 py-2 bg-slate-200 dark:bg-slate-600 hover:bg-slate-300 dark:hover:bg-slate-500 text-slate-700 dark:text-slate-300 font-medium rounded-xl transition-colors"
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
                                className={`p-4 rounded-xl border transition-all ${isOverdue
                                        ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'
                                        : 'bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600'
                                    }`}
                            >
                                <div className="flex items-start gap-3">
                                    <input
                                        type="checkbox"
                                        checked={test.completed}
                                        onChange={() => handleToggleComplete(test.id, test.completed)}
                                        className="mt-1 w-5 h-5 text-cyan-500 rounded focus:ring-2 focus:ring-cyan-500"
                                    />
                                    <div className="flex-1">
                                        <h4 className={`font-semibold text-slate-900 dark:text-slate-100 ${test.completed ? 'line-through opacity-50' : ''}`}>
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
                                                <span className="text-slate-600 dark:text-slate-400">
                                                    📍 {test.location}
                                                </span>
                                            )}
                                        </div>
                                        {test.doctorName && (
                                            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                                Dr. {test.doctorName}
                                            </p>
                                        )}
                                        {test.notes && (
                                            <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 italic">
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
                    <p className="text-center text-slate-500 dark:text-slate-400 py-8 italic">
                        No upcoming tests scheduled
                    </p>
                )}
            </div>
        </div>
    );
};

export default UpcomingTestsCard;
