import sys
import subprocess
import os

print(f"Current executable: {sys.executable}")
print(f"Current working dir: {os.getcwd()}")

packages = ["pdfplumber", "google-generativeai", "python-docx"]

print(f"Attempting to install: {packages}")

try:
    # Run pip install strictly on THIS interpreter!
    res = subprocess.run(
        [sys.executable, "-m", "pip", "install"] + packages,
        capture_output=True,
        text=True
    )
    print("\n--- STDOUT ---")
    print(res.stdout)
    print("\n--- STDERR ---")
    print(res.stderr)
    print(f"\nExit code: {res.returncode}")
except Exception as e:
    print(f"Subprocess installation failed: {e}")
