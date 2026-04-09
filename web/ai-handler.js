import Replicate from "replicate";
import dotenv from "dotenv";

dotenv.config();

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_TOKEN,
});

/**
 * Removes the background of an image using AI.
 * @param {string} imageUrl - The URL or base64 of the product image.
 * @returns {Promise<string>} - The URL of the image with the background removed.
 */
export async function removeBackground(imageUrl) {
  console.log("AI: Removing background for image:", imageUrl);
  
  if (!process.env.REPLICATE_API_TOKEN) {
    throw new Error("REPLICATE_API_TOKEN is not set in .env");
  }

  // Using a popular background removal model on Replicate
  const output = await replicate.run(
    "lucataco/remove-bg:95fcc2a26d3899cd6c2691c900465aaeff466285a65c14638cc5f36f34befaf1",
    {
      input: {
        image: imageUrl
      }
    }
  );

  return output;
}

/**
 * Generates a new studio background for a product.
 * @param {string} imageUrl - The product image (already background removed or masked).
 * @param {string} prompt - The style of the studio (e.g., "marble table, soft lighting, professional studio").
 * @returns {Promise<string>} - The URL of the final product photo.
 */
export async function generateStudioBackground(imageUrl, prompt) {
  console.log("AI: Generating studio background with prompt:", prompt);
  
  const output = await replicate.run(
    "stability-ai/sdxl:7762fd07ce3c33307c67c33659c0e4810629532594639d6d8498f3cc69c5950d",
    {
      input: {
        prompt: `Professional product photography of a product on ${prompt}, high resolution, studio lighting, sharp focus`,
        image: imageUrl,
        mask_source: "alpha", // Assumes the input image has transparency from remove-bg
        inpainting_mask: imageUrl
      }
    }
  );

  return output[0];
}
