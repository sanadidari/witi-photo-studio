# WITI Photo Studio Architecture

## AI Strategy & Implementation

### 1. Cost & Resource Management
- Serverless Inference: Leveraging Replicate's pay-per-second billing for SDXL (Stable Diffusion XL) to avoid fixed GPU costs.
- - Image Optimization: Source images are resized and compressed on the client-side before upload to minimize bandwidth and processing time.
  - - Caching Layer: Generated results are cached in Vercel Blob Storage to prevent redundant costly inference for the same parameters.
   
    - ### 2. Latency & UX Optimization
    - - Asynchronous Processing: Utilizing webhooks from Replicate to notify the application when generation is complete, avoiding long-polling and improving server scalability.
      - - Optimistic UI: Immediate visual feedback during background removal and studio shot generation.
        - - Edge Functions: Re-proxying AI requests through Vercel Edge Functions to reduce TTFB (Time To First Byte).
         
          - ### 3. Security & Token Governance
          - - Secret Management: AI API keys (Replicate) are never exposed to the frontend; all calls are routed through a secured backend proxy with rate-limiting.
            - - Input Sanitization: Prompt injection prevention through strict parameter validation and predefined template structures.
             
              - ## Tech Stack
              - - Frontend: Shopify Polaris, React, Vite.
                - - Backend: Node.js, Express.
                  - - AI Engine: Replicate (SDXL, Segment Anything Model).
                    - - Storage: Vercel Blob / Supabase.
                      - 
