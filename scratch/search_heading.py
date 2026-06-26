import os
import re

project_dir = r"C:\Users\utira\OneDrive\Desktop\My Apps\UROps"

patterns = [
    re.compile(r"HEADING\s*\(OPTIONAL\)", re.IGNORECASE),
    re.compile(r"SERVICE\s*DESCRIPTION\s*&\s*DETAILS", re.IGNORECASE),
    re.compile(r"Item description", re.IGNORECASE),
]

for root, dirs, files in os.walk(os.path.join(project_dir, "src")):
    for file in files:
        if file.endswith(('.tsx', '.ts', '.js', '.jsx')):
            filepath = os.path.join(root, file)
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                matches = []
                for pat in patterns:
                    if pat.search(content):
                        matches.append(pat.pattern)
                
                if matches:
                    print(f"Match found in: {filepath} for {matches}")
                    lines = content.split('\n')
                    for i, line in enumerate(lines):
                        for pat in patterns:
                            if pat.search(line):
                                print(f"  Line {i+1}: {line.strip()}")
            except Exception as e:
                pass
