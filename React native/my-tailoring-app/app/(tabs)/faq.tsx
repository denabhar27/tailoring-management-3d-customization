import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  FlatList,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter , useFocusEffect } from "expo-router";

import { faqService } from "../../utils/apiService";

interface FAQ {
  id: number;
  category: string;
  question: string;
  answer: string;
  tags: string[];
  helpful: number;
  notHelpful: number;
}

interface UserVotes {
  [key: number]: 'helpful' | 'not_helpful';
}

const categories = [
  "All",
  "Account & Profile",
  "Orders & Services",
  "Rental Services",
  "Payments",
  "Technical",
  "Customization",
  "Repair Services",
  "Delivery"
];

const SearchBar = ({ 
  value, 
  onChangeText, 
  placeholder 
}: { 
  value: string; 
  onChangeText: (text: string) => void; 
  placeholder: string;
}) => (
  <View style={styles.searchContainer}>
    <Ionicons name="search-outline" size={20} color="#666" style={styles.searchIcon} />
    <TextInput
      style={styles.searchInput}
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      placeholderTextColor="#999"
    />
    {value.length > 0 && (
      <TouchableOpacity onPress={() => onChangeText("")}>
        <Ionicons name="close-circle" size={20} color="#999" />
      </TouchableOpacity>
    )}
  </View>
);

const CategoryFilter = ({ 
  categories, 
  selectedCategory, 
  onSelectCategory 
}: {
  categories: string[];
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
}) => (
  <ScrollView 
    horizontal 
    showsHorizontalScrollIndicator={false}
    style={styles.categoryContainer}
    contentContainerStyle={styles.categoryContent}
  >
    {categories.map((category) => (
      <TouchableOpacity
        key={category}
        style={[
          styles.categoryChip,
          selectedCategory === category && styles.categoryChipActive
        ]}
        onPress={() => onSelectCategory(category)}
      >
        <Text
          style={[
            styles.categoryChipText,
            selectedCategory === category && styles.categoryChipTextActive
          ]}
        >
          {category}
        </Text>
      </TouchableOpacity>
    ))}
  </ScrollView>
);

