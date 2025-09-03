import { GoogleGenAI, Modality, Type } from "@google/genai";

if (!process.env.API_KEY) {
    throw new Error("API_KEY environment variable not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

type AspectRatio = '16:9' | '1:1' | '9:16' | '4:3' | '3:4';
type UploadedImage = {
    data: string; // base64 string without prefix
    mimeType: string;
};
export type PromptSuggestion = {
    visual_prompt: string;
};


export const generateThumbnail = async (
    prompt: string,
    negativePrompt: string,
    aspectRatio: AspectRatio,
    image?: UploadedImage | null
): Promise<string> => {
    try {
        if (image) {
            // Image editing/modification path
            let editingInstruction = `You are an expert digital artist specializing in photorealistic character integration. Your task is to take the person from the provided image and place them seamlessly into a new environment described by the user. **Crucially, you must preserve the exact facial features, hairstyle, and unique likeness of the person with the highest possible fidelity.** Do not change their appearance or identity. Now, generate the following scene: "${prompt}"`;

            if (negativePrompt) {
                editingInstruction += `\n\n**IMPORTANTLY, AVOID the following elements at all costs: ${negativePrompt}.**`;
            }

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash-image-preview',
                contents: {
                    parts: [
                        { inlineData: { data: image.data, mimeType: image.mimeType } },
                        { text: editingInstruction },
                    ],
                },
                config: {
                    responseModalities: [Modality.IMAGE, Modality.TEXT],
                },
            });

            const imagePart = response.candidates?.[0]?.content?.parts?.find(part => part.inlineData);

            if (imagePart?.inlineData) {
                return `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`;
            } else {
                 throw new Error("No image was generated. The model may have refused the prompt. Please try describing a different scene.");
            }
        } else {
            // Text-to-image generation path
            const fullPrompt = `${prompt}. ${negativePrompt ? `Negative prompt: ${negativePrompt}` : ''}`;

            const response = await ai.models.generateImages({
                model: 'imagen-4.0-generate-001',
                prompt: fullPrompt,
                config: {
                  numberOfImages: 1,
                  outputMimeType: 'image/jpeg',
                  aspectRatio: aspectRatio,
                },
            });

            if (response.generatedImages?.length > 0) {
                const base64ImageBytes: string = response.generatedImages[0].image.imageBytes;
                return `data:image/jpeg;base64,${base64ImageBytes}`;
            } else {
                throw new Error("No image was generated. The response may have been blocked due to safety policies. Please revise your prompt.");
            }
        }
    } catch (error) {
        console.error("Error generating thumbnail:", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        
        if (errorMessage.includes('blocked') || errorMessage.includes('safety')) {
             throw new Error("The generation was blocked due to safety policies. Please revise your prompt.");
        }
        
        throw new Error(`Failed to generate thumbnail: ${errorMessage}`);
    }
};

export const getPromptSuggestions = async (currentPrompt: string): Promise<PromptSuggestion> => {
    try {
        const systemInstruction = "You are an expert YouTube thumbnail strategist. Your goal is to help users create a vivid, detailed, and click-worthy visual prompt for an AI image generator.";
        const userPrompt = `Based on the user's idea: '${currentPrompt || 'a popular YouTube video'}', generate one improved and highly detailed visual prompt. The new prompt must include specific details about cinematic lighting, dynamic composition, and a clear emotional tone to make it more engaging.`;

        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash",
            contents: userPrompt,
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        visual_prompt: {
                            type: Type.STRING,
                            description: 'A single, detailed visual prompt for the AI image generator.'
                        },
                    },
                    required: ['visual_prompt'],
                },
            },
        });

        const jsonStr = response.text.trim();
        const parsed = JSON.parse(jsonStr);

        if (parsed.visual_prompt) {
            return parsed;
        } else {
            throw new Error("Invalid response format from AI for suggestions.");
        }
    } catch (error) {
        console.error("Error getting prompt suggestions:", error);
        const errorMessage = error instanceof Error ? error.message : "An unknown error occurred.";
        throw new Error(`Failed to get prompt suggestions: ${errorMessage}`);
    }
};