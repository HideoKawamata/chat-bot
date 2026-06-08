"use client";

import { useState, useEffect } from "react";

type Message = {
  role: "user" | "bot";
  content: string;
};

type ChatSession = {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
};

const generateId = () => {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return Date.now().toString() + Math.random().toString(36).substring(2);
};

export default function Home() {
  const [chats, setChats] = useState<ChatSession[]>([]);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isClient, setIsClient] = useState(false);

  // Initial load
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsClient(true);
    const savedChats = localStorage.getItem("catbot_chats");
    if (savedChats) {
      try {
        const parsed = JSON.parse(savedChats);
        setChats(parsed);
        if (parsed.length > 0) {
          setCurrentChatId(parsed[0].id);
        }
      } catch (error) {
        console.error("Failed to parse chats from local storage", error);
      }
    }
  }, []);

  // Save on updates
  useEffect(() => {
    if (isClient) {
      localStorage.setItem("catbot_chats", JSON.stringify(chats));
    }
  }, [chats, isClient]);

  const currentChat = chats.find(c => c.id === currentChatId);
  const messages = currentChat ? currentChat.messages : [];

  const createNewChat = () => {
    const newChat: ChatSession = {
      id: generateId(),
      title: "新規チャット",
      messages: [],
      updatedAt: Date.now(),
    };
    setChats(prev => [newChat, ...prev]);
    setCurrentChatId(newChat.id);
  };

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    let activeChatId = currentChatId;
    let activeChats = [...chats];

    if (!activeChatId) {
      const newChat: ChatSession = {
        id: generateId(),
        title: input.slice(0, 20) + (input.length > 20 ? "..." : ""),
        messages: [],
        updatedAt: Date.now(),
      };
      activeChats = [newChat, ...activeChats];
      activeChatId = newChat.id;
      setCurrentChatId(activeChatId);
    }

    const userMessage: Message = { role: "user", content: input };
    const chatIndex = activeChats.findIndex(c => c.id === activeChatId);
    
    const updatedChat = {
      ...activeChats[chatIndex],
      messages: [...activeChats[chatIndex].messages, userMessage],
      updatedAt: Date.now(),
    };

    // Update the title if it's the first message
    if (activeChats[chatIndex].messages.length === 0 && activeChats[chatIndex].title === "新規チャット") {
      updatedChat.title = input.slice(0, 20) + (input.length > 20 ? "..." : "");
    }

    activeChats[chatIndex] = updatedChat;
    setChats(activeChats);
    setInput("");
    setIsLoading(true);

    const historyToSend = updatedChat.messages;

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/chat";
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        // Changed to match the backend expectation: { messages: [...] }
        body: JSON.stringify({ messages: historyToSend }),
      });

      if (!response.ok) {
        let errorMessage = `HTTP error! status: ${response.status}`;
        try {
          const errorData = await response.json();
          if (errorData.detail) {
             errorMessage += ` - ${errorData.detail}`;
          }
        } catch(_e) {
             errorMessage += ` - ${response.statusText}`;
        }
        throw new Error(`Failed to fetch response from backend: ${errorMessage}`);
      }

      const data = await response.json();
      const botMessage: Message = { role: "bot", content: data.reply };
      
      setChats(prevChats => {
        const newChats = [...prevChats];
        const idx = newChats.findIndex(c => c.id === activeChatId);
        if (idx !== -1) {
          newChats[idx] = {
            ...newChats[idx],
            messages: [...newChats[idx].messages, botMessage],
            updatedAt: Date.now(),
          };
        }
        return newChats;
      });

    } catch (error) {
      console.error(error);
      setChats(prevChats => {
        const newChats = [...prevChats];
        const idx = newChats.findIndex(c => c.id === activeChatId);
        if (idx !== -1) {
          newChats[idx] = {
            ...newChats[idx],
            messages: [...newChats[idx].messages, { role: "bot", content: "エラーが発生しました。バックエンドの接続を確認してください。" }],
            updatedAt: Date.now(),
          };
        }
        return newChats;
      });
    } finally {
      setIsLoading(false);
    }
  };

  const deleteChat = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updatedChats = chats.filter(c => c.id !== id);
    setChats(updatedChats);
    if (updatedChats.length === 0) {
      localStorage.removeItem("catbot_chats");
    }
    if (currentChatId === id) {
      setCurrentChatId(updatedChats.length > 0 ? updatedChats[0].id : null);
    }
  };

  if (!isClient) {
    return null; // Avoid hydration mismatch on first render
  }

  return (
    <div className="flex h-screen bg-gray-50 text-gray-800">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r flex flex-col h-full shadow-sm z-10 flex-shrink-0">
        <div className="p-4 border-b">
          <button
            onClick={createNewChat}
            className="w-full py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors font-medium flex items-center justify-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
            </svg>
            新規チャット
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {chats.map(chat => (
            <div
              key={chat.id}
              onClick={() => setCurrentChatId(chat.id)}
              className={`w-full text-left p-3 rounded-lg mb-1 cursor-pointer flex justify-between items-center group ${
                currentChatId === chat.id ? "bg-blue-50 text-blue-700 font-medium" : "hover:bg-gray-100 text-gray-600"
              }`}
            >
              <span className="truncate flex-1 text-sm">{chat.title}</span>
              <button 
                onClick={(e) => deleteChat(chat.id, e)}
                className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 p-1 ml-2"
                title="削除"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      </aside>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-full min-w-0">
        <header className="p-4 bg-white shadow-sm border-b flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-800">Cat-Bot AI</h1>
        </header>

        <main className="flex-1 overflow-y-auto p-4 w-full flex flex-col gap-4">
          {messages.length === 0 ? (
            <div className="text-center text-gray-400 mt-20 flex flex-col items-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
              <p>Cat-Botに何でも質問してくださいニャ！</p>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto w-full flex flex-col gap-4">
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`p-3 rounded-lg max-w-[80%] ${
                    msg.role === "user"
                      ? "bg-blue-500 text-white self-end rounded-br-none"
                      : "bg-white text-gray-800 self-start border rounded-bl-none shadow-sm"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                </div>
              ))}
              {isLoading && (
                <div className="bg-white text-gray-800 self-start border rounded-bl-none shadow-sm p-3 rounded-lg flex gap-1 items-center">
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span>
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></span>
                  <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0.4s" }}></span>
                </div>
              )}
            </div>
          )}
        </main>

        <footer className="p-4 bg-white border-t">
          <div className="max-w-3xl mx-auto flex gap-2">
            <input
              type="text"
              className="flex-1 p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black shadow-sm"
              placeholder="メッセージを入力..."
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                // Prevent default behavior to avoid unwanted newlines if it was a textarea
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              disabled={isLoading}
            />
            <button
              onClick={sendMessage}
              disabled={isLoading || !input.trim()}
              className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:bg-gray-300 transition-colors shadow-sm font-medium flex items-center justify-center flex-shrink-0"
            >
              送信
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
