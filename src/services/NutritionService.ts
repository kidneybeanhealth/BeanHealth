import { supabase } from '../lib/supabase';
import { PatientMeal } from '../types';

export class NutritionService {
    /**
     * Add a guest meal entry
     */
    static async addMeal(
        patientId: string,
        mealType: 'breakfast' | 'lunch' | 'snack' | 'dinner',
        foodName: string,
        nutrients: {
            calories?: number;
            proteinG?: number;
            fatG?: number;
            carbG?: number;
            sodiumMg?: number;
            potassiumMg?: number;
            phosphorusMg?: number;
        },
        quantity: number = 1,
        measure: string = 'serving'
    ): Promise<PatientMeal> {
        const { data, error } = await (supabase.from('patient_meals') as any)
            .insert({
                patient_id: patientId,
                meal_type: mealType,
                food_name: foodName,
                calories: nutrients.calories || 0,
                protein_g: nutrients.proteinG || 0,
                fat_g: nutrients.fatG || 0,
                carb_g: nutrients.carbG || 0,
                sodium_mg: nutrients.sodiumMg || 0,
                potassium_mg: nutrients.potassiumMg || 0,
                phosphorus_mg: nutrients.phosphorusMg || 0,
                quantity: quantity,
                measure: measure,
                recorded_at: new Date().toISOString()
            })
            .select()
            .single();

        if (error) {
            console.error('Error adding meal:', error);
            throw new Error(`Failed to add meal: ${error.message}`);
        }

        return this.mapToPatientMeal(data);
    }

    /**
     * Get today's meals for a patient
     */
    static async getTodayMeals(patientId: string): Promise<PatientMeal[]> {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const { data, error } = await (supabase.from('patient_meals') as any)
            .select('*')
            .eq('patient_id', patientId)
            .gte('recorded_at', today.toISOString())
            .order('recorded_at', { ascending: false });

        if (error) {
            console.error('Error fetching today\'s meals:', error);
            throw new Error(`Failed to fetch today's meals: ${error.message}`);
        }

        return data?.map(this.mapToPatientMeal) || [];
    }

    /**
     * Get meal history for specified number of days
     */
    static async getMealHistory(patientId: string, days: number = 30): Promise<PatientMeal[]> {
        const startDate = new Date();
        startDate.setDate(startDate.getDate() - days);
        startDate.setHours(0, 0, 0, 0);

        const { data, error } = await (supabase.from('patient_meals') as any)
            .select('*')
            .eq('patient_id', patientId)
            .gte('recorded_at', startDate.toISOString())
            .order('recorded_at', { ascending: false });

        if (error) {
            console.error('Error fetching meal history:', error);
            throw new Error(`Failed to fetch meal history: ${error.message}`);
        }

        return data?.map(this.mapToPatientMeal) || [];
    }

    /**
     * Delete a meal entry
     */
    static async deleteMeal(id: string): Promise<void> {
        const { error } = await (supabase.from('patient_meals') as any)
            .delete()
            .eq('id', id);

        if (error) {
            console.error('Error deleting meal:', error);
            throw new Error(`Failed to delete meal: ${error.message}`);
        }
    }

    /**
     * Get recommended recipes (Sample data inspired by INDB)
     */
    static getRecommendedRecipes() {
        return [
            {
                id: 'R1',
                name: 'Moong Dal Khichdi (Low Sodium)',
                type: 'Lunch/Dinner',
                nutrients: { calories: 250, protein: '8g', fat: '2g', carb: '45g', potassium: '150mg', phosphorus: '120mg', sodium: '80mg' },
                highlight: 'Excellent for kidney health, easy to digest.'
            },
            {
                id: 'R2',
                name: 'Poha with Low-K Veggies',
                type: 'Breakfast',
                nutrients: { calories: 180, protein: '4g', fat: '5g', carb: '32g', potassium: '90mg', phosphorus: '60mg', sodium: '40mg' },
                highlight: 'Light and nutrient balanced.'
            },
            {
                id: 'R3',
                name: 'Masala Oats (CKD Friendly)',
                type: 'Breakfast',
                nutrients: { calories: 210, protein: '6g', fat: '4g', carb: '28g', potassium: '110mg', phosphorus: '95mg', sodium: '65mg' },
                highlight: 'High fiber, low phosphorus.'
            }
        ];
    }

    /**
     * Map database record to PatientMeal interface
     */
    private static mapToPatientMeal(data: any): PatientMeal {
        return {
            id: data.id,
            patientId: data.patient_id,
            patient_id: data.patient_id,
            mealType: data.meal_type,
            meal_type: data.meal_type,
            foodName: data.food_name,
            food_name: data.food_name,
            calories: data.calories,
            proteinG: data.protein_g,
            protein_g: data.protein_g,
            fatG: data.fat_g,
            fat_g: data.fat_g,
            carbG: data.carb_g,
            carb_g: data.carb_g,
            quantity: data.quantity || 1,
            measure: data.measure || 'serving',
            sodiumMg: data.sodium_mg,
            sodium_mg: data.sodium_mg,
            potassiumMg: data.potassium_mg,
            potassium_mg: data.potassium_mg,
            phosphorusMg: data.phosphorus_mg,
            phosphorus_mg: data.phosphorus_mg,
            recordedAt: data.recorded_at,
            recorded_at: data.recorded_at,
            createdAt: data.created_at,
            created_at: data.created_at
        };
    }
}
