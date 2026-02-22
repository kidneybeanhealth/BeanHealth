import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { NutritionService } from '../services/NutritionService';
import { PatientMeal } from '../types';
import { PlusCircleIcon } from './icons/PlusCircleIcon';
import { TrashIcon } from './icons/TrashIcon';
import { SparklesIcon } from './icons/SparklesIcon';
import { SearchIcon } from './icons/SearchIcon';
import { ArrowLeftIcon } from './icons/ArrowLeftIcon';
import { ProteinIcon, FatIcon, CarbIcon, RecipeIcon, SodiumIcon, PhosphorusIcon } from './icons/NutrientIcons';
import { useAuth } from '../contexts/AuthContext';
import recipesData from '../data/recipes.json';

interface Recipe {
    name: string;
    calories: number;
    proteinG: number;
    fatG: number;
    carbG: number;
    sodiumMg: number;
    potassiumMg: number;
    phosphorusMg: number;
}

const NutritionDashboard: React.FC = () => {
    const { user } = useAuth();
    const [meals, setMeals] = useState<PatientMeal[]>([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [modalStep, setModalStep] = useState<'search' | 'detail'>('search');
    const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
    const [recommendedRecipes] = useState(NutritionService.getRecommendedRecipes());

    // Search state
    const [searchQuery, setSearchQuery] = useState('');
    const [quantity, setQuantity] = useState<number | string>(1);
    const [measure, setMeasure] = useState('regular');
    const [mealType, setMealType] = useState<'breakfast' | 'lunch' | 'snack' | 'dinner'>('lunch');

    const getWeightMultiplier = (measureId: string) => {
        const weights: Record<string, number> = {
            'regular': 50,
            'small': 25,
            'piece': 50,
            'serve_solid': 150,
            'tablespoon': 15,
            'katori': 150,
            'teaspoon': 5,
            'cup': 240,
            'serve_liquid': 200,
            'grams': 1,
            'oz': 28.4
        };
        return weights[measureId] || 100;
    };

    const parsedQuantity = typeof quantity === 'number' ? quantity : parseFloat(quantity) || 0;
    const netWeightGrams = parsedQuantity * getWeightMultiplier(measure);
    const nutrientMultiplier = netWeightGrams / 100;

    const fetchMeals = useCallback(async () => {
        if (!user?.id) return;
        setLoading(true);
        try {
            const data = await NutritionService.getTodayMeals(user.id);
            setMeals(data);
        } catch (error) {
            console.error('Error fetching meals:', error);
        } finally {
            setLoading(false);
        }
    }, [user?.id]);

    useEffect(() => {
        fetchMeals();
    }, [fetchMeals]);

    const suggestions = useMemo(() => {
        if (searchQuery.length > 0) {
            return (recipesData as Recipe[]).filter(r =>
                r.name.toLowerCase().includes(searchQuery.toLowerCase())
            ).slice(0, 10);
        }
        return (recipesData as Recipe[]).slice(10, 20); // Popular/Recent items
    }, [searchQuery]);

    const handleSelectRecipe = (recipe: Recipe) => {
        setSelectedRecipe(recipe);
        setModalStep('detail');
    };

    const handleAddMeal = async () => {
        if (!user?.id || !selectedRecipe) return;

        try {
            await NutritionService.addMeal(user.id, mealType, selectedRecipe.name, {
                calories: Math.round(selectedRecipe.calories * nutrientMultiplier),
                proteinG: Number((selectedRecipe.proteinG * nutrientMultiplier).toFixed(2)),
                fatG: Number((selectedRecipe.fatG * nutrientMultiplier).toFixed(2)),
                carbG: Number((selectedRecipe.carbG * nutrientMultiplier).toFixed(2)),
                sodiumMg: Number((selectedRecipe.sodiumMg * nutrientMultiplier).toFixed(2)),
                potassiumMg: Number((selectedRecipe.potassiumMg * nutrientMultiplier).toFixed(2)),
                phosphorusMg: Number((selectedRecipe.phosphorusMg * nutrientMultiplier).toFixed(2))
            }, parsedQuantity, measure);

            closeModal();
            fetchMeals();
        } catch (error) {
            console.error('Error adding meal:', error);
            alert('Failed to add meal');
        }
    };

    const closeModal = () => {
        setShowAddModal(false);
        setModalStep('search');
        setSelectedRecipe(null);
        setSearchQuery('');
        setQuantity(1);
    };

    const handleDeleteMeal = async (id: string) => {
        if (!window.confirm('Are you sure you want to delete this meal entry?')) return;
        try {
            await NutritionService.deleteMeal(id);
            fetchMeals();
        } catch (error) {
            console.error('Error deleting meal:', error);
        }
    };

    // Calculate daily totals
    const totals = meals.reduce((acc, meal) => ({
        calories: acc.calories + (meal.calories || 0),
        protein: acc.protein + (meal.proteinG || 0),
        fat: acc.fat + (meal.fatG || 0),
        carb: acc.carb + (meal.carbG || 0),
        sodium: acc.sodium + (meal.sodiumMg || 0),
        potassium: acc.potassium + (meal.potassiumMg || 0),
        phosphorus: acc.phosphorus + (meal.phosphorusMg || 0)
    }), { calories: 0, protein: 0, fat: 0, carb: 0, sodium: 0, potassium: 0, phosphorus: 0 });

    return (
        <div className="p-4 sm:p-6 md:p-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 bg-[#f8f9fa] min-h-screen">
            {/* Header Section */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                        Nutrition <span className="text-[#8AC43C]">Dashboard</span>
                    </h1>
                    <p className="text-gray-500 mt-1 text-sm md:text-base">Track your meals and manage your kidney-friendly diet.</p>
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="flex items-center justify-center gap-2 bg-[#8AC43C] hover:bg-[#7ab335] text-white px-5 py-2.5 rounded-full font-bold transition-transform hover:scale-105 active:scale-95 shadow-md"
                >
                    <PlusCircleIcon className="w-5 h-5" />
                    <span>Track a Meal</span>
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
                {/* Left Column: Recipe Report & Totals */}
                <div className="lg:col-span-2 space-y-6 md:space-y-8">
                    {/* Today's Recipe Report - HIGHLIGHTED FLAT DESIGN */}
                    <div className="relative overflow-hidden rounded-3xl md:rounded-[2.5rem] bg-[#8AC43C] p-6 md:p-8 text-white shadow-sm">
                        <div className="absolute top-4 right-4 md:top-8 md:right-8 opacity-40">
                            <SparklesIcon className="w-24 h-24 md:w-32 md:h-32 text-[#a3d463]" />
                        </div>

                        <div className="relative z-10 w-full md:max-w-xl">
                            <div className="flex items-center gap-2 text-[#e3f4ce] font-bold tracking-widest uppercase text-[10px] md:text-xs mb-3 md:mb-4">
                                <SparklesIcon className="w-3 h-3 md:w-4 md:h-4" />
                                Today's Recommended Recipe
                            </div>

                            <h2 className="text-2xl md:text-3xl font-black mb-2 text-[#2c4013]">{recommendedRecipes[0].name}</h2>
                            <p className="text-[#e3f4ce] text-sm md:text-base mb-6 md:mb-8">{recommendedRecipes[0].highlight}</p>

                            <div className="flex flex-wrap gap-2 md:gap-4">
                                {Object.entries(recommendedRecipes[0].nutrients).filter(([key]) => ['calories', 'protein', 'potassium', 'phosphorus', 'sodium'].includes(key)).map(([key, val]) => (
                                    <div key={key} className="bg-[#9cd05b] rounded-xl md:rounded-2xl p-3 md:p-4 border border-[#a8d76b] flex-1 min-w-[100px]">
                                        <p className="text-[#e3f4ce] text-[9px] md:text-[10px] uppercase font-bold tracking-wider mb-0.5">{key}</p>
                                        <p className="text-base md:text-lg font-black text-white">{val}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Daily Progress - Flat White Cards */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
                        <div className="bg-white rounded-2xl md:rounded-3xl p-5 md:p-6 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)]">
                            <p className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Calories</p>
                            <p className="text-xl md:text-2xl font-black text-gray-900">{Math.round(totals.calories)} <span className="text-[10px] font-normal text-gray-400">kcal</span></p>
                        </div>
                        <div className="bg-white rounded-2xl md:rounded-3xl p-5 md:p-6 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)]">
                            <p className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Sodium</p>
                            <p className={`text-xl md:text-2xl font-black ${totals.sodium > 2000 ? 'text-red-500' : 'text-gray-900'}`}>{Math.round(totals.sodium)} <span className="text-[10px] font-normal text-gray-400">mg</span></p>
                        </div>
                        <div className="bg-white rounded-2xl md:rounded-3xl p-5 md:p-6 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)]">
                            <p className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Potassium</p>
                            <p className={`text-xl md:text-2xl font-black ${totals.potassium > 2000 ? 'text-red-500' : 'text-gray-900'}`}>{Math.round(totals.potassium)} <span className="text-[10px] font-normal text-gray-400">mg</span></p>
                        </div>
                        <div className="bg-white rounded-2xl md:rounded-3xl p-5 md:p-6 shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)]">
                            <p className="text-[10px] md:text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Phosphorus</p>
                            <p className={`text-xl md:text-2xl font-black ${totals.phosphorus > 800 ? 'text-red-500' : 'text-gray-900'}`}>{Math.round(totals.phosphorus)} <span className="text-[10px] font-normal text-gray-400">mg</span></p>
                        </div>
                    </div>

                    {/* Past Food Tracked */}
                    <div className="bg-white rounded-[2rem] shadow-[0_2px_10px_-3px_rgba(6,81,237,0.1)] overflow-hidden">
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                            <h3 className="font-bold text-lg text-gray-900">Today's Log</h3>
                            <span className="text-[10px] md:text-xs font-bold px-3 py-1 bg-[#f4f5f7] rounded-full text-gray-500 uppercase tracking-wider">
                                {new Date().toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
                            </span>
                        </div>

                        <div className="divide-y divide-gray-50 dark:divide-white/5">
                            {loading ? (
                                <div className="p-12 text-center text-gray-400 italic">Loading your meals...</div>
                            ) : meals.length === 0 ? (
                                <div className="p-12 text-center">
                                    <div className="w-16 h-16 bg-gray-50 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <SparklesIcon className="w-8 h-8 text-gray-300" />
                                    </div>
                                    <p className="text-gray-500 font-medium">No meals tracked today yet.</p>
                                    <p className="text-sm text-gray-400 mt-1">Start by adding your breakfast or lunch!</p>
                                </div>
                            ) : (
                                meals.map((meal) => (
                                    <div key={meal.id} className="p-6 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-white/5 transition-colors group">
                                        <div className="flex items-start gap-4">
                                            <div className={`mt-1 h-3 w-3 rounded-full flex-shrink-0 ${meal.mealType === 'breakfast' ? 'bg-orange-400' :
                                                meal.mealType === 'lunch' ? 'bg-[#8AC43C]' :
                                                    meal.mealType === 'dinner' ? 'bg-indigo-400' : 'bg-pink-400'
                                                }`} />
                                            <div>
                                                <h4 className="font-bold text-gray-900 dark:text-white">{meal.foodName}</h4>
                                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
                                                    <span className="text-xs font-bold text-gray-400 uppercase">{meal.mealType}</span>
                                                    <span className="text-[10px] text-gray-300">•</span>
                                                    <span className="text-xs text-gray-500">{meal.quantity} {meal.measure}</span>
                                                    <span className="text-[10px] text-gray-300">•</span>
                                                    <span className="text-xs text-gray-500">{Math.round(meal.calories)} kcal</span>
                                                    <span className="text-[10px] text-gray-300">•</span>
                                                    <span className="text-xs text-gray-500 font-medium text-[#8AC43C]">{Math.round(meal.potassiumMg)}mg K</span>
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleDeleteMeal(meal.id)}
                                            className="p-2.5 rounded-full text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 opacity-0 group-hover:opacity-100 transition-all"
                                        >
                                            <TrashIcon className="w-5 h-5" />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column: Other Recommendations & Stats */}
                <div className="space-y-6 md:space-y-8">
                    <div className="bg-black rounded-3xl md:rounded-[2rem] p-6 md:p-8 text-white shadow-xl">
                        <h3 className="text-lg md:text-xl font-bold mb-6 text-white/90">Explore Recipes</h3>
                        <div className="space-y-6">
                            {recommendedRecipes.slice(1).map((recipe, index) => (
                                <div key={recipe.id} className="group cursor-pointer">
                                    <p className="text-[#8AC43C] text-[9px] md:text-[10px] font-bold uppercase tracking-widest mb-1.5">{recipe.type}</p>
                                    <h4 className="text-base md:text-lg font-bold text-white/90 group-hover:text-white transition-colors">{recipe.name}</h4>
                                    <p className="text-white/50 text-xs md:text-sm mt-1">{recipe.highlight}</p>
                                    {index < recommendedRecipes.slice(1).length - 1 && (
                                        <div className="w-full h-px bg-white/10 mt-6" />
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="bg-[#f2f6ea] rounded-3xl md:rounded-[2rem] p-6 md:p-8 shadow-sm">
                        <h3 className="text-base md:text-lg font-bold text-[#354026] mb-3">Meal Tip</h3>
                        <p className="text-[#5b6b45] text-xs md:text-sm leading-relaxed">
                            Adding a squeeze of lemon to your meals can help enhance flavor without needing extra salt, keeping your sodium levels in check!
                        </p>
                    </div>
                </div>
            </div>

            {/* Redesigned Track Meal Modal is unaffected by background theme */}
            {showAddModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-[#F8F9FB] dark:bg-[#1C1C1E] w-full max-w-lg h-[80vh] flex flex-col rounded-[3rem] shadow-2xl overflow-hidden border border-gray-100 dark:border-white/5 animate-in zoom-in-95 duration-300">
                        {modalStep === 'search' ? (
                            <>
                                <div className="p-8 pb-4 flex items-center justify-between">
                                    <button onClick={closeModal} className="p-2 -ml-2 rounded-full hover:bg-gray-200 dark:hover:bg-white/5 transition-colors">
                                        <ArrowLeftIcon className="w-5 h-5" />
                                    </button>
                                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">Track Meal</h3>
                                    <div className="w-9" /> {/* Spacer */}
                                </div>

                                <div className="px-8 pb-6">
                                    <div className="relative">
                                        <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                                        <input
                                            autoFocus
                                            type="text"
                                            placeholder="Search by Food Name"
                                            className="w-full bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl pl-12 pr-4 py-4 text-gray-900 dark:text-white focus:ring-2 focus:ring-[#8AC43C] transition-all"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto px-8 pb-8 space-y-6">
                                    <div>
                                        <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
                                            {searchQuery.length > 0 ? 'Search Results' : 'Did you also have...'}
                                        </h4>
                                        <div className="space-y-4">
                                            {suggestions.map((s, i) => (
                                                <div
                                                    key={i}
                                                    className="bg-white dark:bg-white/5 p-4 rounded-2xl flex items-center justify-between group hover:border-[#8AC43C] border border-transparent transition-all cursor-pointer"
                                                    onClick={() => handleSelectRecipe(s)}
                                                >
                                                    <div>
                                                        <p className="font-bold text-gray-900 dark:text-white">{s.name}</p>
                                                        <p className="text-xs text-gray-400 mt-1">1.0 serving</p>
                                                    </div>
                                                    <div className="flex items-center gap-4">
                                                        <p className="text-sm font-bold text-gray-500">{Math.round(s.calories)} Cal</p>
                                                        <button
                                                            className="h-8 w-8 rounded-full bg-gray-50 dark:bg-white/10 flex items-center justify-center text-[#8AC43C] group-hover:bg-[#8AC43C] group-hover:text-white transition-all"
                                                            onClick={(e) => { e.stopPropagation(); handleSelectRecipe(s); }}
                                                        >
                                                            <PlusCircleIcon className="w-5 h-5" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="p-8 pb-4 flex items-center justify-between">
                                    <button onClick={() => setModalStep('search')} className="p-2 -ml-2 rounded-full hover:bg-gray-200 dark:hover:bg-white/5 transition-colors">
                                        <ArrowLeftIcon className="w-5 h-5" />
                                    </button>
                                    <div className="flex items-center gap-3">
                                        <button className="p-2 rounded-xl bg-white dark:bg-white/5 shadow-sm">
                                            <SparklesIcon className="w-5 h-5 text-[#8AC43C]" />
                                        </button>
                                        <button className="p-2 rounded-xl bg-white dark:bg-white/5 shadow-sm">
                                            <RecipeIcon className="w-5 h-5 text-gray-400" />
                                        </button>
                                    </div>
                                </div>

                                <div className="flex-1 overflow-y-auto px-8 pb-8 space-y-8">
                                    {/* Food Card */}
                                    <div className="relative h-64 rounded-[2.5rem] overflow-hidden bg-gray-200 dark:bg-gray-800 shadow-xl group">
                                        {/* Background gradient placeholder */}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex items-end p-8">
                                            <div>
                                                <h3 className="text-3xl font-black text-white">{selectedRecipe?.name}</h3>
                                            </div>
                                        </div>
                                        <div className="absolute top-6 right-6">
                                            <button className="bg-black/50 backdrop-blur-md text-white px-4 py-2 rounded-full text-xs font-bold flex items-center gap-2 border border-white/20">
                                                <RecipeIcon className="w-3.5 h-3.5" />
                                                Recipe
                                            </button>
                                        </div>
                                    </div>

                                    {/* Selection Controls */}
                                    <div className="flex gap-4">
                                        <div className="flex-1">
                                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Quantity</label>
                                            <input
                                                type="number"
                                                min="0"
                                                step="any"
                                                className="w-full bg-white dark:bg-white/5 border-none rounded-2xl px-4 py-3.5 text-gray-900 dark:text-white font-bold focus:ring-[#8AC43C]"
                                                value={quantity}
                                                onChange={(e) => setQuantity(e.target.value)}
                                            />
                                        </div>
                                        <div className="flex-[2]">
                                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Measure</label>
                                            <select
                                                className="w-full bg-white dark:bg-white/5 border-none rounded-2xl px-4 py-3.5 text-gray-900 dark:text-white font-bold focus:ring-[#8AC43C]"
                                                value={measure}
                                                onChange={(e) => setMeasure(e.target.value)}
                                            >
                                                <optgroup label="Solid Foods">
                                                    <option value="regular">regular (50g)</option>
                                                    <option value="small">small (25g)</option>
                                                    <option value="piece">piece (50g)</option>
                                                    <option value="serve_solid">serve (150g)</option>
                                                </optgroup>
                                                <optgroup label="Chutney / Gravy / Liquid">
                                                    <option value="tablespoon">table spoon (15g)</option>
                                                    <option value="katori">katori (150g)</option>
                                                    <option value="teaspoon">teaspoon (5g)</option>
                                                    <option value="cup">cup (240g)</option>
                                                    <option value="serve_liquid">serve (200g)</option>
                                                </optgroup>
                                                <optgroup label="Standard Weight">
                                                    <option value="grams">grams</option>
                                                    <option value="oz">oz (28.4g)</option>
                                                </optgroup>
                                            </select>
                                        </div>
                                    </div>

                                    {/* Macronutrients Breakdown */}
                                    <div className="space-y-6">
                                        <h4 className="text-base font-bold text-gray-900 dark:text-white">Macronutrients Breakdown</h4>
                                        <div className="bg-white dark:bg-white/5 rounded-[2rem] p-8 border border-gray-100 dark:border-white/5 shadow-sm">
                                            <div className="flex items-center justify-between mb-8">
                                                <div>
                                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Calories</p>
                                                    <p className="text-3xl font-black text-gray-900 dark:text-white">
                                                        {selectedRecipe ? Math.round(selectedRecipe.calories * nutrientMultiplier) : 0} <span className="text-lg font-bold text-gray-400">Cal</span>
                                                    </p>
                                                </div>
                                                <div className="bg-gray-100 dark:bg-white/5 px-4 py-2 rounded-xl">
                                                    <p className="text-[10px] font-bold text-gray-500 uppercase">Net wt: {Math.round(netWeightGrams)}g</p>
                                                </div>
                                            </div>

                                            <div className="space-y-4">
                                                {/* Sodium/Salt */}
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 rounded-xl bg-red-100 dark:bg-red-500/10 text-red-500">
                                                            <SodiumIcon className="w-5 h-5" />
                                                        </div>
                                                        <p className="font-bold text-gray-600 dark:text-gray-300">Sodium (Salt)</p>
                                                    </div>
                                                    <p className="font-black text-gray-900 dark:text-white">{selectedRecipe ? Math.round(selectedRecipe.sodiumMg * nutrientMultiplier) : 0} mg</p>
                                                </div>

                                                {/* Potassium */}
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 rounded-xl bg-[#8AC43C]/20 text-[#8AC43C]">
                                                            <ProteinIcon className="w-5 h-5" />
                                                        </div>
                                                        <p className="font-bold text-gray-600 dark:text-gray-300">Potassium</p>
                                                    </div>
                                                    <p className="font-black text-gray-900 dark:text-white">{selectedRecipe ? Math.round(selectedRecipe.potassiumMg * nutrientMultiplier) : 0} mg</p>
                                                </div>

                                                {/* Phosphorus */}
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 rounded-xl bg-yellow-100 dark:bg-yellow-500/10 text-yellow-600">
                                                            <PhosphorusIcon className="w-5 h-5" />
                                                        </div>
                                                        <p className="font-bold text-gray-600 dark:text-gray-300">Phosphorus</p>
                                                    </div>
                                                    <p className="font-black text-gray-900 dark:text-white">{selectedRecipe ? Math.round(selectedRecipe.phosphorusMg * nutrientMultiplier) : 0} mg</p>
                                                </div>

                                                <div className="w-full h-px bg-gray-100 dark:bg-white/10 my-2"></div>

                                                {/* Macros */}
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 rounded-xl bg-orange-100 dark:bg-orange-500/10 text-orange-500">
                                                            <ProteinIcon className="w-5 h-5" />
                                                        </div>
                                                        <p className="font-bold text-gray-600 dark:text-gray-300">Proteins</p>
                                                    </div>
                                                    <p className="font-black text-gray-900 dark:text-white">{selectedRecipe ? (selectedRecipe.proteinG * nutrientMultiplier).toFixed(1) : 0} g</p>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 rounded-xl bg-purple-100 dark:bg-purple-500/10 text-purple-500">
                                                            <CarbIcon className="w-5 h-5" />
                                                        </div>
                                                        <p className="font-bold text-gray-600 dark:text-gray-300">Carbs</p>
                                                    </div>
                                                    <p className="font-black text-gray-900 dark:text-white">{selectedRecipe ? (selectedRecipe.carbG * nutrientMultiplier).toFixed(1) : 0} g</p>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 rounded-xl bg-blue-100 dark:bg-blue-500/10 text-blue-500">
                                                            <FatIcon className="w-5 h-5" />
                                                        </div>
                                                        <p className="font-bold text-gray-600 dark:text-gray-300">Fats</p>
                                                    </div>
                                                    <p className="font-black text-gray-900 dark:text-white">{selectedRecipe ? (selectedRecipe.fatG * nutrientMultiplier).toFixed(1) : 0} g</p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Meal Type Selector */}
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                        {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map((type) => (
                                            <button
                                                key={type}
                                                onClick={() => setMealType(type)}
                                                className={`py-2.5 rounded-2xl text-[10px] font-bold uppercase tracking-wider border transition-all ${mealType === type
                                                    ? 'bg-[#8AC43C] border-[#8AC43C] text-white shadow-lg shadow-[#8AC43C]/20'
                                                    : 'bg-white dark:bg-white/5 border-gray-100 dark:border-white/10 text-gray-500 hover:border-gray-200'
                                                    }`}
                                            >
                                                {type}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="p-8 border-t border-gray-100 dark:border-white/5 bg-white dark:bg-white/[0.01]">
                                    <button
                                        onClick={handleAddMeal}
                                        className="w-full py-5 rounded-[2rem] font-black text-white text-lg bg-[#005445] hover:bg-[#004a3e] transition-all shadow-xl shadow-[#005445]/20 active:scale-[0.98]"
                                    >
                                        Add to {mealType.charAt(0).toUpperCase() + mealType.slice(1)}
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default NutritionDashboard;
