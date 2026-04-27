import { useRef } from 'react';
import { Newspaper, ChevronLeft, ChevronRight, Check, TrendingUp, TrendingDown } from 'lucide-react';
import { NewsItem, STATIC_NEWS } from '../constants';

interface NewsCarouselProps {
    selectedId: string | null;
    onSelect: (item: NewsItem) => void;
}

export default function NewsCarousel({ selectedId, onSelect }: NewsCarouselProps) {
    const carouselRef = useRef<HTMLDivElement>(null);

    const scroll = (direction: 'left' | 'right') => {
        if (carouselRef.current) {
            const amount = 400;
            carouselRef.current.scrollBy({ left: direction === 'left' ? -amount : amount, behavior: 'smooth' });
        }
    };

    return (
        <div className="relative group/carousel px-2">
            <div className="flex items-center justify-between mb-2">
                <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-2">
                    <Newspaper className="w-3 h-3" />
                    Live News Feed
                </h2>
                <div className="flex gap-1">
                    <button onClick={() => scroll('left')} className="p-1.5 hover:bg-muted rounded-full transition-colors border shadow-sm">
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button onClick={() => scroll('right')} className="p-1.5 hover:bg-muted rounded-full transition-colors border shadow-sm">
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>

            <div
                ref={carouselRef}
                className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide no-scrollbar snap-x snap-mandatory mask-fade-edges min-h-[140px]"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
                {STATIC_NEWS.map((item) => {
                    const isSelected = selectedId === item.id;
                    const sentiment = item.sentiment_score;
                    const isPositive = sentiment > 0.3;
                    const isNegative = sentiment < -0.3;

                    return (
                        <div
                            key={item.id}
                            onClick={() => onSelect(item)}
                            className={`
                                min-w-[320px] max-w-[320px] p-4 rounded-2xl border cursor-pointer transition-all snap-start flex-shrink-0 relative group
                                ${isSelected ? 'bg-purple-50 dark:bg-purple-950/20 border-purple-500 shadow-lg shadow-purple-500/10 ring-2 ring-purple-500/20' : 'bg-card hover:border-muted-foreground/30 border-muted hover:shadow-md'}
                            `}
                        >
                            {isSelected && (
                                <div className="absolute -top-2 -right-2 w-6 h-6 bg-purple-600 rounded-full flex items-center justify-center border-2 border-white dark:border-gray-900 shadow-lg z-10 animate-in zoom-in-0">
                                    <Check className="w-3.5 h-3.5 text-white stroke-[4px]" />
                                </div>
                            )}
                            <div className="flex flex-col h-full justify-between gap-3">
                                <h3 className={`text-sm font-bold leading-tight line-clamp-3 ${isSelected ? 'text-purple-900 dark:text-purple-100' : 'text-foreground'}`}>
                                    {item.headline}
                                </h3>
                                <div className="flex items-center justify-between mt-auto pt-2 border-t border-muted/50">
                                    <div className={`
                                        flex items-center gap-1.5 px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-tight
                                        ${isPositive ? 'bg-green-100 dark:bg-green-900/30 text-green-700' :
                                            isNegative ? 'bg-red-100 dark:bg-red-900/30 text-red-700' :
                                                'bg-blue-100 dark:bg-blue-900/30 text-blue-700'}
                                    `}>
                                        {isPositive ? <TrendingUp className="w-3 h-3" /> : isNegative ? <TrendingDown className="w-3 h-3" /> : null}
                                        Score: {sentiment.toFixed(1)}
                                    </div>
                                    <span className="text-[10px] font-medium text-muted-foreground opacity-60">ID: {item.id}</span>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
            <style jsx>{`
                .no-scrollbar::-webkit-scrollbar {
                    display: none;
                }
                .no-scrollbar {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
                .mask-fade-edges {
                    mask-image: linear-gradient(to right, transparent, black 10%, black 90%, transparent);
                }
            `}</style>
        </div>
    );
}
