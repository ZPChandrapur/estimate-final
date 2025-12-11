"""
Advanced PDF Rate Q&A System with Intelligent Suggestions
Frontend-Ready RAG System with Autocomplete and Exact Matching

Required packages:
pip install pdfplumber sentence-transformers numpy pandas scikit-learn openai fuzzywuzzy python-levenshtein
"""

import os
import re
import json
import hashlib
import requests
import io
import pdfplumber
import numpy as np
import pandas as pd
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, asdict
from datetime import datetime
from collections import defaultdict

# Optional OpenAI
try:
    from openai import OpenAI
    OPENAI_AVAILABLE = True
except ImportError:
    OPENAI_AVAILABLE = False
    print("ℹ️ OpenAI not installed. Using fallback query processing.")

# Embeddings and similarity
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.feature_extraction.text import TfidfVectorizer

# Fuzzy matching
try:
    from fuzzywuzzy import fuzz, process
    FUZZY_AVAILABLE = True
except ImportError:
    FUZZY_AVAILABLE = False
    print("ℹ️ FuzzyWuzzy not installed. Install for better fuzzy matching.")


@dataclass
class RateItem:
    """Enhanced data class for rate items"""
    primary_key: str
    sr_no: Optional[str]
    description: str
    unit: Optional[str]
    rate_2023_24: Optional[str]
    rate_2024_25: Optional[str]
    section: str
    page_number: int
    table_index: int
    raw_text: str
    metadata: Dict[str, Any]
    embedding_text: str
    search_keywords: List[str]  # New: for better searching
    display_text: str  # New: for frontend display
    
    def to_dict(self) -> Dict:
        return asdict(self)
    
    def to_frontend_dict(self) -> Dict:
        """Optimized format for frontend consumption"""
        return {
            "id": self.primary_key,
            "item_no": self.sr_no,
            "description": self.description,
            "unit": self.unit,
            "rate_2024_25": self.rate_2024_25,
            "rate_2023_24": self.rate_2023_24,
            "section": self.section,
            "page": self.page_number,
            "display_text": self.display_text,
            "keywords": self.search_keywords
        }


@dataclass
class SearchSuggestion:
    """Data class for search suggestions"""
    item: RateItem
    relevance_score: float
    match_type: str  # 'exact', 'partial', 'fuzzy', 'semantic'
    matched_keywords: List[str]
    
    def to_dict(self) -> Dict:
        return {
            "item": self.item.to_frontend_dict(),
            "relevance_score": self.relevance_score,
            "match_type": self.match_type,
            "matched_keywords": self.matched_keywords
        }


