import os
import json
import pandas as pd
import numpy as np

class CustomJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, np.float32) or isinstance(obj, np.float64):
            return float(obj)
        if isinstance(obj, np.int32) or isinstance(obj, np.int64):
            return int(obj)
        return super().default(obj)

def load_annotations(path):
    if not os.path.exists(path):
        return {}
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)

def save_annotations(path: str, data: dict):
    """Save annotations to both JSON and CSV formats."""
    # Save to JSON
    json_path = path.replace('.csv', '.json')
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2, cls=CustomJSONEncoder)
    
    # Save to CSV
    save_annotations_to_csv(path, data)

def load_annotations_from_csv(csv_file, image_folder):
    if not os.path.exists(csv_file):
        return {}, [], []
        
    df = pd.read_csv(csv_file, encoding='utf-8-sig')

    if 'image_filename' not in df.columns:
        raise ValueError("CSV must contain 'image_filename' column.")
    
    annotations = {}
    valid_images = []
    missing_images = []

    for _, row in df.iterrows():
        filename = row['image_filename']
        image_path = os.path.join(image_folder, filename)
        if os.path.exists(image_path):
            annotations[filename] = {
                'extracted_text': str(row.get('extracted_text', '')),
                'validated_text': str(row.get('validated_text', row.get('extracted_text', '')))
            }
            valid_images.append(filename)
        else:
            missing_images.append(filename)

    return annotations, valid_images, missing_images

def save_annotations_to_csv(csv_file, annotations):
    data = [
        {
            'image_filename': filename,
            'extracted_text': str(ann.get('extracted_text', '')),
            'validated_text': str(ann.get('validated_text', ''))
        }
        for filename, ann in annotations.items()
    ]
    df = pd.DataFrame(data)
    df.to_csv(csv_file, index=False, encoding='utf-8-sig')
