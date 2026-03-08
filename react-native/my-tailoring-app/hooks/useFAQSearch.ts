import { useState, useEffect, useMemo, useCallback } from 'react';

interface FAQItem {
  id: number;
  category: string;
  question: string;
  answer: string;
  tags: string[];
  helpful: number;
  notHelpful: number;
}

interface UseFAQSearchOptions {
  debounceMs?: number;
  minSearchLength?: number;
}

export const useFAQSearch = (
  faqData: FAQItem[],
  options: UseFAQSearchOptions = {}
) => {
  const { debounceMs = 300, minSearchLength = 2 } = options;
  
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isSearching, setIsSearching] = useState(false);

  useEffect(() => {
    setIsSearching(true);
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setIsSearching(false);
    }, debounceMs);

    return () => clearTimeout(timer);
  }, [searchQuery, debounceMs]);

  const calculateRelevance = useCallback((item: FAQItem, query: string): number => {
    const lowerQuery = query.toLowerCase();
    let score = 0;

    if (item.question.toLowerCase() === lowerQuery) {
      score += 100;
    }
    
    else if (item.question.toLowerCase().includes(lowerQuery)) {
      score += 50;
    }

    if (item.tags.some(tag => tag.toLowerCase() === lowerQuery)) {
      score += 40;
    }
    
    else if (item.tags.some(tag => tag.toLowerCase().includes(lowerQuery))) {
      score += 20;
    }

    if (item.answer.toLowerCase().includes(lowerQuery)) {
      score += 10;
    }

    score += Math.min(item.helpful / 10, 5);

    return score;
  }, []);

  const filteredData = useMemo(() => {
    let result = [...faqData];

    if (selectedCategory !== 'All') {
      result = result.filter(item => item.category === selectedCategory);
    }

    if (debouncedQuery.trim().length >= minSearchLength) {
      const lowerQuery = debouncedQuery.toLowerCase().trim();
      
      result = result.filter(item =>
        item.question.toLowerCase().includes(lowerQuery) ||
        item.answer.toLowerCase().includes(lowerQuery) ||
        item.tags.some(tag => tag.toLowerCase().includes(lowerQuery))
      );

      result.sort((a, b) => {
        const scoreA = calculateRelevance(a, debouncedQuery);
        const scoreB = calculateRelevance(b, debouncedQuery);
        return scoreB - scoreA;
      });
    }

    return result;
  }, [faqData, selectedCategory, debouncedQuery, minSearchLength, calculateRelevance]);

  const categories = useMemo(() => {
    const uniqueCategories = [...new Set(faqData.map(item => item.category))];
    return ['All', ...uniqueCategories];
  }, [faqData]);

  const clearSearch = useCallback(() => {
    setSearchQuery('');
    setSelectedCategory('All');
  }, []);

  return {
    searchQuery,
    setSearchQuery,
    filteredData,
    selectedCategory,
    setSelectedCategory,
    categories,
    isSearching,
    resultCount: filteredData.length,
    clearSearch,
    hasResults: filteredData.length > 0,
    isFiltered: searchQuery.length > 0 || selectedCategory !== 'All',
  };
};

interface FAQAnalyticsEvent {
  eventType: 'view' | 'expand' | 'helpful' | 'not_helpful' | 'search';
  faqId?: number;
  searchQuery?: string;
  category?: string;
  timestamp: Date;
}

export const useFAQAnalytics = () => {
  const [events, setEvents] = useState<FAQAnalyticsEvent[]>([]);

  const trackView = useCallback((faqId: number) => {
    const event: FAQAnalyticsEvent = {
      eventType: 'view',
      faqId,
      timestamp: new Date(),
    };
    setEvents(prev => [...prev, event]);
    
    console.log('FAQ Analytics:', event);
  }, []);

  const trackExpand = useCallback((faqId: number) => {
    const event: FAQAnalyticsEvent = {
      eventType: 'expand',
      faqId,
      timestamp: new Date(),
    };
    setEvents(prev => [...prev, event]);
    console.log('FAQ Analytics:', event);
  }, []);

  const trackHelpful = useCallback((faqId: number, isHelpful: boolean) => {
    const event: FAQAnalyticsEvent = {
      eventType: isHelpful ? 'helpful' : 'not_helpful',
      faqId,
      timestamp: new Date(),
    };
    setEvents(prev => [...prev, event]);
    console.log('FAQ Analytics:', event);
  }, []);

  const trackSearch = useCallback((query: string, category: string) => {
    const event: FAQAnalyticsEvent = {
      eventType: 'search',
      searchQuery: query,
      category,
      timestamp: new Date(),
    };
    setEvents(prev => [...prev, event]);
    console.log('FAQ Analytics:', event);
  }, []);

  return {
    trackView,
    trackExpand,
    trackHelpful,
    trackSearch,
    events,
  };
};

export default useFAQSearch;
