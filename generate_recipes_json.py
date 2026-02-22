import pandas as pd
import json
import os

def generate_recipe_json():
    file_path = '/Users/harish/Desktop/BeanHealth-main/Indian-Nutrient-Databank-INDB--main/INDB.xlsx'
    output_path = '/Users/harish/Desktop/BeanHealth-main/src/data/recipes.json'
    
    try:
        df = pd.read_excel(file_path, sheet_name='Nutrient Data')
        
        relevant_cols = {
            'food_name': 'name',
            'energy_kcal': 'calories',
            'protein_g': 'proteinG',
            'fat_g': 'fatG',
            'carb_g': 'carbG',
            'sodium_mg': 'sodiumMg',
            'potassium_mg': 'potassiumMg',
            'phosphorus_mg': 'phosphorusMg'
        }
        
        # Filter and rename
        recipes_df = df[list(relevant_cols.keys())].rename(columns=relevant_cols)
        
        # Fill NaNs with 0
        recipes_df = recipes_df.fillna(0)
        
        # Round values to 1 decimal place
        num_cols = ['calories', 'proteinG', 'fatG', 'carbG', 'sodiumMg', 'potassiumMg', 'phosphorusMg']
        recipes_df[num_cols] = recipes_df[num_cols].round(1)
        
        # Convert to list of dicts
        recipes_list = recipes_df.to_dict(orient='records')
        
        with open(output_path, 'w') as f:
            json.dump(recipes_list, f, indent=2)
            
        print(f"Successfully generated {len(recipes_list)} recipes at {output_path}")

    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    generate_recipe_json()
