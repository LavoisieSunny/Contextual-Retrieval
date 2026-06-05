import sys
from pathlib import Path

# Automatically add backend folder to Python path for all tests
backend_dir = Path(__file__).resolve().parent.parent / "backend"
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))