class EnhancedPDFProcessor:
    """Enhanced PDF processor with advanced extraction and indexing"""
    
    def __init__(self):
        self.items_database = {}  # primary_key -> RateItem
        self.keyword_index = defaultdict(set)  # keyword -> set of primary_keys
        self.section_mapping = {}  # section -> list of primary_keys
        self.item_number_index = {}  # item_number -> primary_key
        self.description_index = {}  # normalized_description -> primary_key
        
    def process_pdf(self, pdf_bytes: bytes) -> Dict[str, RateItem]:
        """Process PDF with enhanced extraction techniques"""
        print("🔍 Enhanced PDF Processing Started...")
        
        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            current_section = "GENERAL"
            
            for page_num, page in enumerate(pdf.pages, 1):
                print(f"  📄 Processing page {page_num}/{len(pdf.pages)}...")
                
                page_text = page.extract_text() or ""
                
                # Enhanced section detection
                detected_section = self._detect_section(page_text)
                if detected_section:
                    current_section = detected_section
                    print(f"    📂 Section: {current_section}")
                
                # Extract tables with enhanced parsing
                tables = page.extract_tables()
                for table_idx, table in enumerate(tables):
                    if self._is_valid_table(table):
                        items = self._extract_items_from_table(
                            table, current_section, page_num, table_idx
                        )
                        for item in items:
                            self.items_database[item.primary_key] = item
                            self._index_item_advanced(item)
                
                # Extract text-based rates
                text_items = self._extract_text_rates(page_text, current_section, page_num)
                for item in text_items:
                    self.items_database[item.primary_key] = item
                    self._index_item_advanced(item)
        
        print(f"✅ Extracted {len(self.items_database)} rate items")
        self._build_advanced_indexes()
        return self.items_database
    
    def _detect_section(self, text: str) -> Optional[str]:
        """Enhanced section detection with more patterns"""
        text_lower = text.lower()
        
        section_patterns = {
            "MATERIALS": r"section\s*[a-z]?\s*[-:]?\s*materials?|^\s*materials?\s*$|material\s+section",
            "LABOUR": r"section\s*[b-z]?\s*[-:]?\s*labou?r|^\s*labou?r\s*(&|and)?\s*machinery|labour\s+section",
            "TRANSPORTATION": r"section\s*[c-z]?\s*[-:]?\s*transport|transport\s+section",
            "CEMENT_CONSUMPTION": r"cement\s*consumption|cement\s+section",
            "EXCAVATION": r"section\s*[e-z]?\s*[-:]?\s*excavation|earth\s*work|excavation\s+section",
            "CONCRETE": r"plain\s*&?\s*reinforced\s*cement|r\.?c\.?c|p\.?c\.?c|concrete\s+section",
            "PIPES": r"pipe\s*sections?|pipe\s+section|c\.?i\.?\s*/?d\.?i\.?\s*pipes?|p\.?v\.?c\.?\s*pipes?",
            "TREATMENT_PLANT": r"treatment\s*plant|wtp|stp|plant\s+section",
            "RESERVOIRS": r"rcc\s*[ge]srs?|reservoirs?|sumps?|reservoir\s+section",
            "CHAMBERS": r"chambers?|manholes?|drainage|chamber\s+section"
        }
        
        for section, pattern in section_patterns.items():
            if re.search(pattern, text_lower, re.MULTILINE):
                return section
        
        return None
    
    def _is_valid_table(self, table: List[List]) -> bool:
        """Enhanced table validation"""
        if not table or len(table) < 2:
            return False
        
        # Check for rate-related headers
        header_text = " ".join([str(cell) for cell in table[0] if cell]).lower()
        rate_indicators = ["rate", "cost", "price", "rs", "description", "item", "unit", "sr", "no"]
        
        return any(indicator in header_text for indicator in rate_indicators)
    
    def _extract_items_from_table(
        self, table: List[List], section: str, page_num: int, table_idx: int
    ) -> List[RateItem]:
        """Enhanced item extraction with better keyword generation"""
        items = []
        headers = self._parse_headers(table[0])
        
        for row_idx, row in enumerate(table[1:]):
            if self._is_data_row(row):
                item = self._create_enhanced_rate_item(
                    row, headers, section, page_num, table_idx, row_idx
                )
                if item:
                    items.append(item)
        
        return items
    
    def _parse_headers(self, header_row: List) -> Dict[int, str]:
        """Enhanced header parsing"""
        mapping = {}
        
        for idx, cell in enumerate(header_row):
            if not cell:
                continue
            
            cell_text = str(cell).lower().strip()
            
            # Comprehensive header mapping
            if re.search(r"sr\.?\s*no|s\.?\s*no|serial|item\s*no", cell_text):
                mapping[idx] = "sr_no"
            elif re.search(r"description|particulars?|items?|works?|material", cell_text):
                mapping[idx] = "description"
            elif re.search(r"units?|uom", cell_text):
                mapping[idx] = "unit"
            elif re.search(r"rate.*2024|2024.*25|rate.*24.*25", cell_text):
                mapping[idx] = "rate_2024_25"
            elif re.search(r"rate.*2023|2023.*24|rate.*23.*24", cell_text):
                mapping[idx] = "rate_2023_24"
            elif re.search(r"rates?|costs?|prices?|amounts?", cell_text):
                mapping[idx] = "rate"
        
        return mapping
    
    def _is_data_row(self, row: List) -> bool:
        """Enhanced data row validation"""
        if not row:
            return False
        
        non_empty = [cell for cell in row if cell and str(cell).strip()]
        return len(non_empty) >= 2
    
    def _create_enhanced_rate_item(
        self, row: List, headers: Dict[int, str], 
        section: str, page_num: int, table_idx: int, row_idx: int
    ) -> Optional[RateItem]:
        """Create enhanced RateItem with advanced keyword generation"""
        data = {}
        
        for idx, cell in enumerate(row):
            if idx in headers and cell:
                field = headers[idx]
                value = str(cell).strip()
                
                if "rate" in field:
                    value = self._clean_rate(value)
                
                data[field] = value
        
        if "description" not in data:
            return None
        
        # Generate unique primary key
        key_components = [
            section,
            str(page_num),
            str(table_idx),
            str(row_idx),
            data.get("sr_no", ""),
            data["description"][:30]
        ]
        primary_key = hashlib.md5("_".join(key_components).encode()).hexdigest()
        
        # Generate comprehensive search keywords
        search_keywords = self._generate_comprehensive_keywords(data, section)
        
        # Create enhanced embedding text
        embedding_text = self._create_enhanced_embedding_text(data, section, search_keywords)
        
        # Create display text for frontend
        display_text = self._create_display_text(data)
        
        # Create raw text
        raw_text = " | ".join([f"{k}: {v}" for k, v in data.items()])
        
        return RateItem(
            primary_key=primary_key,
            sr_no=data.get("sr_no"),
            description=data["description"],
            unit=data.get("unit"),
            rate_2023_24=data.get("rate_2023_24"),
            rate_2024_25=data.get("rate_2024_25") or data.get("rate"),
            section=section,
            page_number=page_num,
            table_index=table_idx,
            raw_text=raw_text,
            metadata={
                "row_index": row_idx,
                "extracted_at": datetime.now().isoformat()
            },
            embedding_text=embedding_text,
            search_keywords=search_keywords,
            display_text=display_text
        )
    
    def _generate_comprehensive_keywords(self, data: Dict, section: str) -> List[str]:
        """Generate comprehensive keywords for advanced searching"""
        keywords = set()
        
        # Add section keywords
        keywords.add(section.lower())
        
        # Add item number variations
        if "sr_no" in data:
            sr_no = str(data["sr_no"])
            keywords.update([
                sr_no,
                f"item {sr_no}",
                f"item no {sr_no}",
                f"sr no {sr_no}",
                f"serial {sr_no}",
                f"{sr_no}."
            ])
        
        # Process description for keywords
        if "description" in data:
            desc = data["description"].lower()
            
            # Add full description
            keywords.add(desc)
            
            # Add individual words (>2 chars)
            words = re.findall(r'\b\w{3,}\b', desc)
            keywords.update(words)
            
            # Add material-specific keywords and synonyms
            material_synonyms = {
                "cement": ["opc", "ppc", "portland", "binding", "cement bag"],
                "steel": ["ms", "tor", "tmt", "rebar", "reinforcement", "iron"],
                "aggregate": ["stone", "gravel", "chips", "coarse aggregate"],
                "sand": ["fine aggregate", "river sand", "mortar sand"],
                "plaster": ["plastering", "rendering", "finishing"],
                "pipe": ["pipeline", "piping", "conduit", "tube"],
                "labour": ["labor", "worker", "manpower", "workforce"],
                "acetylene": ["gas", "welding gas", "gas cylinder"],
                "paint": ["painting", "coating", "enamel"],
                "brick": ["bricks", "masonry", "block"],
                "wire": ["wiring", "electrical", "conductor"]
            }
            
            for material, synonyms in material_synonyms.items():
                if material in desc:
                    keywords.update(synonyms)
                    keywords.add(material)
        
        # Add unit keywords
        if "unit" in data:
            unit = data["unit"].lower()
            keywords.add(unit)
            keywords.add(f"per {unit}")
            
            # Unit synonyms
            unit_synonyms = {
                "no": ["number", "piece", "nos", "each"],
                "mt": ["metric ton", "tonne", "ton"],
                "kg": ["kilogram", "kilo"],
                "lit": ["liter", "litre"],
                "cum": ["cubic meter", "m3"],
                "sqm": ["square meter", "m2"],
                "rmt": ["running meter", "linear meter"]
            }
            
            if unit in unit_synonyms:
                keywords.update(unit_synonyms[unit])
        
        return list(keywords)
    
    def _create_enhanced_embedding_text(self, data: Dict, section: str, keywords: List[str]) -> str:
        """Create rich embedding text for semantic search"""
        parts = []
        
        parts.append(f"Section: {section}")
        
        if "sr_no" in data:
            parts.append(f"Item {data['sr_no']}")
        
        if "description" in data:
            parts.append(data["description"])
        
        if "unit" in data:
            parts.append(f"Unit: {data['unit']}")
        
        # Add rate information
        if "rate_2024_25" in data:
            parts.append(f"2024-25 rate {data['rate_2024_25']}")
        if "rate_2023_24" in data:
            parts.append(f"2023-24 rate {data['rate_2023_24']}")
        
        # Add selected keywords for context
        parts.extend(keywords[:10])  # Limit to avoid too long text
        
        return " | ".join(parts)
    
    def _create_display_text(self, data: Dict) -> str:
        """Create display text for frontend"""
        parts = []
        
        if "sr_no" in data:
            parts.append(f"#{data['sr_no']}")
        
        parts.append(data["description"])
        
        if "unit" in data:
            parts.append(f"({data['unit']})")
        
        if "rate_2024_25" in data:
            parts.append(f"- Rs. {data['rate_2024_25']}")
        
        return " ".join(parts)
    
    def _clean_rate(self, rate_str: str) -> str:
        """Clean and standardize rate values"""
        if not rate_str:
            return ""
        
        cleaned = re.sub(r'[Rr][Ss]\.?\s*', '', rate_str)
        cleaned = re.sub(r'[₹$]', '', cleaned)
        cleaned = cleaned.replace(',', '').strip()
        
        match = re.search(r'[\d.]+', cleaned)
        return match.group() if match else ""
    
    def _extract_text_rates(self, text: str, section: str, page_num: int) -> List[RateItem]:
        """Extract rates from non-tabular text"""
        items = []
        
        patterns = [
            r"(\d+)\s*[.)\]]\s*([^0-9\n]+?)\s+([A-Za-z]+)\s+(\d+)",
            r"Item\s*(\d+)[:\s]+([^0-9\n]+?)\s+([A-Za-z]+)\s+(\d+)",
        ]
        
        for pattern in patterns:
            matches = re.finditer(pattern, text)
            for match in matches:
                sr_no = match.group(1)
                description = match.group(2).strip()
                unit = match.group(3)
                rate = match.group(4)
                
                key_components = [section, str(page_num), sr_no, description[:20]]
                primary_key = hashlib.md5("_".join(key_components).encode()).hexdigest()
                
                search_keywords = self._generate_comprehensive_keywords({
                    "sr_no": sr_no,
                    "description": description,
                    "unit": unit
                }, section)
                
                item = RateItem(
                    primary_key=primary_key,
                    sr_no=sr_no,
                    description=description,
                    unit=unit,
                    rate_2023_24=None,
                    rate_2024_25=rate,
                    section=section,
                    page_number=page_num,
                    table_index=-1,
                    raw_text=f"{sr_no}. {description} {unit} {rate}",
                    metadata={"source": "text_extraction"},
                    embedding_text=f"Item {sr_no} {description} {unit} rate {rate}",
                    search_keywords=search_keywords,
                    display_text=f"#{sr_no} {description} ({unit}) - Rs. {rate}"
                )
                items.append(item)
        
        return items
    
    def _index_item_advanced(self, item: RateItem):
        """Advanced indexing for fast retrieval"""
        # Index by section
        if item.section not in self.section_mapping:
            self.section_mapping[item.section] = []
        self.section_mapping[item.section].append(item.primary_key)
        
        # Index by item number
        if item.sr_no:
            self.item_number_index[item.sr_no] = item.primary_key
        
        # Index by normalized description
        normalized_desc = item.description.lower().strip()
        self.description_index[normalized_desc] = item.primary_key
        
        # Index by all keywords
        for keyword in item.search_keywords:
            self.keyword_index[keyword.lower()].add(item.primary_key)
    
    def _build_advanced_indexes(self):
        """Build additional indexes after processing"""
        print("🔧 Building advanced search indexes...")
        
        # Build n-gram indexes for partial matching
        self.ngram_index = defaultdict(set)
        
        for item in self.items_database.values():
            text = (item.description + " " + " ".join(item.search_keywords)).lower()
            
            # Generate 2-grams and 3-grams
            words = text.split()
            for i in range(len(words)):
                for j in range(i+1, min(i+4, len(words)+1)):
                    ngram = " ".join(words[i:j])
                    if len(ngram) >= 3:  # Minimum 3 characters
                        self.ngram_index[ngram].add(item.primary_key)
        
        print(f"✅ Built indexes with {len(self.keyword_index)} keywords and {len(self.ngram_index)} n-grams")


