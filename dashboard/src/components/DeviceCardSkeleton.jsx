import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Loader2, Shield } from 'lucide-react';

const DeviceCardSkeleton = () => {
    return (
        <Card className="relative overflow-hidden">
            <CardHeader>
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="flex items-center gap-2">
                            <Skeleton className="h-5 w-5 rounded-full" />
                            <Skeleton className="h-6 w-40" />
                        </CardTitle>
                        <div className="flex items-center gap-2 mt-1">
                            <Skeleton className="h-4 w-32" />
                            <Skeleton className="h-5 w-16 rounded-full" />
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <Skeleton className="h-6 w-20 rounded-full" />
                        <Skeleton className="h-9 w-24 rounded-md" />
                    </div>
                </div>
                {/* Buffering Ring / Loading Indicator */}
                <div className="absolute top-4 right-4 text-primary animate-spin">
                    <Loader2 className="h-5 w-5" />
                </div>
            </CardHeader>
            <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[1, 2].map((i) => (
                        <div
                            key={i}
                            className="p-4 rounded-lg border bg-card/50"
                        >
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <Skeleton className="h-5 w-5 rounded-full" />
                                    <div className="space-y-1">
                                        <Skeleton className="h-5 w-24" />
                                        <Skeleton className="h-3 w-16" />
                                    </div>
                                </div>
                                <Skeleton className="h-5 w-20 rounded-full" />
                            </div>

                            <div className="space-y-3">
                                <div className="flex justify-between">
                                    <Skeleton className="h-4 w-20" />
                                    <Skeleton className="h-4 w-32" />
                                </div>
                                <div className="flex justify-between">
                                    <Skeleton className="h-4 w-12" />
                                    <Skeleton className="h-4 w-40" />
                                </div>

                                <div className="space-y-2 pt-2 border-t border-border/50">
                                    {[1, 2, 3, 4].map((j) => (
                                        <div key={j} className="flex justify-between items-center">
                                            <Skeleton className="h-3 w-16" />
                                            <Skeleton className="h-3 w-24" />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="flex gap-2 mt-4">
                                <Skeleton className="h-5 w-16 rounded-full" />
                                <Skeleton className="h-5 w-20 rounded-full" />
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    );
};

export default DeviceCardSkeleton;
