import requests
import zipfile
import io
import os

# Replace with your actual ngrok URL and endpoint
url = "https://6f58-34-126-165-8.ngrok-free.app/post"

# Define a list of prompts to send to your model
payload = {
    "prompts": [
        "A cage where a monster is trapped",
        "A futuristic cityscape under neon lights",
        "A peaceful forest with mystical creatures"
    ]
}

# Send a POST request with the JSON payload
response = requests.post(url, json=payload)

# Check if the response is JSON (which might indicate an error)
if response.headers.get("Content-Type") == "application/json":
    print("Error:", response.json())
else:
    # Create a BytesIO stream from the response content (ZIP file)
    zip_file_bytes = io.BytesIO(response.content)
    
    # Open the ZIP file from the BytesIO stream
    with zipfile.ZipFile(zip_file_bytes, "r") as zip_ref:
        # Create a directory to extract the images if it doesn't exist
        output_dir = "extracted_images"
        os.makedirs(output_dir, exist_ok=True)
        
        # Extract all files into the specified directory
        zip_ref.extractall(output_dir)
    
    print(f"Images extracted and saved in the '{output_dir}' directory")