class IntelligentSearchEngine:
    """Intelligent search engine with suggestions and exact matching"""
    
    def __init__(self, items_database: Dict[str, RateItem], processor: EnhancedPDFProcessor):
        self.items_database = items_database
        self.processor = processor
        print("🔄 Initializing intelligent search engine...")
        
        # Initialize semantic search model
        self.model = SentenceTransformer('all-MiniLM-L6-v2')
        self.embeddings_cache = {}
        
        # Initialize TF-IDF for text matching
        self.tfidf_vectorizer = TfidfVectorizer(max_features=1000, ngram_range=(1, 3))
        
        self._compute_embeddings()
    
    def _compute_embeddings(self):
        """Compute embeddings for semantic search"""
        print("  Computing embeddings...")
        
        texts = []
        keys = []
        
        for key, item in self.items_database.items():
            texts.append(item.embedding_text)
            keys.append(key)
        
        if texts:
            embeddings = self.model.encode(texts, show_progress_bar=True)
            
            for key, embedding in zip(keys, embeddings):
                self.embeddings_cache[key] = embedding
            
            # Fit TF-IDF
            self.tfidf_vectorizer.fit(texts)
            
            print(f"  ✅ Computed {len(self.embeddings_cache)} embeddings")
    
    def get_suggestions(self, query: str, max_suggestions: int = 10) -> List[SearchSuggestion]:
        """Get intelligent suggestions for a query"""
        query = query.strip().lower()
        
        if len(query) < 2:
            return []
        
        suggestions = []
        
        # 1. Exact item number match
        exact_item_suggestions = self._get_exact_item_matches(query)
        suggestions.extend(exact_item_suggestions)
        
        # 2. Keyword exact matches
        keyword_suggestions = self._get_keyword_matches(query)
        suggestions.extend(keyword_suggestions)
        
        # 3. Fuzzy matches
        if FUZZY_AVAILABLE:
            fuzzy_suggestions = self._get_fuzzy_matches(query)
            suggestions.extend(fuzzy_suggestions)
        
        # 4. N-gram partial matches
        ngram_suggestions = self._get_ngram_matches(query)
        suggestions.extend(ngram_suggestions)
        
        # 5. Semantic matches
        semantic_suggestions = self._get_semantic_matches(query)
        suggestions.extend(semantic_suggestions)
        
        # Remove duplicates and sort by relevance
        unique_suggestions = self._deduplicate_suggestions(suggestions)
        sorted_suggestions = sorted(unique_suggestions, key=lambda x: x.relevance_score, reverse=True)
        
        return sorted_suggestions[:max_suggestions]
    
    def _get_exact_item_matches(self, query: str) -> List[SearchSuggestion]:
        """Get exact item number matches"""
        suggestions = []
        
        # Try to extract item number from query
        item_patterns = [
            r'(?:item\s*)?(?:no\s*)?(?:sr\s*)?(?:serial\s*)?(\d+)',
            r'^(\d+)$',
            r'(\d+)\.',
        ]
        
        for pattern in item_patterns:
            match = re.search(pattern, query)
            if match:
                item_no = match.group(1)
                if item_no in self.processor.item_number_index:
                    primary_key = self.processor.item_number_index[item_no]
                    item = self.items_database[primary_key]
                    
                    suggestion = SearchSuggestion(
                        item=item,
                        relevance_score=1.0,
                        match_type="exact_item",
                        matched_keywords=[f"item {item_no}"]
                    )
                    suggestions.append(suggestion)
        
        return suggestions
    
    def _get_keyword_matches(self, query: str) -> List[SearchSuggestion]:
        """Get keyword-based matches"""
        suggestions = []
        query_words = query.split()
        
        # Find items that match keywords
        matching_items = set()
        matched_keywords = []
        
        for word in query_words:
            if word in self.processor.keyword_index:
                matching_items.update(self.processor.keyword_index[word])
                matched_keywords.append(word)
        
        # Score based on number of matched keywords
        for primary_key in matching_items:
            item = self.items_database[primary_key]
            
            # Calculate relevance based on keyword overlap
            item_keywords = set(kw.lower() for kw in item.search_keywords)
            query_keywords = set(query_words)
            
            overlap = len(item_keywords.intersection(query_keywords))
            total_query_words = len(query_keywords)
            
            if total_query_words > 0:
                relevance_score = min(overlap / total_query_words, 1.0)
                
                if relevance_score > 0.3:  # Minimum threshold
                    suggestion = SearchSuggestion(
                        item=item,
                        relevance_score=relevance_score,
                        match_type="keyword",
                        matched_keywords=matched_keywords
                    )
                    suggestions.append(suggestion)
        
        return suggestions
    
    def _get_fuzzy_matches(self, query: str) -> List[SearchSuggestion]:
        """Get fuzzy string matches"""
        suggestions = []
        
        if not FUZZY_AVAILABLE:
            return suggestions
        
        # Get all descriptions for fuzzy matching
        descriptions = []
        for item in self.items_database.values():
            descriptions.append((item.description.lower(), item.primary_key))
        
        # Fuzzy match against descriptions
        fuzzy_matches = process.extract(query, [desc[0] for desc in descriptions], limit=5)
        
        for match_text, score in fuzzy_matches:
            if score > 60:  # Minimum fuzzy score threshold
                # Find the item with this description
                for desc, primary_key in descriptions:
                    if desc == match_text:
                        item = self.items_database[primary_key]
                        
                        suggestion = SearchSuggestion(
                            item=item,
                            relevance_score=score / 100.0,
                            match_type="fuzzy",
                            matched_keywords=[query]
                        )
                        suggestions.append(suggestion)
                        break
        
        return suggestions
    
    def _get_ngram_matches(self, query: str) -> List[SearchSuggestion]:
        """Get n-gram partial matches"""
        suggestions = []
        
        # Find items with n-gram matches
        matching_items = set()
        
        for ngram, item_keys in self.processor.ngram_index.items():
            if query in ngram or ngram in query:
                matching_items.update(item_keys)
        
        # Score based on n-gram overlap
        for primary_key in matching_items:
            item = self.items_database[primary_key]
            
            # Calculate relevance based on text similarity
            item_text = item.description.lower()
            
            # Simple containment scoring
            if query in item_text:
                relevance_score = 0.8
            elif any(word in item_text for word in query.split()):
                relevance_score = 0.6
            else:
                relevance_score = 0.4
            
            suggestion = SearchSuggestion(
                item=item,
                relevance_score=relevance_score,
                match_type="partial",
                matched_keywords=[query]
            )
            suggestions.append(suggestion)
        
        return suggestions
    
    def _get_semantic_matches(self, query: str) -> List[SearchSuggestion]:
        """Get semantic similarity matches"""
        suggestions = []
        
        try:
            query_embedding = self.model.encode(query)
            
            # Calculate semantic similarity with all items
            for primary_key, item_embedding in self.embeddings_cache.items():
                similarity = float(cosine_similarity([query_embedding], [item_embedding])[0][0])
                
                if similarity > 0.5:  # Minimum semantic similarity threshold
                    item = self.items_database[primary_key]
                    
                    suggestion = SearchSuggestion(
                        item=item,
                        relevance_score=similarity,
                        match_type="semantic",
                        matched_keywords=[query]
                    )
                    suggestions.append(suggestion)
        
        except Exception as e:
            print(f"Semantic search error: {e}")
        
        return suggestions
    
    def _deduplicate_suggestions(self, suggestions: List[SearchSuggestion]) -> List[SearchSuggestion]:
        """Remove duplicate suggestions, keeping the highest scored one"""
        seen_items = {}
        
        for suggestion in suggestions:
            primary_key = suggestion.item.primary_key
            
            if primary_key not in seen_items or suggestion.relevance_score > seen_items[primary_key].relevance_score:
                seen_items[primary_key] = suggestion
        
        return list(seen_items.values())
    
    def get_exact_item(self, primary_key: str) -> Optional[RateItem]:
        """Get exact item by primary key"""
        return self.items_database.get(primary_key)
    
    def search_by_filters(self, section: str = None, item_no: str = None, 
                         material_type: str = None) -> List[RateItem]:
        """Search by specific filters"""
        results = []
        
        for item in self.items_database.values():
            match = True
            
            if section and item.section.lower() != section.lower():
                match = False
            
            if item_no and item.sr_no != item_no:
                match = False
            
            if material_type and material_type.lower() not in item.description.lower():
                match = False
            
            if match:
                results.append(item)
        
        return results


