import os
from pathlib import Path
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
from dotenv import load_dotenv

from google import genai
from google.genai import types

# Load environment variables from .env file explicitly from backend directory
env_path = Path(__file__).parent / ".env"
load_dotenv(dotenv_path=env_path)

# Configure Gemini API Key
API_KEY = os.getenv("GEMINI_API_KEY")

# Initialize FastAPI app
app = FastAPI(title="Cat-Bot API")

# Configure CORS to allow requests from the Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "https://chat-bot.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class Message(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    messages: list[Message]
    language: Optional[str] = "ja" # Supports "ja", "en", "zh"

class ChatResponse(BaseModel):
    reply: str

@app.post("/api/chat", response_model=ChatResponse)
async def chat(request: ChatRequest):
    if not API_KEY or API_KEY == "your_gemini_api_key_here":
         raise HTTPException(status_code=500, detail="GEMINI_API_KEY is not configured on the backend.")
    
    try:
        # Initialize the new genai client
        client = genai.Client(api_key=API_KEY)
        
        # Convert frontend messages to Gemini history format (user -> user, bot -> model)
        gemini_history = []
        for msg in request.messages[:-1]:
            role = "user" if msg.role == "user" else "model"
            gemini_history.append(
                types.Content(role=role, parts=[types.Part.from_text(text=msg.content)])
            )
            
        latest_message = request.messages[-1].content
        
        # Add the latest message to the contents array
        gemini_history.append(
            types.Content(role="user", parts=[types.Part.from_text(text=latest_message)])
        )
        
        # Configure system instruction based on the requested language
        system_instruction = "You are a cute cat AI assistant. Always append 'meow' to the end of your responses and talk in a friendly, cat-like manner in English."
        if request.language == "ja":
            system_instruction = "あなたは可愛い猫のAIアシスタントです。ユーザーの質問に答えるときは、必ず語尾に「ニャ」や「ニャン」をつけて、猫らしい言葉遣いで親しみやすく日本語で返答してください。"
        elif request.language == "zh":
            system_instruction = "你是一只可爱的小猫AI助手。在回答用户问题时，请务必在句尾加上“喵”，并用友好、像猫一样的语气用中文回复。"
        
        # Generate content with the new SDK
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=gemini_history,
            config=types.GenerateContentConfig(
                system_instruction=system_instruction,
            )
        )
        
        return ChatResponse(reply=response.text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"LLM Error: {str(e)}")
