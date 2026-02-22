-- Create patient_meals table
CREATE TABLE IF NOT EXISTS public.patient_meals (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    patient_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
    meal_type TEXT CHECK (meal_type IN ('breakfast', 'lunch', 'snack', 'dinner')) NOT NULL,
    food_name TEXT NOT NULL,
    calories INTEGER DEFAULT 0,
    protein_g DECIMAL(10,2) DEFAULT 0,
    fat_g DECIMAL(10,2) DEFAULT 0,
    carb_g DECIMAL(10,2) DEFAULT 0,
    quantity DECIMAL(10,2) DEFAULT 1,
    measure TEXT DEFAULT 'serving',
    sodium_mg DECIMAL(10,2) DEFAULT 0,
    potassium_mg DECIMAL(10,2) DEFAULT 0,
    phosphorus_mg DECIMAL(10,2) DEFAULT 0,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE public.patient_meals ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Patients can view their own meals" 
ON public.patient_meals FOR SELECT 
USING (auth.uid() = patient_id);

CREATE POLICY "Patients can insert their own meals" 
ON public.patient_meals FOR INSERT 
WITH CHECK (auth.uid() = patient_id);

CREATE POLICY "Patients can delete their own meals" 
ON public.patient_meals FOR DELETE 
USING (auth.uid() = patient_id);

-- Indexes for performance
CREATE INDEX idx_patient_meals_patient_id ON public.patient_meals(patient_id);
CREATE INDEX idx_patient_meals_recorded_at ON public.patient_meals(recorded_at);
