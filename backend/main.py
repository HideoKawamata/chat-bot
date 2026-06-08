import os
import google.generativeai as genai
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Configure Gemini API
API_KEY = os.getenv("GEMINI_API_KEY")
if API_KEY:
    genai.configure(api_key=API_KEY)

# Initialize FastAPI app
app = FastAPI(title="Cat-Bot API")

# Configure CORS to allow requests from the Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ChatRequest(BaseModel):
    message: str

class ChatResponse(BaseModel):
    reply: str

@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    if not API_KEY or API_KEY == "your_gemini_api_key_here":
         raise HTTPException(status_code=500, detail="GEMINI_API_KEY is not configured on the backend.")
    
    try:
        # Using gemini-1.5-flash which is fast and good for text
        model = genai.GenerativeModel('gemini-1.5-flash')
        
        # In a real app, you might want to maintain a conversation history.
        # For simplicity, we are just passing the latest message here.
        response = model.generate_content(request.message)
        
        return ChatResponse(reply=response.text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM Error: {str(e)}")
