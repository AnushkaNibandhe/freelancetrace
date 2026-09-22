"""
Benchmark: SBERT encoding + cosine similarity latency per commit.
Run with: venv\Scripts\python.exe test.py
"""
import sqlite3, json, time, statistics

conn = sqlite3.connect("freelancetrace.db")
rows = conn.execute(
    "SELECT embedding_vector FROM requirements "
    "WHERE embedding_vector IS NOT NULL LIMIT 100"
).fetchall()
conn.close()

if not rows:
    print("No embeddings found. Upload a requirements document first.")
    exit(1)

req_vecs = [json.loads(r[0]) for r in rows]
print(f"Loaded {len(req_vecs)} requirement embeddings.")

print("Loading SBERT model...")
t0 = time.perf_counter()
from sentence_transformers import SentenceTransformer
import numpy as np
model = SentenceTransformer("all-MiniLM-L6-v2")
print(f"Model loaded in {(time.perf_counter()-t0)*1000:.0f} ms (one-time startup)")

commits = [
    "Allow users to mark a task as complete",
    "Add user registration with email and password",
    "Implement due date assignment for tasks",
    "Allow users to filter tasks by priority level",
    "Add reminder notification 24 hours before due date",
    "fix typo in readme",
    "update dependencies",
    "Add drag and drop reordering for tasks within a list",
    "Allow users to share a list with another registered user by email",
    "Implement recurring task creation on daily weekly monthly schedule",
]

req_matrix = np.array(req_vecs, dtype=np.float32)
print(f"\nBenchmarking {len(commits)} commits x {len(req_vecs)} requirements\n" + "-"*60)

timings = []
for msg in commits:
    t = time.perf_counter()
    vec = model.encode(msg, normalize_embeddings=True, show_progress_bar=False)
    sims = req_matrix @ vec
    links = int((sims > 0.40).sum())
    ms = (time.perf_counter() - t) * 1000
    timings.append(ms)
    print(f"  [{ms:5.1f} ms]  {msg[:55]}  -> {links} links  best={sims.max():.3f}")

print("-"*60)
print(f"Min: {min(timings):.1f} ms  Max: {max(timings):.1f} ms  "
      f"Mean: {statistics.mean(timings):.1f} ms  Median: {statistics.median(timings):.1f} ms")
