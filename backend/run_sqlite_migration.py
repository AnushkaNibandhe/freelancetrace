import sqlite3
import os

db_path = "freelancetrace.db"
print(f"Checking for database file from: {os.path.abspath(db_path)}")

try:
    # Adding timeout parameter so it throws locked instead of hanging!
    conn = sqlite3.connect(db_path, timeout=1) 
    cursor = conn.cursor()
    try:
        cursor.execute("ALTER TABLE requirements ADD COLUMN section_name VARCHAR")
        conn.commit()
        print("Success: Added section_name column using direct sqlite3 connection!")
    except Exception as e:
        print(f"Update skipped or already applied inside sqlite3: {e}")
    conn.close()
except Exception as e:
    print(f"Critical Error connecting direct sqlite3: {e}")
