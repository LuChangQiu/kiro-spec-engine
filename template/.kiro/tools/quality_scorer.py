#!/usr/bin/env python3
"""
Quality Scorer - 质量评分组件

负责计算文档质量分数，提供加权评分算法和详细评分分解
"""

from typing import Dict, Optional
from dataclasses import dataclass, field
from document_evaluator import DocumentEvaluator, QualityAssessment


@dataclass
class CriterionScore:
    """单项评分标准"""
    name: str
    score: float  # 0-10
    weight: float  # 0-1
    weighted_score: float  # score * weight
    max_score: float = 10.0
    description: str = ""


@dataclass
class ScoringResult:
    """评分结果"""
    total_score: float  # 0-10
    criterion_scores: Dict[str, CriterionScore] = field(default_factory=dict)
    language: str = 'en'
    scoring_breakdown: str = ""
    assessment: Optional[QualityAssessment] = None


class QualityScorer:
    """
    质量评分器 - 计算文档质量分数
    
    支持加权评分算法和详细评分分解
    """
    
    # 默认权重配置
    DEFAULT_REQUIREMENTS_WEIGHTS = {
        'structure': 0.20,  # 20%
        'ears_format': 0.20,  # 20%
        'user_stories': 0.20,  # 20%
        'acceptance_criteria': 0.20,  # 20%
        'nfr_coverage': 0.10,  # 10%
        'constraints': 0.10  # 10%
    }
    
    DEFAULT_DESIGN_WEIGHTS = {
        'structure': 0.25,  # 25%
        'traceability': 0.20,  # 20%
        'component_detail': 0.20,  # 20%
        'diagrams': 0.15,  # 15%
        'technology': 0.10,  # 10%
        'nfr_design': 0.05,  # 5%
        'interfaces': 0.05  # 5%
    }
    
    def __init__(self):
        self.evaluator = DocumentEvaluator()
        self.requirements_weights = self.DEFAULT_REQUIREMENTS_WEIGHTS.copy()
        self.design_weights = self.DEFAULT_DESIGN_WEIGHTS.copy()
    
    def configure_weights(self, weights: Dict[str, float]):
        """
        配置评分标准权重
        
        Args:
            weights: 权重字典，格式为 {'criterion_name': weight}
        """
        # 验证权重总和为 1.0
        total_weight = sum(weights.values())
        if abs(total_weight - 1.0) > 0.01:
            raise ValueError(f"Weights must sum to 1.0, got {total_weight}")
        
        # 更新权重
        for criterion, weight in weights.items():
            if criterion in self.requirements_weights:
                self.requirements_weights[criterion] = weight
            elif criterion in self.design_weights:
                self.design_weights[criterion] = weight
    
    def score_requirements(self, content: str, language: Optional[str] = None) -> ScoringResult:
        """
        计算 Requirements 文档质量分数
        
        Args:
            content: 文档内容
            language: 语言 ('zh' 或 'en')，None 则自动检测
        
        Returns:
            ScoringResult: 评分结果
        """
        # 使用 DocumentEvaluator 进行评估
        assessment = self.evaluator.assess_requirements_quality(content, language)
        
        # 计算加权分数
        criterion_scores = {}
        total_score = 0.0
        
        for criterion, weight in self.requirements_weights.items():
            raw_score = assessment.criteria_scores.get(criterion, 0.0)
            weighted_score = raw_score * weight * 10.0  # 转换为 0-10 分制
            
            criterion_scores[criterion] = CriterionScore(
                name=criterion,
                score=raw_score * 10.0,  # 原始分数（0-10）
                weight=weight,
                weighted_score=weighted_score,
                description=self._get_criterion_description(criterion, assessment.language)
            )
            
            total_score += weighted_score
        
        # 生成评分分解说明
        breakdown = self._generate_requirements_breakdown(
            criterion_scores, 
            total_score, 
            assessment
        )
        
        return ScoringResult(
            total_score=min(total_score, 10.0),
            criterion_scores=criterion_scores,
            language=assessment.language,
            scoring_breakdown=breakdown,
            assessment=assessment
        )
    
    def score_design(self, design_content: str, requirements_content: str, language: Optional[str] = None) -> ScoringResult:
        """
        计算 Design 文档质量分数
        
        Args:
            design_content: 设计文档内容
            requirements_content: 需求文档内容
            language: 语言 ('zh' 或 'en')，None 则自动检测
        
        Returns:
            ScoringResult: 评分结果
        """
        # 使用 DocumentEvaluator 进行评估
        assessment = self.evaluator.assess_design_quality(
            design_content, 
            requirements_content, 
            language
        )
        
        # 计算加权分数
        criterion_scores = {}
        total_score = 0.0
        
        for criterion, weight in self.design_weights.items():
            raw_score = assessment.criteria_scores.get(criterion, 0.0)
            weighted_score = raw_score * weight * 10.0  # 转换为 0-10 分制
            
            criterion_scores[criterion] = CriterionScore(
                name=criterion,
                score=raw_score * 10.0,  # 原始分数（0-10）
                weight=weight,
                weighted_score=weighted_score,
                description=self._get_criterion_description(criterion, assessment.language)
            )
            
            total_score += weighted_score
        
        # 生成评分分解说明
        breakdown = self._generate_design_breakdown(
            criterion_scores, 
            total_score, 
            assessment
        )
        
        return ScoringResult(
            total_score=min(total_score, 10.0),
            criterion_scores=criterion_scores,
            language=assessment.language,
            scoring_breakdown=breakdown,
            assessment=assessment
        )
    
    def _get_criterion_description(self, criterion: str, language: str) -> str:
        """获取评分标准描述"""
        descriptions_zh = {
            'structure': '文档结构完整性',
            'ears_format': 'EARS 格式验收标准',
            'user_stories': '用户故事质量',
            'acceptance_criteria': '验收标准完整性',
            'nfr_coverage': '非功能需求覆盖',
            'constraints': '约束条件说明',
            'traceability': '需求追溯性',
            'component_detail': '组件详细度',
            'diagrams': '架构图和设计图',
            'technology': '技术选型说明',
            'nfr_design': '非功能需求设计',
            'interfaces': '接口定义完整性'
        }
        
        descriptions_en = {
            'structure': 'Document Structure Completeness',
            'ears_format': 'EARS Format Acceptance Criteria',
            'user_stories': 'User Story Quality',
            'acceptance_criteria': 'Acceptance Criteria Completeness',
            'nfr_coverage': 'Non-functional Requirements Coverage',
            'constraints': 'Constraints Description',
            'traceability': 'Requirements Traceability',
            'component_detail': 'Component Detail Level',
            'diagrams': 'Architecture and Design Diagrams',
            'technology': 'Technology Stack Explanation',
            'nfr_design': 'Non-functional Requirements Design',
            'interfaces': 'Interface Definition Completeness'
        }
        
        if language == 'zh':
            return descriptions_zh.get(criterion, criterion)
        else:
            return descriptions_en.get(criterion, criterion)
    
    def _generate_requirements_breakdown(self, criterion_scores: Dict[str, CriterionScore], total_score: float, assessment: QualityAssessment) -> str:
        """生成 Requirements 评分分解说明"""
        lang = assessment.language
        
        if lang == 'zh':
            breakdown = f"## 评分分解\n\n"
            breakdown += f"**总分**: {total_score:.2f}/10\n\n"
            breakdown += f"### 各项评分\n\n"
            
            for criterion, score_obj in criterion_scores.items():
                breakdown += f"- **{score_obj.description}** ({score_obj.weight*100:.0f}%): "
                breakdown += f"{score_obj.score:.2f}/10 → 加权分 {score_obj.weighted_score:.2f}\n"
            
            if assessment.missing_sections:
                breakdown += f"\n### 缺失章节\n\n"
                for section in assessment.missing_sections:
                    breakdown += f"- {section}\n"
            
            if assessment.issues:
                breakdown += f"\n### 改进建议\n\n"
                for issue in assessment.issues[:5]:  # 最多显示 5 个
                    breakdown += f"- {issue}\n"
        else:
            breakdown = f"## Scoring Breakdown\n\n"
            breakdown += f"**Total Score**: {total_score:.2f}/10\n\n"
            breakdown += f"### Criterion Scores\n\n"
            
            for criterion, score_obj in criterion_scores.items():
                breakdown += f"- **{score_obj.description}** ({score_obj.weight*100:.0f}%): "
                breakdown += f"{score_obj.score:.2f}/10 → Weighted {score_obj.weighted_score:.2f}\n"
            
            if assessment.missing_sections:
                breakdown += f"\n### Missing Sections\n\n"
                for section in assessment.missing_sections:
                    breakdown += f"- {section}\n"
            
            if assessment.issues:
                breakdown += f"\n### Improvement Suggestions\n\n"
                for issue in assessment.issues[:5]:  # Show max 5
                    breakdown += f"- {issue}\n"
        
        return breakdown
    
    def _generate_design_breakdown(self, criterion_scores: Dict[str, CriterionScore], total_score: float, assessment: QualityAssessment) -> str:
        """生成 Design 评分分解说明"""
        lang = assessment.language
        
        if lang == 'zh':
            breakdown = f"## 评分分解\n\n"
            breakdown += f"**总分**: {total_score:.2f}/10\n\n"
            breakdown += f"### 各项评分\n\n"
            
            for criterion, score_obj in criterion_scores.items():
                breakdown += f"- **{score_obj.description}** ({score_obj.weight*100:.0f}%): "
                breakdown += f"{score_obj.score:.2f}/10 → 加权分 {score_obj.weighted_score:.2f}\n"
            
            if assessment.missing_sections:
                breakdown += f"\n### 缺失章节\n\n"
                for section in assessment.missing_sections:
                    breakdown += f"- {section}\n"
            
            if assessment.issues:
                breakdown += f"\n### 改进建议\n\n"
                for issue in assessment.issues[:5]:
                    breakdown += f"- {issue}\n"
        else:
            breakdown = f"## Scoring Breakdown\n\n"
            breakdown += f"**Total Score**: {total_score:.2f}/10\n\n"
            breakdown += f"### Criterion Scores\n\n"
            
            for criterion, score_obj in criterion_scores.items():
                breakdown += f"- **{score_obj.description}** ({score_obj.weight*100:.0f}%): "
                breakdown += f"{score_obj.score:.2f}/10 → Weighted {score_obj.weighted_score:.2f}\n"
            
            if assessment.missing_sections:
                breakdown += f"\n### Missing Sections\n\n"
                for section in assessment.missing_sections:
                    breakdown += f"- {section}\n"
            
            if assessment.issues:
                breakdown += f"\n### Improvement Suggestions\n\n"
                for issue in assessment.issues[:5]:
                    breakdown += f"- {issue}\n"
        
        return breakdown
