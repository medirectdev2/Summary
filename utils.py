from fuzzywuzzy import process

def classify_filename(filename, categories):
    # Convert filename to a more comparable form
    lower_filename = filename.lower().replace("_", " ").replace("-", " ")
    
    # Get the best match for the filename from the categories
    best_match, score = process.extractOne(lower_filename, categories)

    return best_match if score > 50 else "Uncategorized"  # Threshold can be adjusted