class FrontendReadyRAGSystem:
    """Frontend-ready RAG system with API-like interface"""
    
    def __init__(self, pdf_url: str):
        self.pdf_url = pdf_url
        self.processor = EnhancedPDFProcessor()
        self.search_engine = None
        self.items_database = {}
        self.is_initialized = False
    
    def initialize(self) -> Dict[str, Any]:
        """Initialize the system and return status"""
        try:
            print("\n" + "="*60)
            print("🚀 FRONTEND-READY RAG SYSTEM")
            print("="*60)
            
            # Download PDF
            print("\n📥 Downloading PDF...")
            response = requests.get(self.pdf_url)
            response.raise_for_status()
            pdf_bytes = response.content
            print(f"✅ Downloaded {len(pdf_bytes):,} bytes")
            
            # Process PDF
            print("\n📊 Processing PDF...")
            self.items_database = self.processor.process_pdf(pdf_bytes)
            
            # Initialize search engine
            print("\n🔍 Initializing search engine...")
            self.search_engine = IntelligentSearchEngine(self.items_database, self.processor)
            
            self.is_initialized = True
            
            # Return initialization summary
            summary = self._get_system_summary()
            print("\n✅ System initialized successfully!")
            
            return {
                "status": "success",
                "message": "System initialized successfully",
                "summary": summary
            }
        
        except Exception as e:
            print(f"❌ Initialization failed: {e}")
            return {
                "status": "error",
                "message": f"Initialization failed: {str(e)}",
                "summary": None
            }
    
    def _get_system_summary(self) -> Dict[str, Any]:
        """Get system summary for frontend"""
        section_counts = {}
        for item in self.items_database.values():
            section_counts[item.section] = section_counts.get(item.section, 0) + 1
        
        sample_items = []
        for item in list(self.items_database.values())[:5]:
            sample_items.append({
                "description": item.description[:50] + "...",
                "item_no": item.sr_no,
                "section": item.section,
                "rate": item.rate_2024_25 or item.rate_2023_24
            })
        
        return {
            "total_items": len(self.items_database),
            "sections": section_counts,
            "sample_items": sample_items
        }
    
    def get_suggestions(self, query: str, max_results: int = 10) -> Dict[str, Any]:
        """API endpoint for getting suggestions"""
        if not self.is_initialized:
            return {
                "status": "error",
                "message": "System not initialized",
                "suggestions": []
            }
        
        try:
            suggestions = self.search_engine.get_suggestions(query, max_results)
            
            return {
                "status": "success",
                "query": query,
                "total_found": len(suggestions),
                "suggestions": [s.to_dict() for s in suggestions]
            }
        
        except Exception as e:
            return {
                "status": "error",
                "message": f"Search failed: {str(e)}",
                "suggestions": []
            }
    
    def get_item_details(self, primary_key: str) -> Dict[str, Any]:
        """API endpoint for getting exact item details"""
        if not self.is_initialized:
            return {
                "status": "error",
                "message": "System not initialized",
                "item": None
            }
        
        item = self.search_engine.get_exact_item(primary_key)
        
        if item:
            return {
                "status": "success",
                "item": item.to_frontend_dict()
            }
        else:
            return {
                "status": "error",
                "message": "Item not found",
                "item": None
            }
    
    def search_with_filters(self, section: str = None, item_no: str = None, 
                           material_type: str = None) -> Dict[str, Any]:
        """API endpoint for filtered search"""
        if not self.is_initialized:
            return {
                "status": "error",
                "message": "System not initialized",
                "results": []
            }
        
        try:
            results = self.search_engine.search_by_filters(section, item_no, material_type)
            
            return {
                "status": "success",
                "filters": {
                    "section": section,
                    "item_no": item_no,
                    "material_type": material_type
                },
                "total_found": len(results),
                "results": [item.to_frontend_dict() for item in results]
            }
        
        except Exception as e:
            return {
                "status": "error",
                "message": f"Filtered search failed: {str(e)}",
                "results": []
            }
    
    def get_all_sections(self) -> Dict[str, Any]:
        """API endpoint for getting all sections"""
        if not self.is_initialized:
            return {
                "status": "error",
                "message": "System not initialized",
                "sections": []
            }
        
        return {
            "status": "success",
            "sections": list(self.processor.section_mapping.keys())
        }
    
    def run_demo(self):
        """Run a demo session to test the system"""
        # Initialize system
        init_result = self.initialize()
        
        if init_result["status"] != "success":
            print("Failed to initialize system")
            return
        
        print("\n" + "="*60)
        print("🎯 DEMO SESSION")
        print("="*60)
        
        # Demo queries
        demo_queries = [
            "acetylene",
            "cement",
            "item 1",
            "labour",
            "carpenter",
            "steel",
            "transport"
        ]
        
        print("\n🔍 Testing suggestion system:")
        for query in demo_queries:
            print(f"\n📝 Query: '{query}'")
            suggestions = self.get_suggestions(query, 3)
            
            if suggestions["status"] == "success" and suggestions["suggestions"]:
                for i, suggestion in enumerate(suggestions["suggestions"], 1):
                    item = suggestion["item"]
                    score = suggestion["relevance_score"]
                    match_type = suggestion["match_type"]
                    
                    print(f"  {i}. {item['display_text']}")
                    print(f"     Section: {item['section']} | Score: {score:.2f} | Type: {match_type}")
            else:
                print("     No suggestions found")
        
        print("\n🎯 Demo completed successfully!")


