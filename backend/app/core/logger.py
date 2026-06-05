import logging
import sys

# Standard log format
LOG_FORMAT = "%(asctime)s - %(name)s - %(levelname)s - %(message)s"

def setup_logger(name: str = "app") -> logging.Logger:
    """Sets up a logger with a stdout stream handler and standard format."""
    logger = logging.getLogger(name)
    
    # If logger already has handlers, avoid adding duplicate ones
    if not logger.handlers:
        logger.setLevel(logging.INFO)
        
        handler = logging.StreamHandler(sys.stdout)
        handler.setLevel(logging.INFO)
        
        formatter = logging.Formatter(LOG_FORMAT)
        handler.setFormatter(formatter)
        
        logger.addHandler(handler)
        logger.propagate = False
        
    return logger

# App-wide root logger instance
logger = setup_logger()
