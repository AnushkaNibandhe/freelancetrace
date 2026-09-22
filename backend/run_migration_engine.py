from database import engine
from sqlalchemy import text

print(f"Connecting to database: {engine.url}")

try:
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE requirements ADD COLUMN section_name VARCHAR"))
        conn.commit()
    print("Success: Added section_name column to requirements table!")
except Exception as e:
    print(f"Update skipped or already exists: {e}")
