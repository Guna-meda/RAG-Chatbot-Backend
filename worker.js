import dotenv from 'dotenv';
import { Worker } from 'bullmq';
import { OpenAIEmbeddings } from "@langchain/openai";
import { QdrantVectorStore } from "@langchain/qdrant";
import { Document } from "@langchain/core/documents";
import { PDFLoader } from "@langchain/community/document_loaders/fs/pdf";
import { CharacterTextSplitter } from "@langchain/textsplitters";
import { QdrantClient } from '@qdrant/js-client-rest';

dotenv.config();

const worker = new Worker(
    'file-upload-queue',
  async job => {
    const data = job.data;
    /* 
    Path : data.path
    read thepdf from path
    breack it into chunks
    call the openai embbeding model for every chunk
    store the chunk in quadrantdb
    */

    //load the pdf
    const loader = new PDFLoader(data.path);
    const rawDocs = await loader.load();

    // split documents into chunks for better embedding quality
    const splitter = new CharacterTextSplitter({
      chunkSize: 1000,
      chunkOverlap: 200,
    });

    const docs = [];
    for (const d of rawDocs) {
      const chunks = await splitter.splitDocuments([d]);
      docs.push(...chunks);
    }

    const client = new QdrantClient({ url: process.env.QDRANT_URL });

    const embeddings = new OpenAIEmbeddings({
      model: "text-embedding-3-small",
      apiKey: process.env.OPENAI_API_KEY,
    });

    const vectorStore = await QdrantVectorStore.fromExistingCollection(embeddings, {
      url: process.env.QDRANT_URL,
      collectionName: "pdf-loader",
    });

    await vectorStore.addDocuments(docs);
    console.log("All docs are added to db.")

},
{ concurrency: 100, connection: {
  host: "localhost",
  port: 6379,
}}
);
