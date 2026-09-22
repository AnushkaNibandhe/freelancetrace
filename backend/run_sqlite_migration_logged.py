import sqlite3
import os

dir_path = os.path.dirname(os.path.abspath(__file__))
db_path = os.path.join(dir_path, "freelancetrace.db")
log_path = os.path.join(dir_path, "migration_status.txt")

with open(log_path, "w") as f:
    f.write(f"Checking database file: {db_path}\n")
    try:
        conn = sqlite3.connect(db_path, timeout=10) # 10s is plenty to fail explicitly
        cursor = conn.cursor()
        try:
            cursor.execute("ALTER TABLE requirements ADD COLUMN section_name VARCHAR")
            conn.commit()
            f.write("Success: Added section_name column using direct sqlite3!\n")
        except Exception as e:
            f.write(f"Inner Exception (Already applied or locked): {e}\n")
        conn.close()
    except Exception as e:
         f.write(f"Outer Exception: {e}\n")

print("Logs written to migration_status.txt")
