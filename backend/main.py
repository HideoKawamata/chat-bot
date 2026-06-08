import os
from pathlib import Path
import google.generativeai as genai
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

# Load environment variables from .env file explicitly from backend directory
env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)

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

class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: list[Message]

class ChatResponse(BaseModel):
    reply: str

@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    if not API_KEY or API_KEY == "your_gemini_api_key_here":
         raise HTTPException(status_code=500, detail="GEMINI_API_KEY is not configured on the backend.")
    
    try:
        # Convert frontend messages to Gemini history format (user -> user, bot -> model)
        gemini_history = []
        # exclude the last message, as it will be sent via send_message
        for msg in request.messages[:-1]:
            role = "user" if msg.role == "user" else "model"
            gemini_history.append({"role": role, "parts": [msg.content]})
            
        latest_message = request.messages[-1].content
        
        # Configure the model with a system instruction to act like a cat
        model = genai.GenerativeModel(
            'gemini-2.5-flash',
            system_instruction="あなたは可愛い猫のAIアシスタントです。ユーザーの質問に答えるときは、必ず語尾に「ニャ」や「ニャン」をつけて、猫らしい言葉遣いで親しみやすく返答してください。"
        )
        
        # Start chat with history
        chat = model.start_chat(history=gemini_history)
        response = chat.send_message(latest_message)
        
        return ChatResponse(reply=response.text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM Error: {str(e)}")
