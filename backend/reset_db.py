import sys
import os

# Add current directory to path so we can import our modules
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import engine
from models import Base
from sqlalchemy import text

def reset_database():
    print("Connecting to database...")
    try:
        with engine.connect() as conn:
            # For PostgreSQL, we drop the schema and recreate it
            print("Dropping public schema...")
            conn.execute(text("DROP SCHEMA public CASCADE;"))
            conn.execute(text("CREATE SCHEMA public;"))
            conn.execute(text("GRANT ALL ON SCHEMA public TO postgres;"))
            conn.execute(text("GRANT ALL ON SCHEMA public TO public;"))
            conn.commit()
            
        print("Recreating tables...")
        Base.metadata.create_all(bind=engine)
        print("Database reset successfully!")
    except Exception as e:
        print(f"Error during reset: {e}")

if __name__ == "__main__":
    reset_database()