const FAQItem = ({ 
  item, 
  isExpanded, 
  onToggle,
  onVote,
  userVote,
  isVoting
}: {
  item: FAQ;
  isExpanded: boolean;
  onToggle: () => void;
  onVote: (isHelpful: boolean) => void;
  userVote: 'helpful' | 'not_helpful' | null;
  isVoting: boolean;
}) => {
  const tags = typeof item.tags === 'string' ? JSON.parse(item.tags) : item.tags || [];
  
  return (
    <View style={styles.faqItem}>
      <TouchableOpacity 
        style={styles.questionRow}
        onPress={onToggle}
        activeOpacity={0.7}
      >
        <View style={styles.questionContent}>
          <Text style={styles.categoryBadge}>{item.category}</Text>
          <Text style={styles.question}>{item.question}</Text>
        </View>
        <Ionicons 
          name={isExpanded ? "chevron-up" : "chevron-down"} 
          size={24} 
          color="#991b1b" 
        />
      </TouchableOpacity>
      
      {isExpanded && (
        <View style={styles.answerContainer}>
          <Text style={styles.answer}>{item.answer}</Text>
          <View style={styles.tagsContainer}>
            {tags.map((tag: string) => (
              <View key={tag} style={styles.tag}>
                <Text style={styles.tagText}>#{tag}</Text>
              </View>
            ))}
          </View>
          <View style={styles.helpfulContainer}>
            <Text style={styles.helpfulLabel}>Was this helpful?</Text>
            <View style={styles.helpfulButtons}>
              <TouchableOpacity 
                style={[
                  styles.helpfulButton,
                  userVote === 'helpful' && styles.helpfulButtonActive
                ]}
                onPress={() => onVote(true)}
                disabled={isVoting}
              >
                <Ionicons 
                  name={userVote === 'helpful' ? "thumbs-up" : "thumbs-up-outline"} 
                  size={18} 
                  color={userVote === 'helpful' ? "#fff" : "#4CAF50"} 
                />
                <Text style={[
                  styles.helpfulButtonText,
                  userVote === 'helpful' && styles.helpfulButtonTextActive
                ]}>{item.helpful}</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[
                  styles.helpfulButton,
                  userVote === 'not_helpful' && styles.notHelpfulButtonActive
                ]}
                onPress={() => onVote(false)}
                disabled={isVoting}
              >
                <Ionicons 
                  name={userVote === 'not_helpful' ? "thumbs-down" : "thumbs-down-outline"} 
                  size={18} 
                  color={userVote === 'not_helpful' ? "#fff" : "#F44336"} 
                />
                <Text style={[
                  styles.helpfulButtonText,
                  userVote === 'not_helpful' && styles.notHelpfulButtonTextActive
                ]}>{item.notHelpful}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

export default function FAQScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [userVotes, setUserVotes] = useState<UserVotes>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  const [votingFaqId, setVotingFaqId] = useState<number | null>(null);

  const fetchFAQs = useCallback(async () => {
    try {
      setLoading(true);
      const result = await faqService.getAllFAQs();
      if (result.success) {
        setFaqs(result.data);
      }
    } catch (error) {
      console.error('Error fetching FAQs:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchUserVotes = useCallback(async () => {
    try {
      const result = await faqService.getUserVotes();
      if (result.success) {
        setUserVotes(result.data);
      }
    } catch (error) {
      console.error('Error fetching user votes:', error);
    }
  }, []);

  useEffect(() => {
    fetchFAQs();
    fetchUserVotes();
  }, []);

  useFocusEffect(
    useCallback(() => {
      fetchFAQs();
      fetchUserVotes();
    }, [])
  );

  const filteredFAQs = faqs.filter((item) => {
    const matchesCategory = selectedCategory === "All" || item.category === selectedCategory;
    const tags = typeof item.tags === 'string' ? JSON.parse(item.tags) : item.tags || [];
    const matchesSearch = !searchQuery.trim() || 
      item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.answer.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tags.some((tag: string) => tag.toLowerCase().includes(searchQuery.toLowerCase()));
    
    return matchesCategory && matchesSearch;
  });

  const toggleItem = (id: number) => {
    setExpandedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const handleVote = async (faqId: number, isHelpful: boolean) => {
    try {
      setVotingFaqId(faqId);
      const result = await faqService.voteFAQ(faqId, isHelpful);
      
      if (result.success) {
        
        setFaqs((prev) =>
          prev.map((faq) =>
            faq.id === faqId
              ? { ...faq, helpful: result.data.helpful, notHelpful: result.data.notHelpful }
              : faq
          )
        );

        if (result.data.userVote) {
          setUserVotes((prev) => ({
            ...prev,
            [faqId]: result.data.userVote
          }));
        } else {
          
          setUserVotes((prev) => {
            const newVotes = { ...prev };
            delete newVotes[faqId];
            return newVotes;
          });
        }
      }
    } catch (error) {
      console.error('Error voting:', error);
      Alert.alert('Error', 'Failed to record your vote. Please try again.');
    } finally {
      setVotingFaqId(null);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity 
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#333" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>FAQ</Text>
        <View style={styles.headerPlaceholder} />
      </View>
      <View style={styles.content}>
        <SearchBar
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search for help..."
        />
        
        <CategoryFilter
          categories={categories}
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
        />

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#991b1b" />
            <Text style={styles.loadingText}>Loading FAQs...</Text>
          </View>
        ) : filteredFAQs.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="search-outline" size={48} color="#ccc" />
            <Text style={styles.emptyText}>No results found</Text>
            <Text style={styles.emptySubtext}>Try different keywords or browse categories</Text>
          </View>
        ) : (
          <FlatList
            data={filteredFAQs}
            renderItem={({ item }) => (
              <FAQItem
                item={item}
                isExpanded={expandedItems.has(item.id)}
                onToggle={() => toggleItem(item.id)}
                onVote={(isHelpful) => handleVote(item.id, isHelpful)}
                userVote={userVotes[item.id] || null}
                isVoting={votingFaqId === item.id}
              />
            )}
            keyExtractor={(item) => item.id.toString()}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.faqList}
          />
        )}
      </View>
      <View style={[styles.bottomNav, { paddingBottom: insets.bottom > 0 ? insets.bottom : 12 }]}>
        <TouchableOpacity onPress={() => router.push("/(tabs)/home")}>
          <View style={styles.navItemWrap}>
            <Ionicons name="home-outline" size={20} color="#9CA3AF" />
          </View>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push("/(tabs)/appointment/appointmentSelection")}>
          <View style={styles.navItemWrap}>
            <Ionicons name="cut-outline" size={20} color="#9CA3AF" />
          </View>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push("/(tabs)/cart/Cart")}>
          <View style={styles.navItemWrap}>
            <Ionicons name="cart-outline" size={20} color="#9CA3AF" />
          </View>
        </TouchableOpacity>

        <TouchableOpacity onPress={() => router.push("/(tabs)/UserProfile/profile")}>
          <View style={styles.navItemWrap}>
            <Ionicons name="person-outline" size={20} color="#9CA3AF" />
          </View>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f5f5f5",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#333",
  },
  headerPlaceholder: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: "#666",
  },

  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: "#333",
  },

  categoryContainer: {
    marginBottom: 16,
    maxHeight: 44,
  },
  categoryContent: {
    paddingRight: 16,
    alignItems: 'center',
  },
  categoryChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#fff",
    marginRight: 8,
    borderWidth: 1,
    borderColor: "#ddd",
    height: 36,
    justifyContent: 'center',
  },
  categoryChipActive: {
    backgroundColor: "#991b1b",
    borderColor: "#991b1b",
  },
  categoryChipText: {
    fontSize: 13,
    color: "#666",
    fontWeight: "500",
  },
  categoryChipTextActive: {
    color: "#fff",
  },

  faqList: {
    paddingBottom: 100,
  },
  faqItem: {
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 12,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  questionRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
  },
  questionContent: {
    flex: 1,
  },
  categoryBadge: {
    fontSize: 12,
    color: "#991b1b",
    fontWeight: "600",
    marginBottom: 4,
  },
  question: {
    fontSize: 16,
    fontWeight: "600",
    color: "#333",
    lineHeight: 22,
  },
  answerContainer: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  answer: {
    fontSize: 14,
    color: "#555",
    lineHeight: 22,
    marginTop: 12,
  },
  tagsContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 12,
    gap: 8,
  },
  tag: {
    backgroundColor: "#f0f0f0",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tagText: {
    fontSize: 12,
    color: "#666",
  },
  helpfulContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  helpfulLabel: {
    fontSize: 14,
    color: "#666",
    marginBottom: 8,
  },
  helpfulButtons: {
    flexDirection: "row",
    gap: 12,
  },
  helpfulButton: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    gap: 6,
  },
  helpfulButtonActive: {
    backgroundColor: "#4CAF50",
  },
  notHelpfulButtonActive: {
    backgroundColor: "#F44336",
  },
  helpfulButtonText: {
    fontSize: 14,
    color: "#333",
    fontWeight: "500",
  },
  helpfulButtonTextActive: {
    color: "#fff",
  },
  notHelpfulButtonTextActive: {
    color: "#fff",
  },

  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: "600",
    color: "#333",
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: "#666",
    marginTop: 8,
  },

  bottomNav: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: "#EEE",
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    elevation: 10,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -3 },
  },
  navItemWrap: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  navItemWrapActive: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "#FDE68A",
    alignItems: "center",
    justifyContent: "center",
  },
});
