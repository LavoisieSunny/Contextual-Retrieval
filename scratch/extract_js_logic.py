import re

with open('temp_calculator_repo/frontend/app.js', 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

# Let's search for functions making API calls
# 1. calculate
print("=== CALCULATION API CALLS ===")
calc_matches = [line for line in content.splitlines() if '/api/calculate' in line]
for line in calc_matches:
    print(line)

print("\n=== EVALUATE API CALLS ===")
eval_matches = [line for line in content.splitlines() if '/api/search/evaluate' in line]
for line in eval_matches:
    print(line)

print("\n=== CHAT API CALLS ===")
chat_matches = [line for line in content.splitlines() if '/api/chat/pdf' in line or '/api/search/chat' in line]
for line in chat_matches:
    print(line)

print("\n=== OCR API CALLS ===")
ocr_matches = [line for line in content.splitlines() if '/api/ocr' in line]
for line in ocr_matches:
    print(line)

print("\n=== QDRANT API CALLS ===")
qd_matches = [line for line in content.splitlines() if '/api/qdrant' in line]
for line in qd_matches:
    print(line)
