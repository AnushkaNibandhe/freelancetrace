import sqlite3
import os

# Find all .db files in the current folder just in case
db_files = [f for f in os.listdir(".") if f.endswith(".db")]
if "freelancetrace.db" in db_files:
    db_name = "freelancetrace.db"
elif "test.db" in db_files:
    db_name = "test.db"
elif db_files:
    db_name = db_files[0]
else:
    db_name = "freelancetrace.db" # Fail over

print(f"Targeting database: {db_name}")

try:
    conn = sqlite3.connect(db_name)
    cursor = conn.cursor()
    cursor.execute("ALTER TABLE requirements ADD COLUMN requirement_type VARCHAR DEFAULT 'FR'")
    conn.commit()
    conn.close()
    print(f"Success: Added requirement_type col to {db_name} table requirements!")
except Exception as e:
    print(f"Update skipped or already exists: {e}")
