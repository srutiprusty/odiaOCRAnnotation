import React, { useState, useEffect } from "react";
import { FaChevronDown } from "react-icons/fa";

const combinedKeyboard = [
  [
    { en: "`", or: "଼" },
    { en: "1", or: "୧" },
    { en: "2", or: "୨" },
    { en: "3", or: "୩" },
    { en: "4", or: "୪" },
    { en: "5", or: "୫" },
    { en: "6", or: "୬" },
    { en: "7", or: "୭" },
    { en: "8", or: "୮" },
    { en: "9", or: "୯" },
    { en: "0", or: "୰" },
    { en: "=", or: "=" },
  ],
  [
    { en: "q", or: "ୱ" },
    { en: "w", or: "୲" },
    { en: "e", or: "୳" },
    { en: "r", or: "୴" },
    { en: "t", or: "୵" },
    { en: "y", or: "୶" },
    { en: "u", or: "୷" },
    { en: "i", or: "୸" },
    { en: "o", or: "୹" },
    { en: "p", or: "୰" },
    { en: "[", or: "[" },
    { en: "]", or: "]" },
  ],
  [
    { en: "a", or: "ଅ" },
    { en: "s", or: "ଆ" },
    { en: "d", or: "ଇ" },
    { en: "f", or: "ଈ" },
    { en: "g", or: "ଉ" },
    { en: "h", or: "ଊ" },
    { en: "j", or: "ଋ" },
    { en: "k", or: "ଌ" },
    { en: "l", or: "ଏ" },
    { en: ";", or: ";" },
    { en: "'", or: "'" },
    { en: "\\", or: "\\" },
  ],
  [
    { en: "z", or: "ଓ" },
    { en: "x", or: "ଔ" },
    { en: "c", or: "କ" },
    { en: "v", or: "ଖ" },
    { en: "b", or: "ଗ" },
    { en: "n", or: "ଘ" },
    { en: "m", or: "ଙ" },
    { en: ",", or: "," },
    { en: ".", or: "." },
    { en: "/", or: "/" },
    { en: "-", or: "-" },
  ],
];

