import React, { useState, useEffect } from 'react';

const loadingMessages = [
    "Crafting your vision...",
    "Polishing the details...",
    "Gathering inspiration...",
    "The creative process is in motion...",
    "Composing your masterpiece...",
    "Finalizing the artwork..."
];

const ClassicLoader: React.FC = () => {
    return (
        <div className="w-16 h-16">
            <div className="w-full h-full border-4 border-amber-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
    );
};


const Loader: React.FC = () => {
    const [messageIndex, setMessageIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setMessageIndex((prevIndex) => (prevIndex + 1) % loadingMessages.length);
        }, 2500);

        return () => clearInterval(interval);
    }, []);

    return (
        <div className="flex flex-col items-center justify-center space-y-6 text-center">
            <ClassicLoader />
            <p className="text-lg text-gray-300 font-semibold tracking-wider">Bhagat is thinking...</p>
            <p className="text-sm text-gray-400 h-5">
                {loadingMessages[messageIndex]}
            </p>
        </div>
    );
};

export default Loader;
