import sys
import os

# Ensure the backend directory is on the Python path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from hypothesis import settings, HealthCheck

# Configure Hypothesis settings
# "fast" is the default for quick local runs; "ci" for CI; "full" for thorough runs.
settings.register_profile("fast", max_examples=25, suppress_health_check=[HealthCheck.too_slow], deadline=None)
settings.register_profile("ci",   max_examples=50, suppress_health_check=[HealthCheck.too_slow], deadline=None)
settings.register_profile("full", max_examples=200, deadline=None)
settings.load_profile(os.environ.get("HYPOTHESIS_PROFILE", "fast"))
