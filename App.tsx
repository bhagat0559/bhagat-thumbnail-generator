
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { generateThumbnail, getPromptSuggestions, PromptSuggestion } from './services/geminiService';
import Loader from './components/Loader';

type UploadedImage = {
    data: string; // base64 data URL
    mimeType: string;
};

type AspectRatio = '16:9' | '1:1' | '9:16' | '4:3' | '3:4';

const drawCanvas = (
    base64Image: string,
    targetAspectRatio: AspectRatio
): Promise<string> => {
    return new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () => {
            const [targetW, targetH] = targetAspectRatio.split(':').map(Number);
            const targetRatio = targetW / targetH;
            const originalW = image.width;
            const originalH = image.height;
            const originalRatio = originalW / originalH;

            let canvasW = originalW;
            let canvasH = originalH;

            if (Math.abs(targetRatio - originalRatio) > 0.01) {
                 if (targetRatio > originalRatio) {
                    canvasH = originalH;
                    canvasW = originalH * targetRatio;
                } else {
                    canvasW = originalW;
                    canvasH = originalW / targetRatio;
                }
            }

            const canvas = document.createElement('canvas');
            canvas.width = Math.round(canvasW);
            canvas.height = Math.round(canvasH);
            const ctx = canvas.getContext('2d');
            if (!ctx) return reject(new Error('Could not get canvas context'));

            // Background for padding
            ctx.fillStyle = '#000000';
            ctx.fillRect(0, 0, canvas.width, canvas.height);

            const offsetX = (canvas.width - originalW) / 2;
            const offsetY = (canvas.height - originalH) / 2;
            ctx.drawImage(image, Math.round(offsetX), Math.round(offsetY), originalW, originalH);
            
            resolve(canvas.toDataURL('image/jpeg'));
        };
        image.onerror = () => reject(new Error('Failed to load image for canvas rendering.'));
        image.crossOrigin = 'anonymous';
        image.src = base64Image;
    });
};


