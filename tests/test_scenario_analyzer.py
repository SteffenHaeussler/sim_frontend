import pytest

from src.app.services.scenario_analyzer import ScenarioAnalyzer


class TestScenarioAnalyzer:
    """Test scenario analyzer functionality"""

    def test_analyze_distillation_query(self):
        """Test analyzing a distillation-related query"""
        analyzer = ScenarioAnalyzer()
        query = "Analyze the performance of distillation column DC-101"
        
        result = analyzer.analyze(query)
        
        assert result is not None
        assert "keywords" in result
        assert "distillation" in result["keywords"]
        assert "DC-101" in result["keywords"]
        assert result["domain"] == "process_performance"

    def test_analyze_tank_query(self):
        """Test analyzing a tank-related query"""
        analyzer = ScenarioAnalyzer()
        query = "What are the critical parameters for Tank Farm operations?"
        
        result = analyzer.analyze(query)
        
        assert result is not None
        assert "keywords" in result
        assert "tank" in result["keywords"]
        assert result["domain"] == "operations"

    def test_analyze_pressure_investigation(self):
        """Test analyzing pressure investigation query"""
        analyzer = ScenarioAnalyzer()
        query = "Investigate the root cause of pressure fluctuations in the reactor"
        
        result = analyzer.analyze(query)
        
        assert result is not None
        assert result["domain"] == "troubleshooting"
        assert "pressure" in result["keywords"]
        assert "reactor" in result["keywords"]
        assert result["analysis_type"] == "root_cause"

    def test_analyze_efficiency_comparison(self):
        """Test analyzing efficiency comparison query"""
        analyzer = ScenarioAnalyzer()
        query = "Compare production efficiency across all processing units"
        
        result = analyzer.analyze(query)
        
        assert result is not None
        assert result["domain"] == "performance_comparison"
        assert result["analysis_type"] == "comparison"
        assert "efficiency" in result["keywords"]

    def test_extract_asset_identifiers(self):
        """Test extracting asset identifiers from query"""
        analyzer = ScenarioAnalyzer()
        query = "Analyze DC-101, TK-202, and pump P-303 performance"
        
        result = analyzer.analyze(query)
        
        assert "assets" in result
        assert "DC-101" in result["assets"]
        assert "TK-202" in result["assets"]
        assert "P-303" in result["assets"]

    def test_identify_time_context(self):
        """Test identifying time context in queries"""
        analyzer = ScenarioAnalyzer()
        
        # Test various time contexts
        queries = [
            ("Analyze performance over the last month", "last_month"),
            ("What happened today?", "today"),
            ("Check data for the last two weeks", "last_two_weeks"),
            ("Review this week's operations", "this_week")
        ]
        
        for query, expected_period in queries:
            result = analyzer.analyze(query)
            assert result["time_period"] == expected_period