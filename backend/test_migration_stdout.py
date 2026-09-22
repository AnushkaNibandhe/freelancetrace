import sqlite3
import os

db_files = [f for f in os.listdir(".") if f.endswith(".db")]
db_name = db_files[0] if db_files else "freelancetrace.db"

print(f"Checking {db_name} schema:")
try:
    conn = sqlite3.connect(db_name)
    cursor = conn.cursor()
    cursor.execute("PRAGMA table_info(requirements)")
    cols = cursor.fetchall()
    for row in cols:
         print(f"COLUMN: {row[1]} ({row[2]})")
    conn.close()
except Exception as e:
     print(f"Error checking: {e}")
