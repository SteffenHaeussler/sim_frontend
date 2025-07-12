from typing import List

from src.app.core.scenario_schema import AgentQuery


class RecommendationGenerator:
    """Generates agent-specific recommendations based on analysis"""
    
    def __init__(self):
        self.recommendation_templates = self._init_templates()
    
    def _init_templates(self) -> dict:
        """Initialize recommendation templates"""
        return {
            "process_performance": {
                "sqlagent": [
                    "Get average temperature and pressure values for {asset} over {time_period}",
                    "Show min/max temperature readings with timestamps for {asset}",
                    "Calculate efficiency metrics and production rates for {time_period}"
                ],
                "toolagent": [
                    "Analyze temperature and pressure trends to identify anomalies for {asset}",
                    "Generate performance report with key metrics visualization"
                ]
            },
            "troubleshooting": self._get_troubleshooting_templates(),
            "performance_comparison": self._get_comparison_templates()
        }
    
    def _get_troubleshooting_templates(self) -> dict:
        """Get troubleshooting templates"""
        return {
            "sqlagent": [
                "Retrieve historical data for {parameter} when issues occurred",
                "List all alarms and events related to {asset} in {time_period}",
                "Get correlated parameter values during incident times"
            ],
            "toolagent": [
                "Analyze {parameter} patterns to identify root cause",
                "Check for correlations between different process variables"
            ]
        }
    
    def _get_comparison_templates(self) -> dict:
        """Get performance comparison templates"""
        return {
            "sqlagent": [
                "Get {parameter} data for all units to compare performance",
                "Calculate average efficiency metrics per unit for {time_period}",
                "Retrieve benchmark values and actual performance data"
            ],
            "toolagent": [
                "Generate comparison charts for unit performance",
                "Identify best and worst performing units with reasons"
            ]
        }
    
    def generate(self, query: str, analysis: dict) -> List[AgentQuery]:
        """Generate 5 recommendations based on query analysis"""
        domain = analysis.get("domain", "general")
        keywords = analysis.get("keywords", [])
        time_period = analysis.get("time_period", "current")
        
        templates = self._get_templates_for_domain(domain)
        recommendations = self._create_recommendations_from_templates(
            templates, keywords, time_period, analysis
        )
        
        return self._ensure_five_recommendations(recommendations)
    
    def _create_recommendations_from_templates(self, templates: dict, keywords: List[str], 
                                             time_period: str, analysis: dict) -> List[AgentQuery]:
        """Create recommendations from templates"""
        recommendations = []
        rec_count = 0
        
        for agent_type, query_templates in templates.items():
            new_recs = self._process_agent_templates(
                agent_type, query_templates, keywords, time_period, analysis, rec_count
            )
            recommendations.extend(new_recs)
            rec_count += len(new_recs)
            if rec_count >= 5:
                break
                
        return recommendations
    
    def _process_agent_templates(self, agent_type: str, templates: List[str], keywords: List[str],
                                time_period: str, analysis: dict, start_count: int) -> List[AgentQuery]:
        """Process templates for a specific agent type"""
        recommendations = []
        for i, template in enumerate(templates):
            if start_count + i >= 5:
                break
            filled_query = self._fill_template(template, keywords, time_period, analysis)
            recommendation = AgentQuery(
                agent_type=agent_type,
                query=filled_query,
                sub_id=f"rec-{start_count + i + 1}"
            )
            recommendations.append(recommendation)
        return recommendations
    
    def _ensure_five_recommendations(self, recommendations: List[AgentQuery]) -> List[AgentQuery]:
        """Ensure we have exactly 5 recommendations"""
        while len(recommendations) < 5:
            recommendations.append(self._create_default_recommendation(len(recommendations) + 1))
        return recommendations[:5]
    
    def _get_templates_for_domain(self, domain: str) -> dict:
        """Get recommendation templates for a specific domain"""
        if domain in self.recommendation_templates:
            return self.recommendation_templates[domain]
        
        # Default templates for unknown domains
        return {
            "sqlagent": [
                "Get current values and status for relevant parameters",
                "Retrieve historical data for the specified time period",
                "Show statistical summary of key metrics"
            ],
            "toolagent": [
                "Analyze trends and patterns in the data",
                "Generate visualization of key parameters"
            ]
        }
    
    def _fill_template(self, template: str, keywords: List[str], 
                      time_period: str, analysis: dict) -> str:
        """Fill a template with actual values"""
        # Extract parameters from keywords
        parameters = ["temperature", "pressure", "flow", "level"]
        parameter = next((k for k in keywords if k in parameters), "key parameters")
        
        # Extract assets from keywords
        assets = [k for k in keywords if k.isupper() and "-" in k]
        asset = assets[0] if assets else "the specified asset"
        
        # Format time period
        time_desc = time_period.replace("_", " ")
        
        query = template.replace("{parameter}", parameter)
        query = query.replace("{asset}", asset)
        query = query.replace("{time_period}", time_desc)
        
        return query
    
    def _create_default_recommendation(self, index: int) -> AgentQuery:
        """Create a default recommendation"""
        agent_type = "sqlagent" if index <= 3 else "toolagent"
        query = f"Perform additional analysis #{index} for comprehensive insights"
        
        return AgentQuery(
            agent_type=agent_type,
            query=query,
            sub_id=f"rec-{index}"
        )