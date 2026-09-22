import sqlite3
import json

conn = sqlite3.connect("freelancetrace.db")
users = conn.execute("SELECT id, email, role, github_access_token FROM users").fetchall()
print(json.dumps(users, indent=2))
conn.close()
