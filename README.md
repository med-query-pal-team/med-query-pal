# Medical Query Assistant

🔗 **Live Demo:** [https://med-query-pal.vercel.app/](https://med-query-pal.vercel.app/)

This project is a Vite + React + TypeScript application designed to serve as a Medical Query Assistant.

## 🚀 Features

* Medical query chat assistant
* RAG (Retrieval-Augmented Generation) using Supabase
* Tailwind CSS & shadcn-ui UI components
* Vite for fast development
* TypeScript support

## 🛠️ Tech Stack

* **Frontend:** React, Vite, TypeScript
* **UI:** Tailwind CSS, shadcn-ui
* **Backend:** Supabase (Edge Functions)
* **AI:** Gemini API (direct integration)

## 📦 Getting Started

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

## 📁 Folder Structure

```
project/
 ├─ src/
 ├─ public/
 ├─ supabase/ (Edge functions & config)
 ├─ package.json
 └─ vite.config.ts
```

## 🌐 Deployment

You can deploy this project on:

* Vercel
* Netlify
* Supabase Hosting

## 🔐 Environment Variables

Create a `.env` file with:

```
VITE_SUPABASE_URL=your_url
VITE_SUPABASE_ANON_KEY=your_key
GEMINI_API_KEY=your_api_key
```

## ✅ Notes

* Lovable AI integration has been **removed**
* Now uses **Gemini API directly** for chat responses

## 📞 Support

For improvements or bugs, feel free to contribute or reach out.

Happy Building! 💡👩‍💻