function OdiyaOCRTool() {
  const [validatedText, setValidatedText] = useState("");
  const [inscriptEnabled, setInscriptEnabled] = useState(true);
  const [geminiApiKey, setGeminiApiKey] = useState("");
  const [images, setImages] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedImageNames, setSelectedImageNames] = useState([]);
  const [ocrResult, setOcrResult] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);

  const handleInsert = (char) => setValidatedText((prev) => prev + char);

  const loadCSV = async () => {
    try {
      setError(null);
      setIsProcessing(true);

      // Create a file input element
      const fileInput = document.createElement("input");
      fileInput.type = "file";
      fileInput.accept = ".csv";

      fileInput.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const formData = new FormData();
        formData.append("file", file);
        formData.append("image_folder", "uploaded_images");

        const response = await fetch("http://localhost:8000/import-csv/", {
          method: "POST",
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`Failed to load CSV: ${response.statusText}`);
        }

        const data = await response.json();
        console.log("CSV Load Result:", data);

        if (data.valid_images && data.valid_images.length > 0) {
          setImages(data.valid_images);
          setSelectedImageNames(data.valid_images);
          setCurrentIndex(0);

          // Load annotations
          if (data.annotations) {
            setOcrResult(data.annotations);
            const firstImage = data.valid_images[0];
            if (data.annotations[firstImage]) {
              setValidatedText(
                data.annotations[firstImage].validated_text || ""
              );
            }
          }
        } else {
          setError("No valid images found in the CSV file");
        }
      };

      fileInput.click();
    } catch (err) {
      setError(`Failed to load CSV: ${err.message}`);
      console.error("CSV Load Error:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleUploadImages = async (files) => {
    try {
      setError(null);
      const formData = new FormData();
      for (let file of files) {
        formData.append("files", file);
      }

      const response = await fetch("http://localhost:8000/upload/", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }

      const data = await response.json();
      if (data && data.images) {
        setImages((prev) => [...prev, ...data.images]);
        setSelectedImageNames((prev) => [...prev, ...data.images]);
        setCurrentIndex(images.length);
      }
    } catch (err) {
      setError(`Failed to upload images: ${err.message}`);
    }
  };

  const processOCR = async () => {
    if (!geminiApiKey) {
      setError("Please enter your Gemini API Key");
      return;
    }
    if (selectedImageNames.length === 0) {
      setError("Please select at least one image");
      return;
    }

    try {
      setError(null);
      setIsProcessing(true);
      const response = await fetch("http://localhost:8000/process-ocr/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          api_key: geminiApiKey,
          image_filenames: selectedImageNames,
        }),
      });

      if (!response.ok) {
        throw new Error(`OCR processing failed: ${response.statusText}`);
      }

      const result = await response.json();
      console.log("OCR Result:", result);

      // Update the OCR result state
      setOcrResult(result);

      // Update the validated text for the current image
      const currentImg = images[currentIndex];
      if (result && result[currentImg]) {
        setValidatedText(result[currentImg]);
        console.log("Updated text for:", currentImg, result[currentImg]);
      }
    } catch (err) {
      setError(`OCR processing failed: ${err.message}`);
      console.error("OCR Error:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  const saveAnnotations = async () => {
    try {
      setError(null);
      const response = await fetch("http://localhost:8000/save-annotations/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          [images[currentIndex]]: {
            extracted_text:
              ocrResult?.[images[currentIndex]]?.extracted_text || "",
            validated_text: validatedText,
          },
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to save annotations: ${response.statusText}`);
      }

      const data = await response.json();
      console.log("Annotations saved:", data);
    } catch (err) {
      setError(`Failed to save annotations: ${err.message}`);
    }
  };

  useEffect(() => {
    const loadImages = async () => {
      const res = await fetch("http://localhost:8000/annotations/");
      const data = await res.json();
      if (data && data.valid_images) {
        setImages(data.valid_images);
        setSelectedImageNames(data.valid_images);
      }
    };
    loadImages();
  }, []);

  const nextImage = () => {
    if (currentIndex < images.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      // Update text when changing images
      const nextImg = images[currentIndex + 1];
      if (ocrResult && ocrResult[nextImg]) {
        setValidatedText(ocrResult[nextImg].extracted_text || "");
      } else {
        setValidatedText("");
      }
    }
  };

  const prevImage = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
      // Update text when changing images
      const prevImg = images[currentIndex - 1];
      if (ocrResult && ocrResult[prevImg]) {
        setValidatedText(ocrResult[prevImg].extracted_text || "");
      } else {
        setValidatedText("");
      }
    }
  };

  const currentImage = images[currentIndex];

  return (
    <div className="min-h-screen bg-gray-100 p-4 font-sans">
      <h1 className="text-3xl font-bold text-center mb-6 text-blue-800">
        Odiya OCR Annotation Tool
      </h1>

      {error && (
        <div
          className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4"
          role="alert"
        >
          <span className="block sm:inline">{error}</span>
        </div>
      )}

      <div className="border rounded p-4 mb-4 shadow-sm">
        <h2 className="font-semibold text-base mb-2">Controls</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-2 items-center mb-4">
          <h3>Gemini API Key:</h3>
          <input
            type="password"
            value={geminiApiKey}
            onChange={(e) => setGeminiApiKey(e.target.value)}
            placeholder="Enter Gemini API Key"
            className="col-span-2 p-1 border rounded md:col-span-3"
          />

          <label className="bg-blue-700 text-white px-4 py-2 rounded hover:bg-blue-800 cursor-pointer inline-block text-center">
            Load Folder
            <input
              type="file"
              multiple
              accept="image/*"
              onChange={(e) => handleUploadImages(e.target.files)}
              className="hidden"
            />
          </label>

          <button
            className={`bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700 ${
              isProcessing ? "opacity-50 cursor-not-allowed" : ""
            }`}
            onClick={processOCR}
            disabled={isProcessing}
          >
            {isProcessing ? "Processing..." : "Process OCR"}
          </button>
          <button
            className={`bg-blue-700 text-white px-4 py-2 rounded hover:bg-blue-800 ${
              isProcessing ? "cursor-not-allowed" : ""
            }`}
            onClick={loadCSV}
            disabled={isProcessing}
          >
            Load CSV
          </button>

          <button
            className="bg-gray-600 text-white px-4 py-2 rounded hover:bg-gray-700"
            onClick={saveAnnotations}
          >
            Save CSV
          </button>
        </div>

        <div className="justify-between mb-2 grid grid-cols-4 gap-2 items-center">
          <button
            className="bg-slate-300 px-4 py-1 rounded hover:bg-slate-400"
            onClick={prevImage}
          >
            Previous
          </button>

          <div className="relative col-span-2">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="w-full bg-white p-1 border rounded flex justify-between items-center"
            >
              <span>{currentImage || "Select Image"}</span>
              <FaChevronDown className="ml-2" />
            </button>

            {showDropdown && (
              <div className="absolute z-10 mt-1 bg-white border rounded shadow-md w-full max-h-48 overflow-y-auto">
                {images.map((img, index) => (
                  <div
                    key={index}
                    className="cursor-pointer hover:bg-gray-100 p-2 flex items-center"
                    onClick={() => {
                      setCurrentIndex(index);
                      setShowDropdown(false);
                    }}
                  >
                    <img
                      src={`http://localhost:8000/images/${encodeURIComponent(
                        img
                      )}`}
                      alt={`Image ${index + 1}`}
                      className="w-12 h-12 object-cover rounded mr-2"
                    />
                    <span>{img}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            className="bg-slate-300 px-4 py-1 rounded hover:bg-slate-400"
            onClick={nextImage}
          >
            Next
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="border rounded p-3">
          <h2 className="font-semibold mb-2">Image Viewer</h2>
          {currentImage ? (
            <img
              src={`http://localhost:8000/images/${encodeURIComponent(
                currentImage
              )}`}
              alt="Current"
              className="max-h-full w-auto"
            />
          ) : (
            <p>No image selected</p>
          )}
        </div>

        <div className="border rounded p-4 flex flex-col">
          <h2 className="text-base font-semibold mb-2">
            Validated Text Editor
          </h2>
          <label className="mb-2 flex items-center gap-2">
            <input
              type="checkbox"
              checked={inscriptEnabled}
              onChange={() => setInscriptEnabled(!inscriptEnabled)}
            />
            Enable Odiya INSCRIPT Keyboard
          </label>
          <textarea
            value={validatedText}
            onChange={(e) => setValidatedText(e.target.value)}
            className="flex-1 border p-2 mb-2 rounded resize-none h-40"
          />
          <button
            className="bg-green-600 text-white py-2 rounded hover:bg-green-700"
            onClick={saveAnnotations}
          >
            Save Current Annotation
          </button>
          {ocrResult && ocrResult[currentImage] && (
            <div className="mt-4 text-sm bg-gray-100 p-2 rounded">
              <strong>Extracted Text:</strong> {ocrResult[currentImage]}
            </div>
          )}
        </div>
      </div>

      <div className="mt-4 border rounded p-4">
        <h2 className="text-base font-semibold mb-2">
          Virtual Keyboard (Click to Insert)
        </h2>
        {combinedKeyboard.map((row, rowIndex) => (
          <div key={rowIndex} className="gap-2 mb-2 grid grid-cols-12">
            {row.map(({ en, or }, index) => (
              <button
                key={index}
                className="bg-white border px-3 py-2 text-xs rounded hover:bg-gray-200 shadow-sm text-center"
                onClick={() => handleInsert(or)}
              >
                <div className="text-gray-600">{en}</div>
                <div className="font-bold">{or}</div>
              </button>
            ))}
          </div>
        ))}
        <div className="text-center mt-2">
          <button
            className="bg-white px-12 py-2 rounded shadow-sm hover:bg-gray-200"
            onClick={() => handleInsert(" ")}
          >
            Space
          </button>
        </div>
      </div>
    </div>
  );
}

export default OdiyaOCRTool;