# ==== MAIN EXECUTION ====
if __name__ == "__main__":
    # Your PDF URL (replace with actual URL)
    PDF_URL = "https://tvmqkondihsomlebizjj.supabase.co/storage/v1/object/sign/estimate-forms/MJP%20SSR%202023-24_Final.pdf?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV85OGM0N2MwMC1hZDQ5LTQ1NDYtOWViNS05NjVhMWJlZGNjNWQiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJlc3RpbWF0ZS1mb3Jtcy9NSlAgU1NSIDIwMjMtMjRfRmluYWwucGRmIiwiaWF0IjoxNzU0NTU3MTg1LCJleHAiOjE3NTUxNjE5ODV9.fs6AV85ideRnsi_ZMBHfdDJ1Ajtdbr4H40hM54dOiWc"

    # Create and run the system
    rag_system = FrontendReadyRAGSystem(pdf_url=PDF_URL)
    
    # Run demo
    rag_system.run_demo()
    
    # Example of how frontend would interact with the system:
    """
    # 1. Initialize system
    init_result = rag_system.initialize()
    
    # 2. Get suggestions as user types
    suggestions = rag_system.get_suggestions("acety")  # User typing "acetylene"
    
    # 3. User selects a suggestion
    if suggestions["suggestions"]:
        selected_item_id = suggestions["suggestions"][0]["item"]["id"]
        item_details = rag_system.get_item_details(selected_item_id)
    
    # 4. Filter-based search
    filtered_results = rag_system.search_with_filters(section="MATERIALS", material_type="cement")
    
    # 5. Get all available sections for dropdowns
    sections = rag_system.get_all_sections()
    """