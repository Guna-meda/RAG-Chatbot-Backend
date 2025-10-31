import "./env.js";
import dotenv from 'dotenv';
dotenv.config();
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { Queue } from "bullmq";
import { QdrantVectorStore } from "@langchain/qdrant";
import { OpenAIEmbeddings } from "@langchain/openai";
import {OpenAI} from 'openai'

const client = new OpenAI({apiKey: process.env.OPENAI_API_KEY})

const queue = new Queue("file-upload-queue" ,{ connection: {
  host: "localhost",
  port: 6379,
}
});


const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/')
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9)
    cb(null, `${uniqueSuffix}-${file.originalname}`)
  }
});

const upload = multer({storage: storage })

const app = express();
app.use(cors());

app.get('/', (req, res) => {
    return res.json({ status: 'All good' });
});

// enqueueing the file after storing to multer
app.post('/upload/pdf' , upload.single('pdf') , async (req , res) => {
  // pass a plain object as job data (bullmq will serialize it)
  await queue.add('file-ready', {
    filename: req.file.originalname,
    destination: req.file.destination,
    path: req.file.path,
  });

  return res.json({ message: 'uploaded' })
})

app.get('/chat' , async(req , res) => {
  const userQuery =  'NABC framework'

   const embeddings = new OpenAIEmbeddings({
      model: "text-embedding-3-small",
      apiKey: process.env.OPENAI_API_KEY,
    });
   const vectorStore = await QdrantVectorStore.fromExistingCollection(embeddings, {
      url: process.env.QDRANT_URL,
      collectionName: "pdf-loader",
    });
    const ret = vectorStore.asRetriever({
      k:2 , 
    })
    const result = await ret.invoke(userQuery)

    
  const SYSTEM_PROMPT = `
  You are a helpful AI Assistant who answers the user query based on the available context from PDF files.
  Context:
  ${JSON.stringify(result)}
  `;

  

    return res.json({result})
})

const PORT = process.env.PORT || 8000;
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});

