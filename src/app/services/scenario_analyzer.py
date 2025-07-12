import re
from typing import Dict, List


class ScenarioAnalyzer:
    """Analyzes queries to extract keywords, domain, and context"""
    
    def __init__(self):
        self.domain_keywords = {
            "process_performance": ["performance", "efficiency", "output", "yield"],
            "operations": ["operations", "parameters", "critical", "operating"],
            "troubleshooting": ["investigate", "root cause", "problem", "issue", "fluctuation"],
            "performance_comparison": ["compare", "comparison", "across", "between"],
            "maintenance": ["maintenance", "repair", "failure", "breakdown"]
        }
        
        self.time_patterns = {
            "today": r"\btoday\b",
            "yesterday": r"\byesterday\b",
            "this_week": r"\bthis week\b",
            "last_week": r"\blast week\b",
            "this_month": r"\bthis month\b",
            "last_month": r"\blast month\b",
            "last_two_weeks": r"\blast two weeks\b",
        }
    
    def analyze(self, query: str) -> Dict:
        """Analyze a query and return structured information"""
        query_lower = query.lower()
        
        result = {
            "keywords": self._extract_keywords(query_lower),
            "domain": self._identify_domain(query_lower),
            "analysis_type": self._identify_analysis_type(query_lower),
            "assets": self._extract_assets(query),
            "time_period": self._extract_time_period(query_lower)
        }
        
        return result
    
    def _extract_keywords(self, query: str) -> List[str]:
        """Extract relevant keywords from query"""
        keywords = self._extract_process_keywords(query)
        keywords.extend(self._extract_asset_identifiers(query))
        return keywords
    
    def _extract_process_keywords(self, query: str) -> List[str]:
        """Extract process-related keywords"""
        process_keywords = [
            "distillation", "tank", "reactor", "pump", "column",
            "pressure", "temperature", "flow", "level", "efficiency",
            "production", "cooling", "heating", "process"
        ]
        return [kw for kw in process_keywords if kw in query]
    
    def _extract_asset_identifiers(self, query: str) -> List[str]:
        """Extract asset identifiers from query"""
        asset_pattern = r'\b[A-Z]{2,}-\d{3,}\b'
        return re.findall(asset_pattern, query.upper())
    
    def _identify_domain(self, query: str) -> str:
        """Identify the domain of the query"""
        # Check for performance comparison first (more specific)
        if any(keyword in query for keyword in self.domain_keywords["performance_comparison"]):
            return "performance_comparison"
        
        # Then check other domains
        for domain, keywords in self.domain_keywords.items():
            if domain == "performance_comparison":
                continue
            if any(keyword in query for keyword in keywords):
                return domain
        
        # Default domain based on query content
        if "tank" in query:
            return "operations"
        elif any(word in query for word in ["analyze", "analysis"]):
            return "process_performance"
        
        return "general"
    
    def _identify_analysis_type(self, query: str) -> str:
        """Identify the type of analysis requested"""
        if "root cause" in query:
            return "root_cause"
        elif "compare" in query or "comparison" in query:
            return "comparison"
        elif "trend" in query:
            return "trend_analysis"
        elif "optimize" in query or "optimal" in query:
            return "optimization"
        
        return "general_analysis"
    
    def _extract_assets(self, query: str) -> List[str]:
        """Extract asset identifiers from query"""
        # Pattern for common asset naming conventions
        asset_pattern = r'\b([A-Z]{1,3}-\d{3,})\b'
        assets = re.findall(asset_pattern, query)
        
        return assets
    
    def _extract_time_period(self, query: str) -> str:
        """Extract time period from query"""
        for period, pattern in self.time_patterns.items():
            if re.search(pattern, query):
                return period
        
        # Check for custom periods
        if "two weeks" in query:
            return "last_two_weeks"
        elif "month" in query:
            return "last_month"
        elif "week" in query:
            return "this_week"
        
        return "current"