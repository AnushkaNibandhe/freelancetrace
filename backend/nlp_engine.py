import spacy
from sentence_transformers import SentenceTransformer, util

# Load NLP models (in a robust app, this would be managed or cached globally)
# For MVP, we load them on initialization
try:
    nlp = spacy.load("en_core_web_sm")
    print("Loaded spaCy en_core_web_sm")
except OSError:
    print("Warning: spaCy model not found. Run python -m spacy download en_core_web_sm")
    nlp = None

try:
    transformer = SentenceTransformer('all-MiniLM-L6-v2')
    print("Loaded SentenceTransformer all-MiniLM-L6-v2")
except Exception as e:
    print(f"Warning: SentenceTransformer could not be loaded: {e}")
    transformer = None

try:
    from keybert import KeyBERT
    kw_model = KeyBERT(model=transformer if transformer else 'all-MiniLM-L6-v2')
    print("Loaded KeyBERT")
except ImportError:
    print("Warning: KeyBERT not installed. Keyword extraction will be stubbed.")
    kw_model = None

def extract_requirements(text: str):
    """
    Very basic NLP extraction of requirements from text.
    For MVP, we can split by sentence or look for 'shall', 'must' keywords.
    """
    if not nlp:
        fallback_text = text.strip()
        if not fallback_text:
            return []
        return [
            {
                "text": fallback_text,
                "keywords": [],
                "priority": "medium",
            }
        ]
    
    doc = nlp(text)
    reqs = []
    # simplistic approach: sentences with directive words
    for sent in doc.sents:
        if "shall" in sent.text.lower() or "must" in sent.text.lower() or "should" in sent.text.lower() or "require" in sent.text.lower():
            reqs.append(sent.text.strip())
            
    # if none found, just return all sentences as potential reqs
    if not reqs:
        reqs = [sent.text.strip() for sent in doc.sents if len(sent.text.strip()) > 10]

    # Keyword extraction per requirement
    results = []
    for req_text in reqs:
        keywords = []
        if kw_model:
            # extract top 3 keywords
            extracted = kw_model.extract_keywords(req_text, keyphrase_ngram_range=(1, 2), stop_words='english', top_n=3)
            keywords = [k[0] for k in extracted]
        
        # Determine naive priority based on keywords or original text
        priority = "high" if any(w in req_text.lower() for w in ["security", "critical", "must"]) else "medium"
        
        results.append({
            "text": req_text,
            "keywords": keywords,
            "priority": priority
        })
        
    return results

def generate_embedding(text: str) -> list[float]:
    """Generates a float array of embeddings for DB storage."""
    if not transformer:
        return []
    embeddings = transformer.encode(text)
    return embeddings.tolist()

def calculate_similarity(req_text: str, commit_message: str):
    """
    Returns cosine similarity between requirement text and commit message.
    """
    if not transformer:
        return 0.0
        
    embeddings1 = transformer.encode(req_text, convert_to_tensor=True)
    embeddings2 = transformer.encode(commit_message, convert_to_tensor=True)
    cosine_scores = util.cos_sim(embeddings1, embeddings2)
    
    return float(cosine_scores[0][0])
