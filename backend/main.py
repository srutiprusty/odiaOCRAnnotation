from fastapi import FastAPI, UploadFile, Form, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
import os
from typing import List
from ocr_processor import batch_run_ocr
from utils import load_annotations_from_csv, save_annotations, save_annotations_to_csv
from fastapi import APIRouter
import shutil
import mimetypes
#from utils import save_annotations_to_csv

app = FastAPI()
router = APIRouter()

origins = [
    "http://localhost:5173",  # Vite dev server
    "http://127.0.0.1:5173",  # alternate localhost
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,          # or use ["*"] to allow all (not recommended in production)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

ANNOTATION_CSV_PATH = "annotations/annotations.csv"
IMAGE_FOLDER = "uploaded_images" 

def get_annotations():
    return load_annotations_from_csv(ANNOTATION_CSV_PATH, IMAGE_FOLDER)

# Allow frontend to talk to backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "uploaded_images"
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs("annotations", exist_ok=True)
os.makedirs("temp", exist_ok=True)
os.makedirs("saved", exist_ok=True)

# Create annotations.csv if it doesn't exist
if not os.path.exists(ANNOTATION_CSV_PATH):
    with open(ANNOTATION_CSV_PATH, 'w', encoding='utf-8-sig') as f:
        f.write('image_filename,extracted_text,validated_text\n')

# Mount the images directory
app.mount("/images", StaticFiles(directory=UPLOAD_DIR), name="images")

SUPPORTED_IMAGE_TYPES = {"jpg", "jpeg", "png", "bmp", "webp", "tiff"}

@app.post("/upload/")
async def upload_images(files: List[UploadFile]):
    image_names = []
    for file in files:
        # Check file extension
        ext = file.filename.split('.')[-1].lower()
        if ext not in SUPPORTED_IMAGE_TYPES:
            continue
            
        path = os.path.join(UPLOAD_DIR, file.filename)
        with open(path, "wb") as f:
            f.write(await file.read())
        image_names.append(file.filename)
    return {"status": "success", "images": image_names}

class OCRRequest(BaseModel):
    api_key: str
    image_filenames: List[str]

@app.post("/process-ocr/")
def process_ocr(request: OCRRequest):
    results = batch_run_ocr(request.image_filenames, IMAGE_FOLDER, request.api_key)
    return results

@app.get("/annotations/")
def get_annotations():
    try:
        annotations, valid_images, missing_images = load_annotations_from_csv(ANNOTATION_CSV_PATH, IMAGE_FOLDER)
        return {
            "annotations": annotations,
            "valid_images": valid_images,
            "missing_images": missing_images
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/save-annotations/")
def save_annotated(data: dict):
    try:
        save_annotations(ANNOTATION_CSV_PATH, data)
        return {"status": "saved"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/")
def read_root():
    return {"message": "Welcome to the Odia OCR backend!"}


@router.post("/import-csv/")
async def import_csv(file: UploadFile = File(...), image_folder: str = Form(...)):
    temp_path = os.path.join("temp", file.filename)
    os.makedirs("temp", exist_ok=True)

    with open(temp_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    try:
        annotations, valid_images, missing_images = load_annotations_from_csv(temp_path, image_folder)
        return {
            "annotations": annotations,
            "valid_images": valid_images,
            "missing_images": missing_images
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    
class ExportCSVRequest(BaseModel):
    annotations: dict
    validated_texts: dict

@router.post("/export-csv/")
async def export_csv(request: ExportCSVRequest):
    try:
        # Combine annotations and validated texts
        combined_data = {}
        for image_name in request.annotations.keys():
            combined_data[image_name] = {
                "extracted_text": request.annotations[image_name],
                "validated_text": request.validated_texts.get(image_name, "")
            }
        
        # Save to CSV
        save_annotations_to_csv(ANNOTATION_CSV_PATH, combined_data)
        
        # Return the file
        return FileResponse(
            ANNOTATION_CSV_PATH,
            media_type='text/csv',
            filename='annotations.csv'
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/annotations/")
def get_annotations_endpoint():
    try:
        annotations, valid_images, missing_images = load_annotations_from_csv(ANNOTATION_CSV_PATH, IMAGE_FOLDER)
        return {
            "annotations": annotations,
            "valid_images": valid_images,
            "missing_images": missing_images
        }
    except Exception as e:
        return {"error": str(e)}

@app.post("/save-annotations/")
async def save_annotations_endpoint(annotations: dict):
    try:
        save_annotations_to_csv(ANNOTATION_CSV_PATH, annotations)
        return {"message": "Annotations saved successfully."}
    except Exception as e:
        return {"error": str(e)}

# Include the router
app.include_router(router)
