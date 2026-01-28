import React from 'react';
import { Loader2 } from 'lucide-react';

const GlobalLoader = () => {
    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-background/80 backdrop-blur-sm transition-all duration-300">
            <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-16 w-16 animate-spin text-primary" />
                <p className="text-lg font-semibold text-muted-foreground animate-pulse">Loading...</p>
            </div>
        </div>
    );
};

export default GlobalLoader;
