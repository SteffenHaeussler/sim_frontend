import pytest

from src.app.services.recommendation_generator import RecommendationGenerator


class TestRecommendationGenerator:
    """Test recommendation generator functionality"""

    def test_generate_distillation_recommendations(self):
        """Test generating recommendations for distillation analysis"""
        generator = RecommendationGenerator()
        analysis = {
            "keywords": ["distillation", "DC-101", "performance"],
            "domain": "process_performance",
            "analysis_type": "general_analysis",
            "time_period": "last_month"
        }
        query = "Analyze the performance of distillation column DC-101"
        
        recommendations = generator.generate(query, analysis)
        
        assert len(recommendations) == 5
        assert all(rec.agent_type in ["sqlagent", "toolagent"] for rec in recommendations)
        assert all(rec.sub_id.startswith("rec-") for rec in recommendations)
        assert any("temperature" in rec.query.lower() for rec in recommendations)
        assert any("pressure" in rec.query.lower() for rec in recommendations)

    def test_generate_troubleshooting_recommendations(self):
        """Test generating recommendations for troubleshooting"""
        generator = RecommendationGenerator()
        analysis = {
            "keywords": ["pressure", "reactor", "fluctuations"],
            "domain": "troubleshooting",
            "analysis_type": "root_cause",
            "time_period": "current"
        }
        query = "Investigate root cause of pressure fluctuations in reactor"
        
        recommendations = generator.generate(query, analysis)
        
        assert len(recommendations) == 5
        assert any("historical data" in rec.query.lower() for rec in recommendations)
        assert any("alarm" in rec.query.lower() or "event" in rec.query.lower() for rec in recommendations)
        assert any("correlation" in rec.query.lower() for rec in recommendations)

    def test_generate_comparison_recommendations(self):
        """Test generating recommendations for comparison analysis"""
        generator = RecommendationGenerator()
        analysis = {
            "keywords": ["efficiency", "production"],
            "domain": "performance_comparison",
            "analysis_type": "comparison",
            "time_period": "this_week"
        }
        query = "Compare production efficiency across all units"
        
        recommendations = generator.generate(query, analysis)
        
        assert len(recommendations) == 5
        assert any("unit" in rec.query.lower() for rec in recommendations)
        assert any("benchmark" in rec.query.lower() or "average" in rec.query.lower() for rec in recommendations)

    def test_recommendation_structure(self):
        """Test that recommendations have correct structure"""
        generator = RecommendationGenerator()
        analysis = {
            "keywords": ["tank", "level"],
            "domain": "operations",
            "analysis_type": "general_analysis",
            "time_period": "today"
        }
        query = "What is the level in Tank A?"
        
        recommendations = generator.generate(query, analysis)
        
        for rec in recommendations:
            assert hasattr(rec, 'agent_type')
            assert hasattr(rec, 'query')
            assert hasattr(rec, 'sub_id')
            assert rec.agent_type in ["sqlagent", "toolagent"]
            assert isinstance(rec.query, str)
            assert len(rec.query) > 10  # Meaningful query

    def test_sql_vs_tool_agent_distribution(self):
        """Test that both SQL and tool agents are used appropriately"""
        generator = RecommendationGenerator()
        analysis = {
            "keywords": ["temperature", "cooling"],
            "domain": "process_performance",
            "analysis_type": "general_analysis",
            "time_period": "last_two_weeks"
        }
        query = "Analyze cooling system temperature"
        
        recommendations = generator.generate(query, analysis)
        
        sql_count = sum(1 for rec in recommendations if rec.agent_type == "sqlagent")
        tool_count = sum(1 for rec in recommendations if rec.agent_type == "toolagent")
        
        assert sql_count >= 2  # At least 2 SQL queries
        assert tool_count >= 2  # At least 2 tool queries
        assert sql_count + tool_count == 5