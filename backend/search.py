with open("main.py", "r", encoding="utf-8") as f:
    for i, line in enumerate(f, 1):
        if "@app" in line or "/requirements" in line:
            print(f"{i}: {line.strip()}")
