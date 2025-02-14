from flask import Flask, request, jsonify, send_from_directory
import edge_tts
import asyncio
import os
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# Create a directory for audio files if it doesn't exist
AUDIO_DIR = os.path.join(os.path.dirname(__file__), 'generated_audio')
if not os.path.exists(AUDIO_DIR):
    os.makedirs(AUDIO_DIR)

async def generate_speech(text, filename):
    try:
        communicate = edge_tts.Communicate(text, "en-US-AndrewMultilingualNeural")
        await communicate.save(filename)
        return True
    except Exception as e:
        print(f"Error generating speech: {e}")
        return False

@app.route('/generate-audio', methods=['POST'])
def generate_audio():
    try:
        data = request.json
        if not data or 'text' not in data:
            return jsonify({'error': 'No text provided'}), 400

        story_text = data['text']
        
        # Generate a unique filename
        filename = os.path.join(AUDIO_DIR, f'story_{data.get("phase", "latest")}.mp3')
        
        # Run the async function
        success = asyncio.run(generate_speech(story_text, filename))
        
        if success:
            return jsonify({
                'success': True,
                'audioFile': os.path.basename(filename)
            })
        else:
            return jsonify({'error': 'Failed to generate audio'}), 500

    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/audio/<filename>')
def serve_audio(filename):
    return send_from_directory(AUDIO_DIR, filename)

if __name__ == '__main__':
    app.run(port=5001) 