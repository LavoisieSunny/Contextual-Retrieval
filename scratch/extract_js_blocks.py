with open('temp_calculator_repo/frontend/app.js', 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

lines = content.splitlines()

def find_context(query, num_lines=45):
    print(f"\n=========================================\nCONTEXT FOR: {query}\n=========================================")
    count = 0
    for idx, line in enumerate(lines):
        if query in line:
            start = max(0, idx - 5)
            end = min(len(lines), idx + num_lines)
            print(f"--- MATCH {count+1} at Line {idx+1} ---")
            for j in range(start, end):
                print(f"{j+1}: {lines[j]}")
            print("\n-----------------------------------------\n")
            count += 1
            if count >= 3:  # limit matches
                break

find_context('/api/calculate')
find_context('/api/search/evaluate')
find_context('/api/chat/pdf')
find_context('/api/ocr/process-ocr')