const App: React.FC = () => {
    const initialPrompt = "A dramatic and inspirational YouTube thumbnail showing the Indian flag waving proudly on top of the Earth, golden sunlight shining behind it, futuristic skyscrapers and technology in the background, a confident young person pointing forward with determination, bold glowing text overlay: ‘India #1 in the World’, vibrant colors (saffron, white, green, blue), cinematic style, ultra-realistic, high contrast, motivational theme.";
    
    const [prompt, setPrompt] = useState<string>(initialPrompt);
    const [negativePrompt, setNegativePrompt] = useState<string>('blurry, deformed, watermark');
    const [style, setStyle] = useState<string>('Cinematic');
    const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
    
    const [rawImageUrl, setRawImageUrl] = useState<string | null>(null);
    const [finalImageUrl, setFinalImageUrl] = useState<string | null>(null);

    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [uploadedImage, setUploadedImage] = useState<UploadedImage | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isAppVisible, setIsAppVisible] = useState(false);
    
    const [isSuggesting, setIsSuggesting] = useState<boolean>(false);

    useEffect(() => {
        setIsAppVisible(true);
    }, []);

    useEffect(() => {
        if (!rawImageUrl) return;
        drawCanvas(rawImageUrl, aspectRatio)
            .then(setFinalImageUrl)
            .catch(err => setError(`Canvas Render Error: ${err.message}`));
    }, [rawImageUrl, aspectRatio]);

    const styles = ['Cinematic', 'Minimalist', 'Cartoonish', 'Photorealistic', 'Vibrant', 'Dark & Moody'];
    const aspectRatios: Array<AspectRatio> = ['16:9', '1:1', '9:16', '4:3', '3:4'];
    
    const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => {
                setUploadedImage({
                    data: reader.result as string,
                    mimeType: file.type,
                });
                setPrompt("");
            };
            reader.readAsDataURL(file);
        }
    };

    const removeImage = () => {
        setUploadedImage(null);
        setPrompt(initialPrompt);
        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    };

    const handleGetSuggestions = useCallback(async () => {
        if (!prompt) return;
        setIsSuggesting(true);
        setError(null);
        try {
            const result = await getPromptSuggestions(prompt);
            setPrompt(result.visual_prompt);
        } catch (err) {
            setError(err instanceof Error ? `Suggestion Error: ${err.message}` : 'An unknown error occurred while getting suggestions');
        } finally {
            setIsSuggesting(false);
        }
    }, [prompt]);

    const handleGenerate = useCallback(async () => {
        if (!prompt && !uploadedImage) return;

        setIsLoading(true);
        setError(null);
        setRawImageUrl(null);
        setFinalImageUrl(null);

        try {
            const finalPrompt = `${prompt}, ${style.toLowerCase()} style`;
            const imageToPass = uploadedImage ? { data: uploadedImage.data.split(',')[1], mimeType: uploadedImage.mimeType } : null;
            
            const generatedUrl = await generateThumbnail(finalPrompt, negativePrompt, aspectRatio, imageToPass);
            setRawImageUrl(generatedUrl);

        } catch (err) {
            setError(err instanceof Error ? err.message : 'An unknown error occurred');
            setIsLoading(false);
        } finally {
             // Let the useEffect handle the final isLoading state after canvas render
        }
    }, [prompt, negativePrompt, style, aspectRatio, uploadedImage]);
    
    useEffect(() => {
        if (rawImageUrl) {
            setIsLoading(false);
        }
    }, [rawImageUrl]);


    const handleDownload = useCallback(() => {
        if (!finalImageUrl) return;
        const link = document.createElement('a');
        link.href = finalImageUrl;
        link.download = 'bhagat-thumbnail.jpeg';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }, [finalImageUrl]);

    return (
        <div className={`min-h-screen w-full bg-gray-900 text-gray-200 transition-opacity duration-1000 ${isAppVisible ? 'opacity-100' : 'opacity-0'}`}>
            <main className="max-w-screen-2xl mx-auto p-4 sm:p-6 lg:p-8">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                    {/* Left Controls Panel */}
                    <div className="lg:col-span-4 xl:col-span-3 bg-gray-800 rounded-xl shadow-lg p-6">
                        <header className="text-center border-b border-gray-700 pb-6 mb-8">
                            <h1 className="text-3xl font-serif tracking-tight font-bold text-white">
                                Bhagat <span className="text-amber-500">AI Generator</span>
                            </h1>
                            <p className="mt-2 text-sm text-gray-400">Craft your vision into a viral masterpiece.</p>
                        </header>

                        <div className="space-y-6">
                            {/* Step 1: Prompt */}
                            <div>
                                <label htmlFor="prompt-input" className="block text-sm font-semibold text-gray-300 mb-2">
                                    1. Describe Your Vision
                                </label>
                                <div className="relative w-full">
                                    <textarea id="prompt-input" rows={5} className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 pr-10 text-gray-200 placeholder-gray-500 focus:ring-2 focus:ring-amber-500 focus:border-amber-500" placeholder={uploadedImage ? "e.g., Place this person in a futuristic city..." : "e.g., A cat wearing a spacesuit..."} value={prompt} onChange={(e) => setPrompt(e.target.value)} disabled={isLoading} />
                                    <button type="button" title="Improve prompt with AI" className="absolute bottom-3 right-3 text-gray-400 hover:text-amber-500 disabled:opacity-50 disabled:cursor-not-allowed" disabled={isLoading || isSuggesting || !prompt} aria-label="Improve prompt with AI" onClick={handleGetSuggestions}>
                                        {isSuggesting ? <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg> : <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 20 20" fill="currentColor"><path d="M10 3.5a1.5 1.5 0 011.493 1.355l.57 2.282a3.5 3.5 0 002.418 2.418l2.281.571a1.5 1.5 0 010 2.988l-2.281.57a3.5 3.5 0 00-2.418 2.419l-.57 2.28a1.5 1.5 0 01-2.986 0l-.57-2.28a3.5 3.5 0 00-2.418-2.419l-2.281-.57a1.5 1.5 0 010-2.988l2.281-.57a3.5 3.5 0 002.418-2.418l.57-2.282A1.5 1.5 0 0110 3.5zM5.25 15.25a.75.75 0 01.745.668l.286 1.142a2.5 2.5 0 001.727 1.727l1.142.286a.75.75 0 010 1.49l-1.142.286a2.5 2.5 0 00-1.727 1.727l-.286 1.142a.75.75 0 01-1.49 0l-.286-1.142a2.5 2.5 0 00-1.727-1.727l-1.142-.286a.75.75 0 010-1.49l1.142-.286a2.5 2.5 0 001.727-1.727l.286-1.142a.75.75 0 01.668-.745zM14.75 5.25a.75.75 0 01.745.668l.286 1.142a2.5 2.5 0 001.727 1.727l1.142.286a.75.75 0 010 1.49l-1.142.286a2.5 2.5 0 00-1.727 1.727l-.286 1.142a.75.75 0 01-1.49 0l-.286-1.142a2.5 2.5 0 00-1.727-1.727l-1.142-.286a.75.75 0 010-1.49l1.142-.286a2.5 2.5 0 001.727-1.727l.286-1.142a.75.75 0 01.668-.745z" /></svg>}
                                    </button>
                                </div>
                            </div>
                            {/* Negative Prompt */}
                             <div>
                                <label htmlFor="negative-prompt-input" className="block text-sm font-semibold text-gray-300 mb-2">2. Negative Prompt <span className='text-gray-500 font-normal'>(Optional)</span></label>
                                <textarea id="negative-prompt-input" rows={2} className="w-full bg-gray-900 border border-gray-700 rounded-lg p-3 text-gray-200 placeholder-gray-500 focus:ring-2 focus:ring-amber-500 focus:border-amber-500" placeholder="e.g., blurry, text, watermark, ugly" value={negativePrompt} onChange={(e) => setNegativePrompt(e.target.value)} disabled={isLoading} />
                            </div>
                            {/* Step 3: Reference Image */}
                             <div>
                                <label className="block text-sm font-semibold text-gray-300 mb-2">3. Reference Image <span className='text-gray-500 font-normal'>(Optional)</span></label>
                                {uploadedImage ? (
                                    <div className="p-4 rounded-lg bg-gray-900 border border-gray-700 text-center"><div className="relative group inline-block"><img src={uploadedImage.data} alt="Upload preview" className="max-h-32 w-auto rounded-lg shadow-md mx-auto" /><button onClick={removeImage} className="absolute -top-2 -right-2 bg-red-600 rounded-full p-1.5 text-white opacity-0 group-hover:opacity-100" aria-label="Remove image"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg></button></div><p className="text-xs text-gray-500 mt-2">AI will preserve the character's likeness.</p></div>
                                ) : (
                                    <div className="flex justify-center items-center rounded-lg border-2 border-dashed border-gray-600 p-6 bg-gray-900 hover:border-amber-500"><div className="text-center"><svg className="mx-auto h-8 w-8 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" /></svg><label htmlFor="file-upload" className="mt-2 text-sm font-semibold text-amber-500 cursor-pointer hover:text-amber-400">Upload an image<input id="file-upload" type="file" className="sr-only" onChange={handleImageUpload} ref={fileInputRef} accept="image/png, image/jpeg, image/webp" /></label><p className="text-xs text-gray-500">PNG, JPG, WEBP</p></div></div>
                                )}
                            </div>
                            {/* Step 4: Style & Ratio */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-300 mb-2">4. Style & Aspect Ratio</label>
                                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
                                    {styles.map((s) => <button key={s} onClick={() => setStyle(s)} disabled={isLoading} className={`text-center text-sm p-2.5 rounded-md border ${style === s ? 'bg-amber-600 font-semibold border-amber-500 text-white' : 'bg-gray-700 border-gray-600 hover:bg-gray-600'}`}>{s}</button>)}
                                </div>
                                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                                    {aspectRatios.map((ar) => <button key={ar} onClick={() => setAspectRatio(ar)} disabled={isLoading} className={`text-center text-sm p-2 rounded-md border h-12 ${aspectRatio === ar ? 'bg-amber-600 font-semibold border-amber-500 text-white' : 'bg-gray-700 border-gray-600 hover:bg-gray-600'}`}>{ar}</button>)}
                                </div>
                            </div>
                        </div>

                        <div className="pt-8 mt-auto">
                            <button onClick={handleGenerate} disabled={isLoading || (!prompt && !uploadedImage)} className="w-full flex items-center justify-center gap-3 bg-amber-600 text-gray-900 font-bold py-3 px-6 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed hover:bg-amber-500">
                                {isLoading ? (<><svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg><span>Generating...</span></>) : (<><svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" /></svg><span>{uploadedImage ? 'Generate with Image' : 'Generate'}</span></>)}
                            </button>
                        </div>
                    </div>

                    {/* Right Display Panel */}
                    <div className="lg:col-span-8 xl:col-span-9 bg-gray-800 rounded-xl shadow-lg p-4 sm:p-6 flex flex-col items-center justify-center min-h-[60vh] lg:min-h-0">
                        <div className="w-full h-full rounded-xl bg-gray-900 border border-gray-700 flex flex-col items-center justify-center" aria-live="polite">
                            {isLoading ? <Loader /> : error ? <div role="alert" className="text-center text-red-400 p-8"><h3 className="text-xl font-bold">Generation Failed</h3><p className="mt-2 text-sm max-w-md">{error}</p><button onClick={handleGenerate} className="mt-6 px-5 py-2.5 bg-amber-600 text-gray-900 rounded-lg font-semibold hover:bg-amber-500">Try Again</button></div> : finalImageUrl ? (<div className="w-full text-center flex flex-col items-center h-full p-4"><div className={`w-full flex-1 flex items-center justify-center`}><img src={finalImageUrl} alt="Generated thumbnail" className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" /></div><button onClick={handleDownload} className="mt-6 inline-flex items-center justify-center gap-2 bg-green-600 text-white font-bold py-3 px-8 rounded-lg shadow-md hover:bg-green-500 transform hover:scale-105"><svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>Download</button></div>) : (<div className="text-center text-gray-500 p-8"><svg xmlns="http://www.w3.org/2000/svg" className="mx-auto h-24 w-24 opacity-20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 3.25a.75.75 0 01.75-.75h14.5a.75.75 0 01.75.75v17.5a.75.75 0 01-.75.75H4.75a.75.75 0 01-.75-.75V3.25z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9 7.75h6m-6 4.5h6m-6 4.5h3" /></svg><p className="mt-6 text-2xl font-serif text-gray-400">Your Masterpiece Awaits</p><p className="mt-2 text-gray-500">Describe your vision and let the AI bring it to life.</p></div>)}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default App;
