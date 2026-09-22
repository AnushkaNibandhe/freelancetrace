import sqlite3
import os

db_files = [f for f in os.listdir(".") if f.endswith(".db")]
db_name = db_files[0] if db_files else "freelancetrace.db"

output_path = "schema_status_final.txt"

with open(output_path, "w") as f:
    f.write(f"Checking {db_name} schema:\n")
    try:
        conn = sqlite3.connect(db_name)
        cursor = conn.cursor()
        cursor.execute("PRAGMA table_info(requirements)")
        cols = cursor.fetchall()
        for row in cols:
            f.write(f"{row}\n")
        conn.close()
    except Exception as e:
         f.write(f"Error checking: {e}\n")

print(f"Results written to {output_path}")
